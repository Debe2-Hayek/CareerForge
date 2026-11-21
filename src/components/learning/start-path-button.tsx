"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { EnrollmentInput } from "@/lib/learning/api";
import { saveEnrollment } from "./learning-client";
import styles from "./learning.module.css";

/** Saves a previewed roadmap so progress can be tracked across devices. */
export function StartPathButton({ input, disabled }: { input: EnrollmentInput; disabled?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  async function start() {
    setSaving(true);
    setError(null);
    const result = await saveEnrollment(input);
    setSaving(false);
    if (!result.ok) { setError(result.message); return; }
    startTransition(() => router.replace(`/learning-roadmap/${input.courseId}`, { scroll: false }));
  }
  return <div>
    <button type="button" className="button primary" onClick={start} disabled={disabled || saving || pending}>
      {saving || pending ? "Saving your roadmap…" : "Save and start learning"}
    </button>
    <p className={styles.status} data-tone={error ? "error" : undefined} role="status" aria-live="polite">{error ?? ""}</p>
  </div>;
}
