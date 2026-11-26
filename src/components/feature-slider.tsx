"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { AppIcon } from "./app-icons";
import { setRingPlaying, useRingMode } from "./workshops/hooks";

export type Feature = {
  id: string; tab: string; title: string; text: string; points: string[]; href: string; cta: string; accent: string;
  /** A true fact about the tool, such as "90 / free roadmaps". */ stat: { value: string; label: string };
  demo: ReactNode;
};

/** How long a slide stays before the next one, while nobody is using the slider. */
const DWELL = 4500;
const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * "Everything inside": one wide slide per tool, each with a live-looking example of the tool itself.
 * A plain horizontal scroller with snap points: swipe, drag with the mouse, use the arrows, the tabs or
 * the arrow keys. It moves on by itself only while visible and untouched, and never when motion is off.
 */
export function FeatureSlider({ items }: { items: readonly Feature[] }) {
  const count = items.length;
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const [held, setHeld] = useState(false);
  const [touched, setTouched] = useState(false);
  const mode = useRingMode();
  const root = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const tabs = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; left: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  const resume = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** Where a button sent the slider: until it arrives, the slides it passes do not count as "showing". */
  const target = useRef<number | null>(null);

  const go = useCallback((index: number, smooth = true) => {
    const box = viewport.current;
    if (!box) return;
    const next = (index + count) % count;
    target.current = next;
    box.scrollTo({ left: next * box.clientWidth, behavior: smooth && !calm() ? "smooth" : "auto" });
    setActive(next);
  }, [count]);

  /** Someone used the slider: it stops moving by itself for a while. */
  const byHand = useCallback(() => {
    setTouched(true);
    clearTimeout(resume.current);
    resume.current = setTimeout(() => setTouched(false), 12000);
  }, []);
  useEffect(() => () => clearTimeout(resume.current), []);

  // Which slide is showing follows the scroll position (swipes, trackpads, drags and arrows alike).
  useEffect(() => {
    const box = viewport.current;
    if (!box) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!box.clientWidth) return;
      const at = box.scrollLeft / box.clientWidth;
      if (target.current !== null) { if (Math.abs(at - target.current) > 0.02) return; target.current = null; }
      setActive(Math.min(count - 1, Math.max(0, Math.round(at))));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    // A scroll that ends early (a resize, a new swipe) releases the target.
    const onEnd = () => { target.current = null; update(); };
    const release = () => { target.current = null; };
    box.addEventListener("scroll", onScroll, { passive: true });
    box.addEventListener("scrollend", onEnd);
    box.addEventListener("pointerdown", release);
    box.addEventListener("touchstart", release, { passive: true });
    return () => { box.removeEventListener("scroll", onScroll); box.removeEventListener("scrollend", onEnd); box.removeEventListener("pointerdown", release); box.removeEventListener("touchstart", release); cancelAnimationFrame(frame); };
  }, [count]);

  // Keep the current slide in place when the width changes (never while a slide is gliding into place).
  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => {
    const box = viewport.current;
    if (!box) return;
    let width = box.clientWidth;
    const observer = new ResizeObserver(() => {
      if (box.clientWidth === width) return;
      width = box.clientWidth;
      box.scrollTo({ left: activeRef.current * width, behavior: "auto" });
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // Only plays while on screen.
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.35 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const playing = mode === "playing" && visible && !held && !touched;
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => go(active + 1), DWELL);
    return () => clearTimeout(timer);
  }, [playing, active, go]);

  // The active tab stays in view in the (scrollable) tab row on small screens.
  useEffect(() => {
    const row = tabs.current;
    const tab = row?.children[active] as HTMLElement | undefined;
    if (!row || !tab) return;
    const left = tab.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2;
    row.scrollTo({ left, behavior: calm() ? "auto" : "smooth" });
  }, [active]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    byHand();
    go(active + (event.key === "ArrowRight" ? 1 : -1));
  }
  // Mouse drag (touch and trackpads scroll natively).
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0 || !viewport.current) return;
    drag.current = { id: event.pointerId, x: event.clientX, left: viewport.current.scrollLeft, moved: false };
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current, box = viewport.current;
    if (!state || !box || state.id !== event.pointerId) return;
    const dx = event.clientX - state.x;
    if (!state.moved && Math.abs(dx) > 6) { state.moved = true; box.setPointerCapture(event.pointerId); box.dataset.dragging = ""; byHand(); }
    if (state.moved) box.scrollLeft = state.left - dx;
  }
  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current, box = viewport.current;
    drag.current = null;
    if (!state || !box || !state.moved) return;
    delete box.dataset.dragging;
    if (box.hasPointerCapture(event.pointerId)) box.releasePointerCapture(event.pointerId);
    const dx = event.clientX - state.x;
    const from = Math.round(state.left / box.clientWidth);
    go(Math.abs(dx) > box.clientWidth * 0.12 ? from + (dx < 0 ? 1 : -1) : from);
    justDragged.current = true;
    setTimeout(() => { justDragged.current = false; }, 0);
  }

  /** A gentle 3D lean towards the mouse (a few degrees); touch and reduced motion stay flat. */
  function lean(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || calm()) return;
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--ry", `${(((event.clientX - box.left) / box.width) - .5) * 10}deg`);
    event.currentTarget.style.setProperty("--rx", `${(.5 - (event.clientY - box.top) / box.height) * 8}deg`);
  }
  function straighten(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.style.removeProperty("--rx");
    event.currentTarget.style.removeProperty("--ry");
  }

  const current = items[active];
  const canPlay = mode !== "still";
  return <div className="fs" ref={root} aria-roledescription="carousel" aria-label="CareerForge tools" style={{ "--tool": current.accent } as CSSProperties}
    onPointerEnter={event => { if (event.pointerType === "mouse") setHeld(true); }} onPointerLeave={() => setHeld(false)}
    onFocus={event => { if (event.target.matches(":focus-visible")) setHeld(true); }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false); }}>
    <div className="fs-tabs" ref={tabs} role="group" aria-label="Choose a tool">
      {items.map((item, index) => <button key={item.id} type="button" aria-current={index === active || undefined} aria-controls={`fs-slide-${item.id}`} style={{ "--tool": item.accent } as CSSProperties}
        onClick={() => { byHand(); go(index); }}>
        <span className="fs-tab-num" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{item.tab}
        {index === active && canPlay && <i key={`${active}-${playing}`} className="fs-tab-progress" data-running={playing || undefined} style={{ animationDuration: `${DWELL}ms` }} />}
      </button>)}
    </div>

    <div className="fs-viewport" ref={viewport} tabIndex={0} aria-label="Tools, use the left and right arrow keys" onKeyDown={onKeyDown}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      onTouchStart={byHand} onWheel={event => { if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) byHand(); }}
      onClickCapture={event => { if (justDragged.current) { event.preventDefault(); event.stopPropagation(); } }}>
      <ul className="fs-track">
        {items.map((item, index) => <li key={item.id} id={`fs-slide-${item.id}`} className="fs-slide" data-active={index === active || undefined} inert={index !== active || undefined}
          aria-roledescription="slide" aria-label={`${index + 1} of ${count}: ${item.title}`} style={{ "--tool": item.accent } as CSSProperties}>
          <div className="fs-copy">
            <p className="fs-index"><span>{String(index + 1).padStart(2, "0")}</span> / {String(count).padStart(2, "0")} · {item.tab}</p>
            <h3>{item.title}</h3>
            <p className="fs-text">{item.text}</p>
            <ul className="fs-points">{item.points.map(point => <li key={point}>{point}</li>)}</ul>
            <p className="fs-stat"><strong>{item.stat.value}</strong><span>{item.stat.label}</span></p>
            <Link href={item.href} className="fs-link">{item.cta} <span aria-hidden="true">→</span></Link>
          </div>
          {/* A light rises from the pad below and builds the result, which then floats and leans towards the mouse. */}
          <div className="fs-stage" onPointerMove={lean} onPointerLeave={straighten}>
            <span className="fs-beam" aria-hidden="true" />
            <span className="fs-pad" aria-hidden="true">{[0, 1, 2, 3, 4, 5, 6].map(i => <i key={i} style={{ "--i": i } as CSSProperties} />)}</span>
            <span className="fs-scan" aria-hidden="true" />
            <div className="fs-demo">{item.demo}</div>
          </div>
        </li>)}
      </ul>
    </div>

    <div className="fs-controls">
      <button type="button" className="fs-arrow" aria-label="Previous tool" onClick={() => { byHand(); go(active - 1); }}><AppIcon name="chevron" /></button>
      <p className="fs-count" aria-hidden="true"><b>{String(active + 1).padStart(2, "0")}</b> / {String(count).padStart(2, "0")}</p>
      {canPlay && <button type="button" className="fs-arrow fs-pause" aria-label={mode === "playing" ? "Stop the slides moving" : "Let the slides move"} title={mode === "playing" ? "Pause" : "Play"} onClick={() => setRingPlaying(mode !== "playing")}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d={mode === "playing" ? "M6.5 5h3.6v14H6.5z M13.9 5h3.6v14h-3.6z" : "M8 5l11 7-11 7z"} /></svg>
      </button>}
      <button type="button" className="fs-arrow" data-next aria-label="Next tool" onClick={() => { byHand(); go(active + 1); }}><AppIcon name="chevron" /></button>
    </div>
    <p className="sr-only" role="status" aria-live="polite">{touched ? `${active + 1} of ${count}: ${current.title}` : ""}</p>
  </div>;
}
