"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { resetProgress } from "./learning-client";
import styles from "./learning.module.css";

/** Two-step reset: the first click asks for confirmation, the second deletes this path's progress. */
export function ResetProgress({ courseId, courseTitle }: { courseId: string; courseTitle: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  async function reset() {
    setBusy(true);
    const result = await resetProgress(courseId);
    setBusy(false);
    setConfirming(false);
    if (!result.ok) { setMessage({ tone: "error", text: result.message }); return; }
    setMessage({ tone: "info", text: "Progress reset. Your goal and weekly plan are unchanged." });
    startTransition(() => router.refresh());
  }

  return <div className={styles.resetBox}>
    <div>
      <strong>Start over</strong>
      <p>Clear every topic and project you marked in {courseTitle}. Your goal, level and weekly hours stay as they are.</p>
    </div>
    {confirming
      ? <div className={styles.controlRow} role="group" aria-label="Confirm reset">
          <button type="button" className={styles.dangerButton} disabled={busy || pending} onClick={() => void reset()}>{busy ? "Resetting…" : "Yes, reset my progress"}</button>
          <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      : <button type="button" className={styles.secondaryButton} onClick={() => { setConfirming(true); setMessage(null); }}>Reset progress</button>}
    <p className={styles.status} data-tone={message?.tone} role="status" aria-live="polite">{message?.text ?? (confirming ? "This cannot be undone." : "")}</p>
  </div>;
}
