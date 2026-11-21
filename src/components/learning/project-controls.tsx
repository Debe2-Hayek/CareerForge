"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { ProjectState } from "@/lib/learning/schema";
import { saveProgress } from "./learning-client";
import styles from "./learning.module.css";

export function ProjectControls({ courseId, projectId, state, evidenceUrl, enrolled, ready, portfolioEntry }: {
  courseId: string;
  projectId: string;
  state: ProjectState | null;
  evidenceUrl: string | null;
  enrolled: boolean;
  ready: boolean;
  portfolioEntry: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = saving || pending;

  async function update(next: ProjectState | null, url: string | null, success: string) {
    setSaving(true);
    setMessage({ tone: "info", text: "Saving…" });
    const result = await saveProgress({ courseId, kind: "project", itemId: projectId, state: next, evidenceUrl: url });
    setSaving(false);
    if (!result.ok) { setMessage({ tone: "error", text: result.message }); return; }
    setMessage({ tone: "info", text: success });
    startTransition(() => router.refresh());
  }
  function submitEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = String(new FormData(event.currentTarget).get("evidence") ?? "").trim();
    void update("completed", raw || null, raw ? "Project marked as built with a public link." : "Project marked as built. Add a public link to make it stronger evidence.");
  }
  async function copy() {
    try { await navigator.clipboard.writeText(portfolioEntry); setCopied(true); } catch { setMessage({ tone: "error", text: "Copy failed. Select the text and copy it manually." }); }
  }

  if (!enrolled) return <p className={styles.status}>Save your roadmap to track this project.</p>;
  return <div className={styles.controls}>
    {state === null && <div className={styles.controlRow}>
      <button type="button" className={ready ? "button primary" : styles.secondaryButton} disabled={busy} onClick={() => update("building", null, "Project started. Follow the milestones in order.")}>
        {ready ? "Start building" : "Start anyway"}
      </button>
      {!ready && <p className={styles.status}>You have not finished every recommended topic yet; expect to look things up as you go.</p>}
    </div>}
    {state !== null && <form className={styles.evidenceForm} onSubmit={submitEvidence}>
      <label>Public repository or live demo (optional, https://)
        <input name="evidence" type="url" inputMode="url" placeholder="https://github.com/you/project" defaultValue={evidenceUrl ?? ""} maxLength={300} pattern="https://.+" />
      </label>
      <button type="submit" className="button primary" disabled={busy}>{state === "completed" ? "Update link" : "Mark as built"}</button>
      <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => update(null, null, "Project tracking removed.")}>{state === "completed" ? "Reopen" : "Stop tracking"}</button>
    </form>}
    {state === "completed" && <div className={styles.portfolioEntry}>
      <strong>Add it to your portfolio</strong>
      <p className={styles.status}>CareerForge prepared an entry from this project. Review it, then paste it into your profile&apos;s project summary or the CV &amp; Portfolio builder. Completion is self-reported; the public link is what reviewers can verify.</p>
      <pre>{portfolioEntry}</pre>
      <div className={styles.controlRow}>
        <button type="button" className={styles.secondaryButton} onClick={copy}>{copied ? "Copied" : "Copy entry"}</button>
        <Link className={styles.secondaryButton} href="/account">Add to profile projects</Link>
        <Link className={styles.secondaryButton} href="/documents">Open CV &amp; Portfolio</Link>
      </div>
    </div>}
    <p className={styles.status} data-tone={message?.tone} role="status" aria-live="polite">{message?.text ?? ""}</p>
  </div>;
}
