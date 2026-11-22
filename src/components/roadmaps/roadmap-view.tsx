"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ProjectState, TopicState } from "@/lib/learning/schema";
import { isDone, sectionsFor, summarize, type TopicMarks } from "@/lib/roadmaps/marks";
import { resetProgress, saveEnrollment, saveProgress } from "../learning/learning-client";
import type { ProjectStates, ViewRoadmap, ViewSettings } from "./client-types";
import { ProjectPanel } from "./project-panel";
import { RoadmapMap } from "./roadmap-map";
import { TopicPanel } from "./topic-panel";
import styles from "./roadmaps.module.css";

type Open = { kind: "topic" | "project"; id: string } | null;

/** One roadmap: header, map, projects and the side panel. Changes show at once and are rolled back if saving fails. */
export function RoadmapView({ roadmap, initialMarks, initialProjects, initialTrack, started, settings, storageAvailable, initialOpen, children }: {
  roadmap: ViewRoadmap;
  initialMarks: TopicMarks;
  initialProjects: ProjectStates;
  initialTrack: string | null;
  started: boolean;
  settings: ViewSettings;
  storageAvailable: boolean;
  initialOpen: Open;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [marks, setMarks] = useState(initialMarks);
  const [projects, setProjects] = useState(initialProjects);
  const [track, setTrack] = useState(initialTrack);
  const [open, setOpen] = useState<Open>(initialOpen);
  const [inList, setInList] = useState(started);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const marksRef = useRef(marks);
  useEffect(() => { marksRef.current = marks; }, [marks]);

  const sections = useMemo(() => sectionsFor(roadmap, track), [roadmap, track]);
  const topics = useMemo(() => sections.flatMap(section => section.topics), [sections]);
  const summary = useMemo(() => summarize(sections, marks), [sections, marks]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.tone === "error" ? 8000 : 3000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => () => clearTimeout(refreshTimer.current), []);

  /** Other pages show this progress too; refresh their cached data once the learner pauses. */
  const refreshSoon = useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 1500);
  }, [router]);

  const show = useCallback((next: Open) => {
    setOpen(next);
    const url = new URL(window.location.href);
    url.search = next ? `?${next.kind}=${next.id}` : "";
    window.history.replaceState(null, "", url);
  }, []);
  const openTopic = useCallback((id: string) => show({ kind: "topic", id }), [show]);

  const mark = useCallback(async (id: string, state: TopicState | null) => {
    const before = marksRef.current[id];
    if ((before?.state ?? null) === state && !before?.via) return;
    const apply = (value: TopicMarks[string] | undefined) => setMarks(current => {
      const copy = { ...current };
      if (value) copy[id] = value; else delete copy[id];
      return copy;
    });
    apply(state ? { state, via: null } : undefined);
    const result = await saveProgress({ courseId: roadmap.id, kind: "topic", itemId: id, state });
    if (!result.ok) { apply(before); setToast({ text: result.message, tone: "error" }); return; }
    setInList(true);
    refreshSoon();
    const section = sections.find(item => item.topics.some(topic => topic.id === id));
    const core = section?.topics.filter(topic => topic.kind === "core") ?? [];
    const finished = (state === "completed" || state === "known") && core.some(topic => topic.id === id) && core.every(topic => topic.id === id || isDone(marksRef.current[topic.id]));
    if (finished && section) setToast({ text: `${section.title} complete. Nice work.`, tone: "info" });
  }, [roadmap.id, sections, refreshSoon]);

  const toggle = useCallback((id: string) => {
    const current = marksRef.current[id];
    // A topic finished in another roadmap has no row here to remove, so unticking reopens it as "learning".
    void mark(id, !isDone(current) ? "completed" : current?.via ? "in_progress" : null);
  }, [mark]);

  async function saveProject(id: string, state: ProjectState | null, evidenceUrl: string | null) {
    const before = projects[id];
    setBusy(true);
    const result = await saveProgress({ courseId: roadmap.id, kind: "project", itemId: id, state, evidenceUrl });
    setBusy(false);
    if (!result.ok) { setToast({ text: result.message, tone: "error" }); setProjects(current => ({ ...current, ...(before ? { [id]: before } : {}) })); return; }
    setProjects(current => {
      const copy = { ...current };
      if (state) copy[id] = { state, evidenceUrl }; else delete copy[id];
      return copy;
    });
    setInList(true);
    setToast({ text: state === "completed" ? "Project marked as built." : state === "building" ? "Project started." : "Project tracking removed.", tone: "info" });
    refreshSoon();
  }

  async function enroll(goalId: string, success: string | null) {
    const result = await saveEnrollment({ courseId: roadmap.id, goalId, ...settings });
    if (!result.ok) { setToast({ text: result.message, tone: "error" }); return false; }
    setInList(true);
    if (success) setToast({ text: success, tone: "info" });
    refreshSoon();
    return true;
  }

  async function chooseTrack(id: string) {
    const before = track;
    setTrack(id);
    if (storageAvailable && !(await enroll(id, null))) setTrack(before);
  }

  async function reset() {
    setBusy(true);
    const result = await resetProgress(roadmap.id);
    setBusy(false);
    setConfirmingReset(false);
    if (!result.ok) { setToast({ text: result.message, tone: "error" }); return; }
    setMarks(current => Object.fromEntries(Object.entries(current).filter(([, value]) => value.via)));
    setProjects({});
    setInList(false);
    setToast({ text: "Progress cleared.", tone: "info" });
    refreshSoon();
  }

  const topicIndex = open?.kind === "topic" ? topics.findIndex(topic => topic.id === open.id) : -1;
  const openedTopic = topicIndex >= 0 ? topics[topicIndex] : null;
  const openedProject = open?.kind === "project" ? roadmap.projects.find(project => project.id === open.id) ?? null : null;

  return <div className={styles.page} data-area={roadmap.area}>
    <nav aria-label="Breadcrumb"><Link className={styles.back} href="/learning-roadmap"><span aria-hidden="true">←</span> All roadmaps</Link></nav>
    <header className={styles.roadmapHead}>
      <h1>{roadmap.title}</h1>
      <p>{roadmap.tagline}</p>
      {!storageAvailable && <p className={styles.notice} role="status">Progress saving is temporarily unavailable, so this roadmap is read-only. Your earlier progress is safe.</p>}
      <div className={styles.progressRow}>
        <div className={styles.progress}>
          <div className={styles.bar} role="progressbar" aria-label={`${roadmap.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.percent}><span style={{ width: `${summary.percent}%` }} /></div>
          <span>{summary.done} of {summary.total} core topics done</span>
        </div>
        {summary.nextId
          ? <button type="button" className="button primary" onClick={() => openTopic(summary.nextId!)}>{summary.done || inList ? "Continue" : "Start"}: {summary.nextTitle}</button>
          : <a className="button primary" href="#projects">Build a project</a>}
        {!inList && storageAvailable && <button type="button" className={styles.ghostButton} onClick={() => void enroll(track ?? "complete", "Saved to your roadmaps.")}>Save for later</button>}
      </div>
      {roadmap.tracks.length > 0 && <div className={styles.tracks} role="group" aria-label="Choose your goal">
        <span>Your goal</span>
        {roadmap.tracks.map(item => <button key={item.id} type="button" aria-pressed={item.id === track} onClick={() => void chooseTrack(item.id)}>{item.title}</button>)}
      </div>}
      <ul className={styles.legend} aria-label="Legend">
        <li data-kind="core">Core</li><li data-kind="good">Good to know</li><li data-kind="optional">Optional</li><li data-kind="done">Done</li>
      </ul>
    </header>

    <RoadmapMap sections={sections} marks={marks} nextId={summary.nextId} readOnly={!storageAvailable} onOpen={openTopic} onToggle={toggle} />

    <section id="projects" className={styles.block} aria-labelledby="projects-heading">
      <h2 id="projects-heading" className={styles.blockTitle}>Projects for your portfolio</h2>
      <ul className={styles.projectGrid}>
        {roadmap.projects.map(project => {
          const state = projects[project.id]?.state;
          return <li key={project.id}>
            <button type="button" className={styles.projectCard} onClick={() => show({ kind: "project", id: project.id })} aria-haspopup="dialog">
              <span className={styles.projectTop}><span className={styles.level} data-level={project.level}>{project.level}</span>{state && <span className={styles.projectState}>{state === "completed" ? "Built" : "Building"}</span>}</span>
              <strong>{project.title}</strong>
              <span>{project.summary}</span>
            </button>
          </li>;
        })}
      </ul>
    </section>

    {children}

    {inList && storageAvailable && <div className={styles.reset}>
      {confirmingReset
        ? <div className={styles.row} role="group" aria-label="Confirm clearing progress">
            <span>Clear every tick in {roadmap.title}? This cannot be undone.</span>
            <button type="button" className={styles.dangerButton} disabled={busy} onClick={() => void reset()}>Yes, clear it</button>
            <button type="button" className={styles.ghostButton} disabled={busy} onClick={() => setConfirmingReset(false)}>Keep my progress</button>
          </div>
        : <button type="button" className={styles.linkButton} onClick={() => setConfirmingReset(true)}>Clear my progress on this roadmap</button>}
    </div>}

    <p className={styles.toast} role="status" aria-live="polite" data-tone={toast?.tone} data-visible={toast ? true : undefined}>{toast?.text ?? ""}</p>

    {openedTopic && <TopicPanel topic={openedTopic} roadmapTitle={roadmap.title} area={roadmap.area} mark={marks[openedTopic.id]} readOnly={!storageAvailable}
      sectionTitle={sections.find(section => section.topics.includes(openedTopic))?.title ?? roadmap.title}
      previous={topics[topicIndex - 1] ?? null} next={topics[topicIndex + 1] ?? null}
      onMark={state => void mark(openedTopic.id, state)} onOpen={openTopic} onClose={() => show(null)} />}
    {openedProject && <ProjectPanel key={openedProject.id} project={openedProject} roadmapTitle={roadmap.title} area={roadmap.area} progress={projects[openedProject.id]} readOnly={!storageAvailable} busy={busy}
      onSave={(state, url) => void saveProject(openedProject.id, state, url)} onClose={() => show(null)} />}
  </div>;
}
