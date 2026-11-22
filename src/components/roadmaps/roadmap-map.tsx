"use client";

import { isDone, type TopicMarks } from "@/lib/roadmaps/marks";
import type { ViewSection, ViewTopic } from "./client-types";
import styles from "./roadmaps.module.css";

// The roadmap itself: a vertical spine of section boxes with their topics
// branching off. It is ordinary page content (no zoom, pan or canvas): it
// scrolls like any page, and on narrow screens the branches stack under each
// section. Connector geometry depends only on the number of topics.

const ITEM = 50;
const GAP = 10;
const WIDTH = 84;
/** More topics than this are split to both sides of the spine. */
const ONE_SIDE = 6;

const statusText = { completed: "Done", known: "Already known", in_progress: "Learning" } as const;
const kindText = { core: "Core", good: "Good to know", optional: "Optional" } as const;

function Connectors({ topics, marks, side }: { topics: ViewTopic[]; marks: TopicMarks; side: "left" | "right" }) {
  const height = topics.length * (ITEM + GAP) - GAP;
  const middle = height / 2;
  return <svg className={styles.connectors} width={WIDTH} height={height} viewBox={`0 0 ${WIDTH} ${height}`} aria-hidden="true">
    {topics.map((topic, index) => {
      const y = index * (ITEM + GAP) + ITEM / 2;
      const path = side === "right"
        ? `M0 ${middle} C ${WIDTH * .55} ${middle}, ${WIDTH * .4} ${y}, ${WIDTH} ${y}`
        : `M${WIDTH} ${middle} C ${WIDTH * .45} ${middle}, ${WIDTH * .6} ${y}, 0 ${y}`;
      return <path key={topic.id} d={path} data-done={isDone(marks[topic.id]) || undefined} data-kind={topic.kind} />;
    })}
  </svg>;
}

function TopicBox({ topic, marks, next, readOnly, onOpen, onToggle }: {
  topic: ViewTopic; marks: TopicMarks; next: boolean; readOnly: boolean; onOpen: (id: string) => void; onToggle: (id: string) => void;
}) {
  const mark = marks[topic.id];
  const done = isDone(mark);
  return <li className={styles.topic} data-state={mark?.state ?? "todo"} data-kind={topic.kind} data-next={next || undefined}>
    <button type="button" className={styles.check} aria-pressed={done} disabled={readOnly} onClick={() => onToggle(topic.id)} aria-label={`Mark ${topic.title} as done`}>
      <span aria-hidden="true" />
    </button>
    <button type="button" className={styles.topicOpen} data-topic={topic.id} onClick={() => onOpen(topic.id)} aria-haspopup="dialog">
      <span className={styles.topicTitle}>{topic.title}</span>
      {next && <span className={styles.nextTag}>Next</span>}
      <span className="sr-only">. {kindText[topic.kind]}. {mark ? statusText[mark.state] : "Not started"}.</span>
    </button>
  </li>;
}

export function RoadmapMap({ sections, marks, nextId, readOnly, onOpen, onToggle }: {
  sections: ViewSection[]; marks: TopicMarks; nextId: string | null; readOnly: boolean; onOpen: (id: string) => void; onToggle: (id: string) => void;
}) {
  return <div className={styles.map}>
    <div className={styles.mapCap}>Start</div>
    <ol className={styles.sections}>
      {sections.map((section, index) => {
        const core = section.topics.filter(topic => topic.kind === "core");
        const done = core.filter(topic => isDone(marks[topic.id])).length;
        const complete = core.length > 0 && done === core.length;
        const split = section.topics.length > ONE_SIDE;
        const half = Math.ceil(section.topics.length / 2);
        const lists = split
          ? [{ side: "left" as const, topics: section.topics.slice(0, half) }, { side: "right" as const, topics: section.topics.slice(half) }]
          : [{ side: index % 2 === 0 ? "right" as const : "left" as const, topics: section.topics }];
        const note = <div className={styles.note} data-side={split ? "center" : lists[0].side === "right" ? "left" : "right"}>
          <p>{section.goal}</p>
          {section.checkpoint && <p className={styles.checkpoint}><span>Try it</span>{section.checkpoint}</p>}
        </div>;
        return <li key={section.id} className={styles.section} data-complete={complete || undefined} data-split={split || undefined}>
          <div className={styles.node}>
            <div className={styles.nodeBox}>
              <h3>{section.title}</h3>
              <span>{complete ? "Complete" : core.length ? `${done} of ${core.length}` : "Optional"}</span>
            </div>
            {split && note}
          </div>
          {!split && note}
          {lists.map(list => <div key={list.side} className={styles.branch} data-side={list.side}>
            <Connectors topics={list.topics} marks={marks} side={list.side} />
            <ul className={styles.topics}>
              {list.topics.map(topic => <TopicBox key={topic.id} topic={topic} marks={marks} next={topic.id === nextId} readOnly={readOnly} onOpen={onOpen} onToggle={onToggle} />)}
            </ul>
          </div>)}
        </li>;
      })}
    </ol>
    <div className={styles.mapCap} data-end="true">Build something real</div>
  </div>;
}
