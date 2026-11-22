"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import type { RoadmapArea } from "@/lib/roadmaps/schema";
import styles from "./roadmaps.module.css";

/**
 * Details in a native modal dialog docked to the side: focus is trapped and
 * restored, Escape and a click outside close it, and the roadmap stays in view.
 * `contentKey` changes when the panel shows another item while staying open.
 */
export function SidePanel({ label, titleId, contentKey, area, onClose, onKey, children }: {
  label: string; titleId: string; contentKey: string; area: RoadmapArea; onClose: () => void; onKey?: (event: KeyboardEvent) => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.scrollTop = 0;
    // Announce the item and start reading from its heading.
    dialog.querySelector<HTMLElement>(`#${titleId}`)?.focus({ preventScroll: true });
  }, [contentKey, titleId]);

  return <dialog ref={ref} className={styles.panel} data-area={area} aria-labelledby={titleId} onClose={onClose} onKeyDown={onKey}
    onClick={event => { if (event.target === ref.current) ref.current?.close(); }}>
    <div className={styles.panelInner}>
      <div className={styles.panelTop}>
        <span>{label}</span>
        <button type="button" className={styles.closeButton} onClick={() => ref.current?.close()} aria-label="Close details">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      {children}
    </div>
  </dialog>;
}
