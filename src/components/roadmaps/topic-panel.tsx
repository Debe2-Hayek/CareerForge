"use client";

import Link from "next/link";
import type { KeyboardEvent } from "react";
import type { ResourceType, TopicState } from "@/lib/learning/schema";
import type { TopicMark } from "@/lib/roadmaps/marks";
import type { RoadmapArea } from "@/lib/roadmaps/schema";
import type { ViewTopic } from "./client-types";
import { SidePanel } from "./side-panel";
import styles from "./roadmaps.module.css";

const typeLabel: Record<ResourceType, string> = {
  docs: "Docs", interactive: "Interactive", course: "Course", video: "Video", book: "Book", exercises: "Practice", article: "Article"
};
const kindLabel = { core: "Core", good: "Good to know", optional: "Optional" } as const;
const states: { id: TopicState | null; label: string; key: string }[] = [
  { id: null, label: "To do", key: "t" },
  { id: "in_progress", label: "Learning", key: "l" },
  { id: "completed", label: "Done", key: "d" },
  { id: "known", label: "Skip", key: "s" }
];

export function TopicPanel({ topic, sectionTitle, roadmapTitle, area, mark, readOnly, previous, next, onMark, onOpen, onClose }: {
  topic: ViewTopic; sectionTitle: string; roadmapTitle: string; area: RoadmapArea; mark: TopicMark | undefined; readOnly: boolean;
  previous: ViewTopic | null; next: ViewTopic | null;
  onMark: (state: TopicState | null) => void; onOpen: (id: string) => void; onClose: () => void;
}) {
  const current = mark?.state ?? null;
  const videos = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${topic.title} ${roadmapTitle} tutorial`)}`;

  function onKey(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "ArrowRight" && next) { event.preventDefault(); onOpen(next.id); return; }
    if (event.key === "ArrowLeft" && previous) { event.preventDefault(); onOpen(previous.id); return; }
    const state = states.find(item => item.key === event.key.toLowerCase());
    if (state && !readOnly && !(mark?.via && state.id === null)) onMark(state.id);
  }

  return <SidePanel label={sectionTitle} titleId="panel-title" contentKey={topic.id} area={area} onClose={onClose} onKey={onKey}>
    <header className={styles.panelHead}>
      <span className={styles.kind} data-kind={topic.kind}>{kindLabel[topic.kind]}</span>
      <h2 id="panel-title" tabIndex={-1}>{topic.title}</h2>
      <p>{topic.summary}</p>
    </header>

    <div className={styles.stateGroup} role="group" aria-label="Your progress on this topic">
      {states.map(state => <button key={state.label} type="button" data-state={state.id ?? "todo"} aria-pressed={current === state.id} aria-keyshortcuts={state.key.toUpperCase()}
        disabled={readOnly || (Boolean(mark?.via) && state.id === null)} onClick={() => onMark(state.id)}>{state.label}</button>)}
    </div>
    {mark?.via && <p className={styles.hint}>You already finished this in {mark.via}, so it counts here too.</p>}
    {readOnly && <p className={styles.hint}>Progress saving is temporarily unavailable.</p>}

    {topic.lesson && <section className={styles.panelBlock} aria-labelledby="panel-lesson">
      <h3 id="panel-lesson">The idea</h3>
      <p>{topic.lesson.idea}</p>
      <ul className={styles.points}>{topic.lesson.points.map(text => <li key={text}>{text}</li>)}</ul>
      <div className={styles.tryIt}><strong>Try it</strong><p>{topic.lesson.practice}</p></div>
      <details key={topic.id} className={styles.quiz}>
        <summary><span>Check yourself</span>{topic.lesson.question}</summary>
        <p>{topic.lesson.answer}</p>
      </details>
    </section>}

    <section className={styles.panelBlock} aria-labelledby="panel-learn">
      <h3 id="panel-learn">Learn it free</h3>
      <ul className={styles.resources}>
        {topic.resources.map(resource => <li key={resource.url + resource.title}>
          <a href={resource.url} target="_blank" rel="noopener noreferrer">
            <span className={styles.resourceType} data-type={resource.type}>{typeLabel[resource.type]}</span>
            <span><strong>{resource.title}</strong><small>{resource.provider}</small></span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </li>)}
        {topic.courses.map(course => <li key={course.url}>
          <a href={course.url} target="_blank" rel="noopener noreferrer">
            <span className={styles.resourceType} data-type="course">Course</span>
            <span><strong>{course.title}</strong><small>{course.by}</small></span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </li>)}
        <li><a href={videos} target="_blank" rel="noopener noreferrer">
          <span className={styles.resourceType} data-type="video">Video</span>
          <span><strong>Find videos</strong><small>YouTube search</small></span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a></li>
      </ul>
      {topic.deepDive && <Link className={styles.deepDive} href={`/learning-roadmap/${topic.deepDive.id}`}>Go deeper: {topic.deepDive.title} roadmap <span aria-hidden="true">→</span></Link>}
    </section>

    {topic.guide && <>
      <section className={styles.panelBlock} aria-labelledby="panel-why"><h3 id="panel-why">Why it matters</h3><p>{topic.guide.why}</p></section>
      {topic.guide.example && <section className={styles.panelBlock} aria-labelledby="panel-example"><h3 id="panel-example">Example</h3><pre className={styles.code} tabIndex={0}><code>{topic.guide.example}</code></pre></section>}
      <section className={styles.panelBlock} aria-labelledby="panel-practice"><h3 id="panel-practice">Practise</h3><ol>{topic.guide.exercises.map(text => <li key={text}>{text}</li>)}</ol></section>
      <section className={styles.panelBlock} aria-labelledby="panel-done"><h3 id="panel-done">You are done when</h3><ul className={styles.ticks}>{topic.guide.doneWhen.map(text => <li key={text}>{text}</li>)}</ul></section>
    </>}

    <nav className={styles.panelNav} aria-label="Topics in order">
      {previous ? <button type="button" onClick={() => onOpen(previous.id)}><small>Previous</small>{previous.title}</button> : <span />}
      {next && <button type="button" onClick={() => onOpen(next.id)}><small>Next</small>{next.title}</button>}
    </nav>
    <p className={styles.keys} aria-hidden="true"><kbd>D</kbd> done <kbd>L</kbd> learning <kbd>S</kbd> skip <kbd>←</kbd><kbd>→</kbd> move</p>
  </SidePanel>;
}
