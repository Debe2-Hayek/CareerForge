"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { ProjectProgress } from "@/lib/learning/api";
import type { ProjectState } from "@/lib/learning/schema";
import type { RoadmapArea, RoadmapProject } from "@/lib/roadmaps/schema";
import { SidePanel } from "./side-panel";
import styles from "./roadmaps.module.css";

export function ProjectPanel({ project, roadmapTitle, area, progress, readOnly, busy, onSave, onClose }: {
  project: RoadmapProject; roadmapTitle: string; area: RoadmapArea; progress: ProjectProgress | undefined; readOnly: boolean; busy: boolean;
  onSave: (state: ProjectState | null, evidenceUrl: string | null) => void; onClose: () => void;
}) {
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);
  const state = progress?.state ?? null;
  const entry = [
    project.title,
    project.summary,
    ...(project.skills.length ? [`Skills demonstrated: ${project.skills.join(", ")}`] : []),
    progress?.evidenceUrl ? `Code / demo: ${progress.evidenceUrl}` : "Code / demo: (add a public link)",
    `Context: built while following the CareerForge ${roadmapTitle} roadmap. Completion is self-reported.`
  ].join("\n");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = String(new FormData(event.currentTarget).get("evidence") ?? "").trim();
    onSave("completed", url || null);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(entry); setCopied("yes"); } catch { setCopied("failed"); }
  }

  return <SidePanel label={`${roadmapTitle} project`} titleId="panel-title" contentKey={project.id} area={area} onClose={onClose}>
    <header className={styles.panelHead}>
      <span className={styles.level} data-level={project.level}>{project.level}</span>
      <h2 id="panel-title" tabIndex={-1}>{project.title}</h2>
      <p>{project.summary}</p>
    </header>
    <section className={styles.panelBlock} aria-labelledby="project-req"><h3 id="project-req">What to build</h3><ul className={styles.ticks}>{project.requirements.map(text => <li key={text}>{text}</li>)}</ul></section>
    {project.stretch.length > 0 && <section className={styles.panelBlock} aria-labelledby="project-more"><h3 id="project-more">Go further</h3><ul className={styles.ticks}>{project.stretch.map(text => <li key={text}>{text}</li>)}</ul></section>}
    {project.skills.length > 0 && <section className={styles.panelBlock} aria-labelledby="project-skills"><h3 id="project-skills">Skills you show</h3><ul className={styles.skillTags}>{project.skills.map(text => <li key={text}>{text}</li>)}</ul></section>}

    <section className={styles.panelBlock} aria-labelledby="project-track">
      <h3 id="project-track">Your project</h3>
      {readOnly && <p className={styles.hint}>Progress saving is temporarily unavailable.</p>}
      {!readOnly && state === null && <button type="button" className="button primary" disabled={busy} onClick={() => onSave("building", null)}>Start building</button>}
      {!readOnly && state !== null && <form key={`${state}-${progress?.evidenceUrl ?? ""}`} className={styles.evidenceForm} onSubmit={submit}>
        <label>Public code or live demo (optional)
          <input name="evidence" type="url" inputMode="url" placeholder="https://github.com/you/project" defaultValue={progress?.evidenceUrl ?? ""} maxLength={300} pattern="https://.+" />
        </label>
        <div className={styles.row}>
          <button type="submit" className="button primary" disabled={busy}>{state === "completed" ? "Update link" : "Mark as built"}</button>
          <button type="button" className={styles.ghostButton} disabled={busy} onClick={() => onSave(null, null)}>{state === "completed" ? "Reopen" : "Stop"}</button>
        </div>
      </form>}
    </section>

    {state === "completed" && <section className={styles.panelBlock} aria-labelledby="project-entry">
      <h3 id="project-entry">Add it to your portfolio</h3>
      <pre className={styles.code} tabIndex={0}>{entry}</pre>
      <div className={styles.row}>
        <button type="button" className={styles.ghostButton} onClick={copy}>{copied === "yes" ? "Copied" : "Copy entry"}</button>
        <Link className={styles.ghostButton} href="/documents">Open CV &amp; Portfolio</Link>
      </div>
      <p className={styles.hint} role="status">{copied === "failed" ? "Copy failed. Select the text and copy it manually." : ""}</p>
    </section>}
  </SidePanel>;
}
