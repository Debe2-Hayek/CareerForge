import Link from "next/link";
import type { LearningCourse } from "@/lib/learning/schema";
import type { LearningPlan, PlanTopic, PlanTopicStatus } from "@/lib/learning/plan";
import styles from "./skill-map.module.css";

// A connected skill map: phases as columns, topics as nodes, and a curved line
// for every prerequisite. Lines and nodes carry status colours, and the route
// into the learner's next topic is highlighted, so the picture answers both
// "where am I?" and "why is this next?". Nodes are real links (keyboard and
// screen-reader friendly); the drawing itself is decorative.

const COL_W = 212;
const GAP_X = 76;
const NODE_H = 50;
const GAP_Y = 14;
const HEAD_H = 74;
const PAD = 18;

const statusText: Record<PlanTopicStatus, string> = {
  completed: "completed", known: "already known", in_progress: "in progress", available: "ready to start", locked: "needs prerequisites"
};

type Placed = { topic: PlanTopic; x: number; y: number };

export function SkillMap({ course, plan, topicHref }: { course: LearningCourse; plan: LearningPlan; topicHref: (id: string) => string }) {
  const phases = plan.phases.filter(phase => phase.included);
  const placed = new Map<string, Placed>();
  phases.forEach((phase, column) => {
    phase.topics.forEach((topic, row) => {
      placed.set(topic.id, { topic, x: PAD + column * (COL_W + GAP_X), y: HEAD_H + row * (NODE_H + GAP_Y) });
    });
  });
  const rows = Math.max(...phases.map(phase => phase.topics.length), 1);
  const width = PAD * 2 + phases.length * COL_W + (phases.length - 1) * GAP_X;
  const height = HEAD_H + rows * (NODE_H + GAP_Y) + PAD;

  // The route into the next topic: its prerequisites, and theirs, back to the start.
  const route = new Set<string>();
  const prerequisitesOf = new Map(course.topics.map(topic => [topic.id, topic.prerequisites]));
  const walk = (id: string) => {
    if (route.has(id)) return;
    route.add(id);
    for (const prerequisite of prerequisitesOf.get(id) ?? []) walk(prerequisite);
  };
  if (plan.nextTopic) walk(plan.nextTopic.id);

  const edges = course.topics.flatMap(topic => {
    const to = placed.get(topic.id);
    if (!to) return [];
    return topic.prerequisites.flatMap(id => {
      const from = placed.get(id);
      if (!from) return [];
      const done = from.topic.status === "completed" || from.topic.status === "known";
      const onRoute = route.has(topic.id) && route.has(id);
      let d: string;
      if (from.x === to.x) {
        // Same phase: a short arc beside the column.
        const x = from.x + COL_W;
        d = `M ${x} ${from.y + NODE_H / 2} C ${x + 26} ${from.y + NODE_H / 2}, ${x + 26} ${to.y + NODE_H / 2}, ${x} ${to.y + NODE_H / 2}`;
      } else {
        const x1 = from.x + COL_W, y1 = from.y + NODE_H / 2, x2 = to.x, y2 = to.y + NODE_H / 2, mid = (x1 + x2) / 2;
        d = `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
      }
      return [{ key: `${id}->${topic.id}`, d, done, onRoute }];
    });
  });

  return <div className={styles.wrap}>
    <div className={styles.scroller} role="region" aria-label={`${course.title} skill map. Each topic links to its details; lines show prerequisites.`} tabIndex={0}>
      <div className={styles.canvas} style={{ width, height }}>
        <svg className={styles.edges} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
          {edges.filter(edge => !edge.onRoute).map(edge => <path key={edge.key} d={edge.d} className={edge.done ? styles.edgeDone : styles.edge} />)}
          {edges.filter(edge => edge.onRoute).map(edge => <path key={edge.key} d={edge.d} className={edge.done ? styles.edgeRouteDone : styles.edgeRoute} />)}
        </svg>
        {phases.map((phase, column) => {
          const percent = phase.required ? Math.round(phase.done / phase.required * 100) : null;
          return <div key={phase.id} className={styles.phaseHead} style={{ left: PAD + column * (COL_W + GAP_X), width: COL_W }}>
            <span className={styles.phaseIndex}>{String(column + 1).padStart(2, "0")}</span>
            <strong>{phase.title.replace("Specialisation: ", "")}</strong>
            {percent === null ? <small>Optional for this goal</small> : <>
              <span className={styles.phaseBar} aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
              <small>{phase.done}/{phase.required} done</small>
            </>}
          </div>;
        })}
        {[...placed.values()].map(({ topic, x, y }) => <Link
          key={topic.id}
          href={topicHref(topic.id)}
          scroll={false}
          className={styles.node}
          data-status={topic.status}
          data-next={topic.isNext || undefined}
          data-route={route.has(topic.id) || undefined}
          data-optional={!topic.inPlan || undefined}
          style={{ left: x, top: y, width: COL_W, height: NODE_H }}
          aria-label={`${topic.title}: ${statusText[topic.status]}${topic.isNext ? ", your next topic" : ""}${topic.inPlan ? "" : ", optional"}`}
        >
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.label}>{topic.title}</span>
          {topic.isNext && <span className={styles.nextTag} aria-hidden="true">Next</span>}
        </Link>)}
      </div>
    </div>
    <p className={styles.hint}>Scroll sideways to see every phase. The Guided path view lists the same topics in order.</p>
    <ul className={styles.legend} aria-label="Skill map legend">
      <li><span className={styles.swatch} data-status="completed" />Done</li>
      <li><span className={styles.swatch} data-status="in_progress" />In progress</li>
      <li><span className={styles.swatch} data-status="available" />Ready</li>
      <li><span className={styles.swatch} data-status="locked" />Needs prerequisites</li>
      <li><span className={styles.routeSwatch} />Route to your next topic</li>
      <li><span className={styles.optionalSwatch} />Optional</li>
    </ul>
  </div>;
}
