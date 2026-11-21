"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import styles from "./learning.module.css";

/**
 * Topic details in a native modal <dialog>: focus is trapped and restored,
 * Escape closes it, and the background roadmap keeps its scroll position.
 * The open topic lives in the URL (?topic=) so it can be bookmarked or shared
 * with yourself across devices.
 */
export function TopicDialog({ titleId, closeHref, label, children }: { titleId: string; closeHref: string; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const navigated = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function leave() {
    if (navigated.current) return;
    navigated.current = true;
    router.replace(closeHref, { scroll: false });
  }
  function close() {
    ref.current?.close();
  }

  return <dialog
    ref={ref}
    className={styles.dialog}
    aria-labelledby={titleId}
    onClose={leave}
    onClick={event => { if (event.target === ref.current) close(); }}
  >
    <div className={styles.dialogTop}>
      <span className={styles.kicker}>{label}</span>
      <button type="button" className={styles.closeButton} onClick={close} aria-label="Close topic and return to roadmap">×</button>
    </div>
    {children}
  </dialog>;
}
