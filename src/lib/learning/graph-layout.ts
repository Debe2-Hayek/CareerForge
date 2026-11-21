import type { LearningCourse } from "./schema";

// Deterministic roadmap layout, modelled on roadmap.sh's visual grammar:
// a vertical spine of phases, each phase's topics stacked to its left and
// right with dotted connectors, and a visible fork where specialisations
// branch off before rejoining at the career phase. Positions depend only on
// the curriculum (never on progress or goals), so the map is stable between
// visits and only its styling reflects the learner.

export const TOPIC_W = 236;
export const TOPIC_H = 52;
export const PHASE_W = 260;
export const PHASE_H = 60;
const ROW_GAP = 14;
const SIDE_GAP = 72;
const PHASE_GAP = 96;
const COLUMN_GAP = 48;
const TITLE_H = 64;
const FORK_LABEL_H = 34;

export type GraphNodeKind = "title" | "phase" | "topic" | "fork";
export type GraphNode = {
  id: string;
  kind: GraphNodeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  phaseId?: string;
  branch?: string | null;
  /** For topics: which side of a spine phase they sit on ("column" inside a fork). */
  side?: "left" | "right" | "column";
};

export type GraphEdgeKind = "spine" | "member" | "prerequisite";
export type GraphEdge = {
  id: string;
  kind: GraphEdgeKind;
  source: string;
  target: string;
  sourceHandle: "top" | "bottom" | "left" | "right";
  targetHandle: "top" | "bottom" | "left" | "right";
  branch?: string | null;
};

export type GraphLayout = { nodes: GraphNode[]; edges: GraphEdge[]; width: number; height: number };

const phaseNodeId = (id: string) => `phase:${id}`;

export function layoutRoadmap(course: LearningCourse): GraphLayout {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const topicsOf = (phaseId: string) => course.topics.filter(topic => topic.phaseId === phaseId);
  const core = course.phases.filter(phase => !phase.branch && !phase.career);
  const branches = course.phases.filter(phase => phase.branch);
  const career = course.phases.filter(phase => phase.career);

  // Wide enough for the course name at the title font size (~12px per character at 22px).
  const titleW = Math.max(PHASE_W, Math.ceil(course.title.length * 12.5) + 48);
  nodes.push({ id: "title", kind: "title", x: -titleW / 2, y: 0, width: titleW, height: TITLE_H, label: course.title });
  let cursor = TITLE_H + PHASE_GAP * 0.6;
  let previous = "title";

  // A spine phase with its topics alternating left and right, row by row, so
  // reading order (left, then right, then the next row) follows curriculum order.
  const placeSpinePhase = (phase: (typeof course.phases)[number], incoming: { from: string; handle: GraphEdge["sourceHandle"]; branch?: string | null }[]) => {
    const topics = topicsOf(phase.id);
    const rows = Math.max(1, Math.ceil(topics.length / 2));
    const rowsHeight = rows * TOPIC_H + (rows - 1) * ROW_GAP;
    const blockHeight = Math.max(PHASE_H, rowsHeight);
    const id = phaseNodeId(phase.id);
    nodes.push({ id, kind: "phase", x: -PHASE_W / 2, y: cursor + (blockHeight - PHASE_H) / 2, width: PHASE_W, height: PHASE_H, label: phase.title, phaseId: phase.id, branch: null });
    for (const { from, handle, branch } of incoming) {
      edges.push({ id: `spine:${from}->${id}`, kind: "spine", source: from, target: id, sourceHandle: handle, targetHandle: "top", branch: branch ?? null });
    }
    topics.forEach((topic, index) => {
      const row = Math.floor(index / 2);
      const side = index % 2 === 0 ? "left" : "right";
      const x = side === "left" ? -PHASE_W / 2 - SIDE_GAP - TOPIC_W : PHASE_W / 2 + SIDE_GAP;
      const y = cursor + (blockHeight - rowsHeight) / 2 + row * (TOPIC_H + ROW_GAP);
      nodes.push({ id: topic.id, kind: "topic", x, y, width: TOPIC_W, height: TOPIC_H, label: topic.title, phaseId: phase.id, branch: null, side });
      edges.push({ id: `member:${id}->${topic.id}`, kind: "member", source: id, target: topic.id, sourceHandle: side, targetHandle: side === "left" ? "right" : "left" });
    });
    cursor += blockHeight + PHASE_GAP;
    return id;
  };

  for (const phase of core) {
    previous = placeSpinePhase(phase, [{ from: previous, handle: "bottom" }]);
  }

  // Fork: specialisations side by side, each a column with its topics on a rail.
  let rejoin: { from: string; handle: GraphEdge["sourceHandle"]; branch?: string | null }[] = [{ from: previous, handle: "bottom" }];
  if (branches.length) {
    const forkId = "fork";
    nodes.push({ id: forkId, kind: "fork", x: -PHASE_W / 2, y: cursor - PHASE_GAP / 2, width: PHASE_W, height: FORK_LABEL_H, label: "Choose a specialisation" });
    edges.push({ id: `spine:${previous}->${forkId}`, kind: "spine", source: previous, target: forkId, sourceHandle: "bottom", targetHandle: "top" });
    cursor += FORK_LABEL_H;
    const columnWidth = PHASE_W + COLUMN_GAP;
    let tallest = 0;
    rejoin = [];
    branches.forEach((phase, column) => {
      const centre = (column - (branches.length - 1) / 2) * columnWidth;
      const id = phaseNodeId(phase.id);
      nodes.push({ id, kind: "phase", x: centre - PHASE_W / 2, y: cursor, width: PHASE_W, height: PHASE_H, label: phase.title.replace(/^Specialisation:\s*/, ""), phaseId: phase.id, branch: phase.branch });
      edges.push({ id: `spine:${forkId}->${id}`, kind: "spine", source: forkId, target: id, sourceHandle: "bottom", targetHandle: "top", branch: phase.branch });
      let y = cursor + PHASE_H + ROW_GAP * 2;
      let last = id;
      for (const topic of topicsOf(phase.id)) {
        nodes.push({ id: topic.id, kind: "topic", x: centre - TOPIC_W / 2 + 12, y, width: TOPIC_W, height: TOPIC_H, label: topic.title, phaseId: phase.id, branch: phase.branch, side: "column" });
        edges.push({ id: `member:${id}->${topic.id}`, kind: "member", source: id, target: topic.id, sourceHandle: "left", targetHandle: "left", branch: phase.branch });
        y += TOPIC_H + ROW_GAP;
        last = topic.id;
      }
      tallest = Math.max(tallest, y - cursor);
      rejoin.push({ from: last, handle: "bottom", branch: phase.branch });
    });
    cursor += tallest + PHASE_GAP;
  }

  for (const phase of career) {
    previous = placeSpinePhase(phase, rejoin);
    rejoin = [{ from: previous, handle: "bottom" }];
  }

  // Prerequisite relationships: drawn only on demand (selection or "show all").
  for (const topic of course.topics) {
    for (const prerequisite of topic.prerequisites) {
      edges.push({ id: `prereq:${prerequisite}->${topic.id}`, kind: "prerequisite", source: prerequisite, target: topic.id, sourceHandle: "bottom", targetHandle: "top" });
    }
  }

  const minX = Math.min(...nodes.map(node => node.x));
  const maxX = Math.max(...nodes.map(node => node.x + node.width));
  const maxY = Math.max(...nodes.map(node => node.y + node.height));
  return { nodes, edges, width: maxX - minX, height: maxY };
}

/** Topics a topic depends on, transitively (excluding itself). */
export function ancestorsOf(course: LearningCourse, topicId: string): Set<string> {
  const byId = new Map(course.topics.map(topic => [topic.id, topic.prerequisites]));
  const found = new Set<string>();
  const stack = [...(byId.get(topicId) ?? [])];
  while (stack.length) {
    const id = stack.pop() as string;
    if (found.has(id)) continue;
    found.add(id);
    stack.push(...(byId.get(id) ?? []));
  }
  return found;
}

/** Topics that depend on a topic, transitively (excluding itself). */
export function descendantsOf(course: LearningCourse, topicId: string): Set<string> {
  const dependents = new Map<string, string[]>();
  for (const topic of course.topics) for (const prerequisite of topic.prerequisites) {
    dependents.set(prerequisite, [...(dependents.get(prerequisite) ?? []), topic.id]);
  }
  const found = new Set<string>();
  const stack = [...(dependents.get(topicId) ?? [])];
  while (stack.length) {
    const id = stack.pop() as string;
    if (found.has(id)) continue;
    found.add(id);
    stack.push(...(dependents.get(id) ?? []));
  }
  return found;
}
