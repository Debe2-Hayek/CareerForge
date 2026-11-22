"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppIcon } from "@/components/app-icons";
import styles from "./workshops.module.css";

/** A side-scrolling row: swipe, scroll, Tab or use the arrows. The arrows appear only when there is more to see. */
export function LiveRow({ count, children }: { count: number; children: ReactNode }) {
  const list = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });

  useEffect(() => {
    const element = list.current;
    if (!element) return;
    const measure = () => setEdge({ start: element.scrollLeft < 8, end: element.scrollLeft + element.clientWidth > element.scrollWidth - 8 });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.addEventListener("scroll", measure, { passive: true });
    return () => { observer.disconnect(); element.removeEventListener("scroll", measure); };
  }, [count]);

  function move(direction: 1 | -1) {
    const element = list.current;
    if (!element) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollBy({ left: direction * element.clientWidth * .8, behavior: calm ? "auto" : "smooth" });
  }

  return <section className={styles.liveSection} aria-labelledby="live-sessions">
    <div className={styles.sectionHead}>
      <h2 id="live-sessions"><i className={styles.pulse} aria-hidden="true" />Live sessions</h2>
      {!(edge.start && edge.end) && <div className={styles.arrows}>
        <button type="button" aria-label="Earlier sessions" disabled={edge.start} onClick={() => move(-1)}><AppIcon name="chevron" /></button>
        <button type="button" aria-label="Later sessions" disabled={edge.end} onClick={() => move(1)}><AppIcon name="chevron" /></button>
      </div>}
    </div>
    <ul className={styles.row} ref={list} data-start={edge.start || undefined} data-end={edge.end || undefined}>{children}</ul>
  </section>;
}
