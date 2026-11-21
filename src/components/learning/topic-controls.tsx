"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { TopicState } from "@/lib/learning/schema";
import { saveProgress } from "./learning-client";
import styles from "./learning.module.css";

export function TopicControls({ courseId, topicId, state, doneWhen, enrolled, nextHref, nextTitle, saveDisabledReason }: {
  courseId: string;
  topicId: string;
  state: TopicState | null;
  doneWhen: string[];
  enrolled: boolean;
  nextHref: string | null;
  nextTitle: string | null;
  saveDisabledReason: string | null;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<boolean[]>(() => doneWhen.map(() => state === "completed"));
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = saving || pending;
  const canSave = enrolled && !saveDisabledReason;
  const allChecked = checked.every(Boolean);

  async function update(next: TopicState | null, success: string) {
    setSaving(true);
    setMessage({ tone: "info", text: "Saving…" });
    const result = await saveProgress({ courseId, kind: "topic", itemId: topicId, state: next });
    setSaving(false);
    if (!result.ok) { setMessage({ tone: "error", text: result.message }); return; }
    setMessage({ tone: "info", text: success });
    startTransition(() => router.refresh());
  }

  const done = state === "completed" || state === "known";
  return <section className={`${styles.block} ${styles.controls}`} aria-labelledby={`${topicId}-done-heading`}>
    <h3 id={`${topicId}-done-heading`}>How you know you understand it</h3>
    <ul className={styles.checklist}>
      {doneWhen.map((criterion, index) => <li key={criterion}>
        <label>
          <input type="checkbox" checked={checked[index]} disabled={state === "completed"} onChange={event => setChecked(current => current.map((value, position) => position === index ? event.target.checked : value))} />
          <span>{criterion}</span>
        </label>
      </li>)}
    </ul>
    {!canSave && <p className={styles.status}>{saveDisabledReason ?? "Save your roadmap to track progress on this topic."}</p>}
    {canSave && <div className={styles.controlRow}>
      {state === null && <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => update("in_progress", "Marked as in progress.")}>Start this topic</button>}
      {!done && <button type="button" className="button primary" disabled={busy || !allChecked} onClick={() => update("completed", "Topic completed. Nice work!")} aria-describedby={`${topicId}-complete-hint`}>Mark as complete</button>}
      {!done && <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => update("known", "Marked as already known. It no longer counts toward your remaining work.")}>I already know this</button>}
      {done && <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => update(null, "Topic reopened.")}>Reopen topic</button>}
    </div>}
    {canSave && !done && <p id={`${topicId}-complete-hint`} className={styles.status}>{allChecked ? "Ready to mark complete." : "Tick each criterion you can honestly meet to enable “Mark as complete”."}</p>}
    {done && <p className={styles.status}>{state === "known" ? "You marked this as already known (self-assessed). It is excluded from your progress percentage." : "Completed (self-reported). Projects and assessments provide stronger evidence."}</p>}
    <p className={styles.status} data-tone={message?.tone} role="status" aria-live="polite">{message?.text ?? ""}</p>
    {done && nextHref && nextTitle && <Link className="button primary" href={nextHref} scroll={false}>Next: {nextTitle} →</Link>}
  </section>;
}
