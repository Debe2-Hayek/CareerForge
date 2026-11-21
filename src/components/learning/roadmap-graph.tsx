"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  Background, BackgroundVariant, Controls, Handle, MiniMap, Position, ReactFlow, ReactFlowProvider, useReactFlow,
  type Edge, type Node, type NodeProps
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GraphEdge, GraphNode } from "@/lib/learning/graph-layout";
import styles from "./roadmap-graph.module.css";

/** Focus mode hides most nodes; close any vertical gap larger than maxGap so the chain stays readable. */
function compactGaps(list: GraphNode[], maxGap: number): Map<string, number> {
  const lift = new Map<string, number>();
  let total = 0;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const node of [...list].sort((a, b) => a.y - b.y)) {
    if (Number.isFinite(bottom) && node.y - bottom > maxGap) total += node.y - bottom - maxGap;
    lift.set(node.id, total);
    bottom = Math.max(bottom, node.y + node.height);
  }
  return lift;
}

// Interactive roadmap viewer (React Flow / XYFlow). Positions come from the
// deterministic server-side layout; this component adds zoom and pan,
// fit-to-view, search-and-jump, path highlighting, focus mode, a minimap and
// keyboard navigation. Topic nodes are real links, so the topic panel opens
// through the URL (?topic=) and the graph keeps its viewport while it is open.

export type TopicStatus = "completed" | "known" | "in_progress" | "available" | "locked";
export type GraphTopicState = { status: TopicStatus; inPlan: boolean; tier: "essential" | "recommended" | "optional"; hours: number };
export type GraphPhaseState = { done: number; required: number; included: boolean };

type Props = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  topics: Record<string, GraphTopicState>;
  phases: Record<string, GraphPhaseState>;
  hrefs: Record<string, string>;
  nextId: string | null;
  selectedId: string | null;
};

type NodeData = {
  label: string;
  kind: GraphNode["kind"];
  href?: string;
  topic?: GraphTopicState;
  phase?: GraphPhaseState;
  next?: boolean;
  dim?: boolean;
  related?: "active" | "before" | "after";
  onFocusNode?: (id: string) => void;
};

const statusText: Record<TopicStatus, string> = {
  completed: "Completed", known: "Already known", in_progress: "In progress", available: "Ready to start", locked: "Needs prerequisites"
};
const sides = [["top", Position.Top], ["bottom", Position.Bottom], ["left", Position.Left], ["right", Position.Right]] as const;
function Handles() {
  return <>{sides.map(([id, position]) => <span key={id}>
    <Handle id={id} type="source" position={position} className={styles.handle} isConnectable={false} />
    <Handle id={id} type="target" position={position} className={styles.handle} isConnectable={false} />
  </span>)}</>;
}

const TopicNode = memo(function TopicNode({ id, data }: NodeProps<Node<NodeData>>) {
  const topic = data.topic!;
  return <div className={styles.topic} data-status={topic.status} data-optional={!topic.inPlan || undefined} data-next={data.next || undefined}
    data-dim={data.dim || undefined} data-related={data.related}>
    <Handles />
    <Link href={data.href!} scroll={false} className={`${styles.topicLink} nodrag nopan`} onFocus={() => data.onFocusNode?.(id)}
      aria-label={`${data.label}. ${statusText[topic.status]}${data.next ? ". Your next topic" : ""}${topic.inPlan ? "" : ". Optional for your goal"}. About ${topic.hours} hours. Open details.`}>
      <span className={styles.check} aria-hidden="true" />
      <span className={styles.topicLabel}>{data.label}</span>
      {data.next && <span className={styles.nextTag} aria-hidden="true">Next</span>}
    </Link>
  </div>;
});

const PhaseNode = memo(function PhaseNode({ data }: NodeProps<Node<NodeData>>) {
  const phase = data.phase;
  const percent = phase && phase.required ? Math.round(phase.done / phase.required * 100) : null;
  return <div className={styles.phase} data-included={phase?.included ?? true} data-dim={data.dim || undefined}>
    <Handles />
    <strong>{data.label}</strong>
    {percent === null ? <small>{phase?.included === false ? "Other specialisation" : "Optional for your goal"}</small> : <>
      <span className={styles.phaseBar} aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
      <small>{phase!.done}/{phase!.required} done</small>
    </>}
  </div>;
});

const TitleNode = memo(function TitleNode({ data }: NodeProps<Node<NodeData>>) {
  return <div className={styles.title}><Handles /><span>{data.label}</span></div>;
});
const ForkNode = memo(function ForkNode({ data }: NodeProps<Node<NodeData>>) {
  return <div className={styles.fork}><Handles /><span>{data.label}</span></div>;
});

const nodeTypes = { topic: TopicNode, phase: PhaseNode, title: TitleNode, fork: ForkNode };

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function Graph({ nodes: layoutNodes, edges: layoutEdges, topics, phases, hrefs, nextId, selectedId }: Props) {
  const flow = useReactFlow();
  const reducedMotion = useReducedMotion();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [showAllLinks, setShowAllLinks] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeOption, setActiveOption] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const centred = useRef(false);
  const duration = reducedMotion ? 0 : 400;

  const byId = useMemo(() => new Map(layoutNodes.map(node => [node.id, node])), [layoutNodes]);
  const prerequisiteEdges = useMemo(() => layoutEdges.filter(edge => edge.kind === "prerequisite"), [layoutEdges]);
  const activeId = hoverId ?? pinnedId ?? selectedId;

  // Transitive prerequisites ("before") and dependents ("after") of the active topic.
  const { before, after } = useMemo(() => {
    const before = new Set<string>(), after = new Set<string>();
    if (!activeId || !topics[activeId]) return { before, after };
    const walk = (start: string, forward: boolean, into: Set<string>) => {
      const stack = [start];
      while (stack.length) {
        const current = stack.pop()!;
        for (const edge of prerequisiteEdges) {
          const next = forward ? (edge.source === current ? edge.target : null) : (edge.target === current ? edge.source : null);
          if (next && !into.has(next)) { into.add(next); stack.push(next); }
        }
      }
    };
    walk(activeId, false, before);
    walk(activeId, true, after);
    return { before, after };
  }, [activeId, prerequisiteEdges, topics]);
  const highlighting = Boolean(activeId && topics[activeId]);
  const related = useCallback((id: string) => id === activeId || before.has(id) || after.has(id), [activeId, before, after]);
  const relatedPhases = useMemo(() => new Set(layoutNodes.filter(node => node.kind === "topic" && related(node.id)).map(node => `phase:${node.phaseId}`)), [layoutNodes, related]);

  // Live position (focus mode moves nodes), falling back to the static layout.
  const centreOf = useCallback((id: string) => {
    const node = byId.get(id);
    if (!node) return null;
    const position = flow.getNode(id)?.position ?? { x: node.x, y: node.y };
    return { x: position.x + node.width / 2, y: position.y + node.height / 2 };
  }, [byId, flow]);

  const centreOn = useCallback((id: string, zoom?: number) => {
    const centre = centreOf(id);
    if (centre) void flow.setCenter(centre.x, centre.y, { zoom: zoom ?? Math.max(flow.getZoom(), 0.9), duration });
  }, [centreOf, flow, duration]);

  const onFocusNode = useCallback((id: string) => {
    // Keyboard users tabbing through topics: bring the focused node into view.
    const centre = centreOf(id);
    if (centre) void flow.setCenter(centre.x, centre.y, { zoom: flow.getZoom(), duration: reducedMotion ? 0 : 200 });
  }, [centreOf, flow, reducedMotion]);

  const nodes: Node<NodeData>[] = useMemo(() => {
    const focused = focusMode && highlighting;
    const shown = layoutNodes.filter(node => !focused || node.kind === "title" || (node.kind === "topic" ? related(node.id) : relatedPhases.has(node.id) || node.kind === "fork"));
    const lift = focused ? compactGaps(shown, 72) : null;
    return shown.map(node => ({
      id: node.id,
      type: node.kind,
      position: { x: node.x, y: node.y - (lift?.get(node.id) ?? 0) },
      width: node.width,
      height: node.height,
      draggable: false,
      selectable: false,
      focusable: false,
      data: {
        label: node.label,
        kind: node.kind,
        href: node.kind === "topic" ? hrefs[node.id] : undefined,
        topic: node.kind === "topic" ? topics[node.id] : undefined,
        phase: node.kind === "phase" && node.phaseId ? phases[node.phaseId] : undefined,
        next: node.id === nextId,
        dim: highlighting && (node.kind === "topic" ? !related(node.id) : node.kind === "phase" ? !relatedPhases.has(node.id) : false),
        related: !highlighting || node.kind !== "topic" ? undefined : node.id === activeId ? "active" : before.has(node.id) ? "before" : after.has(node.id) ? "after" : undefined,
        onFocusNode
      }
    }));
  }, [layoutNodes, focusMode, highlighting, related, relatedPhases, hrefs, topics, phases, nextId, activeId, before, after, onFocusNode]);

  const visible = useMemo(() => new Set(nodes.map(node => node.id)), [nodes]);
  const branchIncluded = useMemo(() => new Map(layoutNodes.filter(node => node.kind === "phase" && node.branch && node.phaseId)
    .map(node => [node.branch as string, phases[node.phaseId as string]?.included ?? true])), [layoutNodes, phases]);
  const edges: Edge[] = useMemo(() => layoutEdges.flatMap((edge): Edge[] => {
    if (!visible.has(edge.source) || !visible.has(edge.target)) return [];
    if (edge.kind === "prerequisite") {
      const chainBefore = highlighting && (edge.target === activeId || before.has(edge.target)) && before.has(edge.source);
      const chainAfter = highlighting && (edge.source === activeId || after.has(edge.source)) && after.has(edge.target);
      if (!chainBefore && !chainAfter && !showAllLinks) return [];
      return [{ id: edge.id, source: edge.source, target: edge.target, sourceHandle: "bottom", targetHandle: "top", type: "default", animated: (chainBefore || chainAfter) && !reducedMotion,
        className: chainBefore ? styles.edgeBefore : chainAfter ? styles.edgeAfter : styles.edgeAll, zIndex: 0 }];
    }
    const phaseIncluded = edge.branch ? branchIncluded.get(edge.branch) ?? true : true;
    return [{ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle, targetHandle: edge.targetHandle,
      type: edge.kind === "spine" ? "smoothstep" : edge.branch ? "smoothstep" : "default",
      className: [edge.kind === "spine" ? styles.edgeSpine : styles.edgeMember, phaseIncluded ? "" : styles.edgeMuted, highlighting ? styles.edgeQuiet : ""].join(" ") }];
  }), [layoutEdges, visible, highlighting, activeId, before, after, showAllLinks, branchIncluded, reducedMotion]);

  const onInit = useCallback(() => {
    if (centred.current) return;
    centred.current = true;
    const mobile = window.innerWidth < 720;
    const start = byId.get(selectedId ?? nextId ?? "");
    if (!start) { void flow.fitView({ padding: 0.1, duration }); return; }
    // Wide screens: keep the spine centred so both topic columns of the phase are visible;
    // narrow screens and specialisation columns centre on the topic itself.
    const x = !mobile && !start.branch ? 0 : start.x + start.width / 2;
    void flow.setCenter(x, start.y + start.height / 2, { zoom: mobile ? 0.75 : 0.9, duration: 0 });
  }, [selectedId, nextId, byId, flow, duration]);

  // Focus mode zooms to the visible chain.
  useEffect(() => {
    if (focusMode && highlighting) void flow.fitView({ padding: 0.2, duration, nodes: nodes.map(node => ({ id: node.id })) });
  }, [focusMode, highlighting, activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const options = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return layoutNodes.filter(node => node.kind === "topic" && terms.every(term => node.label.toLowerCase().includes(term))).slice(0, 8);
  }, [query, layoutNodes]);

  function choose(id: string) {
    setPinnedId(id);
    setSearchOpen(false);
    setQuery("");
    centreOn(id, 1.05);
    const node = byId.get(id);
    setAnnouncement(`${node?.label ?? "Topic"} highlighted with its prerequisites and dependents. Press Enter on it to open details.`);
  }
  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") { event.preventDefault(); setActiveOption(index => Math.min(index + 1, options.length - 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActiveOption(index => Math.max(index - 1, 0)); }
    if (event.key === "Enter" && options[activeOption]) { event.preventDefault(); choose(options[activeOption].id); }
    if (event.key === "Escape") { setSearchOpen(false); setQuery(""); }
  }

  const activeLabel = activeId ? byId.get(activeId)?.label : null;

  return <div className={styles.shell}>
    <div className={styles.toolbar} role="toolbar" aria-label="Roadmap tools">
      <div className={styles.search}>
        <label htmlFor="roadmap-search" className="sr-only">Search topics</label>
        <input id="roadmap-search" type="search" value={query} placeholder="Search topics…" autoComplete="off"
          role="combobox" aria-expanded={searchOpen && options.length > 0} aria-controls="roadmap-search-results" aria-autocomplete="list"
          aria-activedescendant={searchOpen && options[activeOption] ? `roadmap-option-${options[activeOption].id}` : undefined}
          onChange={event => { setQuery(event.target.value.slice(0, 60)); setSearchOpen(true); setActiveOption(0); }}
          onFocus={() => setSearchOpen(true)} onBlur={() => setTimeout(() => setSearchOpen(false), 150)} onKeyDown={onSearchKey} />
        {searchOpen && options.length > 0 && <ul id="roadmap-search-results" role="listbox" className={styles.results}>
          {options.map((option, index) => <li key={option.id} id={`roadmap-option-${option.id}`} role="option" aria-selected={index === activeOption}
            onMouseDown={event => { event.preventDefault(); choose(option.id); }}>
            <span className={styles.check} data-status={topics[option.id]?.status} aria-hidden="true" />{option.label}
          </li>)}
        </ul>}
        {searchOpen && query && !options.length && <p className={styles.noResults}>No topic matches “{query}”.</p>}
      </div>
      {nextId && <button type="button" className={styles.tool} onClick={() => choose(nextId)}>Jump to next topic</button>}
      <button type="button" className={styles.tool} aria-pressed={showAllLinks} onClick={() => setShowAllLinks(value => !value)}>Show all prerequisites</button>
      <button type="button" className={styles.tool} aria-pressed={focusMode} disabled={!highlighting} onClick={() => setFocusMode(value => !value)}
        title={highlighting ? undefined : "Select or search a topic first"}>Focus mode</button>
      <button type="button" className={styles.tool} onClick={() => void flow.fitView({ padding: 0.1, duration })}>Fit to view</button>
      {pinnedId && <button type="button" className={styles.tool} onClick={() => { setPinnedId(null); setFocusMode(false); }}>Clear highlight</button>}
    </div>
    <p className={styles.status} role="status" aria-live="polite">{announcement}</p>
    {highlighting && activeLabel && <p className={styles.pathNote}>
      <strong>{activeLabel}</strong>: <span className={styles.beforeKey}>{before.size} prerequisite{before.size === 1 ? "" : "s"}</span> · <span className={styles.afterKey}>{after.size} {after.size === 1 ? "topic builds" : "topics build"} on it</span>
    </p>}
    <div className={styles.canvas} onMouseLeave={() => setHoverId(null)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={onInit}
        onNodeMouseEnter={(_, node) => { if (node.type === "topic") setHoverId(node.id); }}
        onNodeMouseLeave={() => setHoverId(null)}
        onPaneClick={() => { setPinnedId(null); setFocusMode(false); }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        minZoom={0.2}
        maxZoom={1.75}
        zoomOnDoubleClick={false}
        panOnScroll
        colorMode="dark"
        aria-label="Interactive roadmap. Drag to pan, scroll or pinch to zoom. Tab moves between topics; Enter opens a topic."
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} className={styles.background} />
        <Controls showInteractive={false} className={styles.controls} position="bottom-left" />
        <MiniMap className={styles.minimap} pannable zoomable position="top-right" ariaLabel="Roadmap overview"
          nodeColor={node => node.type === "phase" ? "#c5ed85" : (node.data as NodeData).topic?.status === "completed" || (node.data as NodeData).topic?.status === "known" ? "#6f9a46" : "#3a4a33"} />
      </ReactFlow>
    </div>
  </div>;
}

export function RoadmapGraph(props: Props) {
  return <ReactFlowProvider><Graph {...props} /></ReactFlowProvider>;
}
