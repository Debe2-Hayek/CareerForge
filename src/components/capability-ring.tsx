"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { AppIcon } from "./app-icons";
import { Picture } from "./workshops/picture";
import { setRingPlaying, useRingMode } from "./workshops/hooks";
import type { PictureKey } from "@/data/workshops/pictures";
import { frontOf, offsetOf, placementOf } from "@/lib/workshops/ring";

export type Capability = {
  id: string; title: string; text: string; href: string; cta: string; accent: string;
  /** A CC0 photo from /public/media/workshops. */ photo: PictureKey;
  /** A true fact about the tool, such as "90 / free roadmaps". */ stat: { value: string; label: string };
  viz: ReactNode;
};

const round = (value: number) => Math.round(value * 1000) / 1000;
/**
 * Where a card stands. Only transform and opacity change while the ring moves: both are
 * handled by the compositor, so the cards' contents are never restyled frame by frame.
 */
function placeOf(offset: number, count: number) {
  const at = placementOf(offset, count);
  return {
    transform: `translate(-50%, -50%) translate3d(calc(var(--w) * ${round(at.x)}), ${round(at.y * 100)}%, calc(var(--w) * ${round(at.z)})) rotateY(${round(at.turn)}deg) scale(${round(at.scale)})`,
    opacity: String(round(at.opacity)),
    dim: String(round(at.dim))
  };
}

/** How long a tool stays at the front, and how long the ring waits after someone turns it. */
const dwell = 3200, rest = 8000;
const brisk = 9, soft = 3.6;
const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * "Everything inside": the homepage tools on a 3D ring, the same motion as the workshops ring.
 * It turns by itself, stops under the cursor or keyboard focus, and can be dragged, swiped,
 * scrolled with the mouse wheel, or turned with the arrow keys.
 */
export function CapabilityRing({ items }: { items: readonly Capability[] }) {
  const count = items.length;
  const [front, setFront] = useState(0);
  const [moved, setMoved] = useState(false);
  const mode = useRingMode();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [resting, setResting] = useState(false);
  const [seen, setSeen] = useState(false);
  const restTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const section = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const shades = useRef<(HTMLSpanElement | null)[]>([]);
  const motion = useRef({ position: 0, target: 0, frame: 0, last: 0, dragging: false, rate: brisk });
  const drag = useRef<{ id: number; x: number; y: number; from: number; lastX: number; lastTime: number; speed: number; active: boolean } | null>(null);
  const justDragged = useRef(false);

  const paint = useCallback(() => {
    const { position } = motion.current;
    [...(list.current?.children ?? [])].forEach((item, index) => {
      const place = placeOf(offsetOf(index, position, count), count);
      const style = (item as HTMLElement).style;
      style.transform = place.transform;
      style.opacity = place.opacity;
      const shade = shades.current[index];
      if (shade) shade.style.opacity = place.dim;
    });
    setFront(frontOf(position, count));
  }, [count]);

  const glide = useCallback(() => {
    const state = motion.current;
    if (state.frame) return;
    if (calm()) { state.position = state.target; paint(); return; }
    state.last = performance.now();
    const step = (time: number) => {
      const elapsed = Math.min(.05, (time - state.last) / 1000);
      state.last = time;
      if (!state.dragging) state.position += (state.target - state.position) * (1 - Math.exp(-elapsed * state.rate));
      const settled = !state.dragging && Math.abs(state.target - state.position) < .0015;
      if (settled) state.position = state.target;
      paint();
      state.frame = settled ? 0 : requestAnimationFrame(step);
    };
    state.frame = requestAnimationFrame(step);
  }, [paint]);

  const byHand = useCallback(() => {
    motion.current.rate = brisk;
    setMoved(true);
    setResting(true);
    clearTimeout(restTimer.current);
    restTimer.current = setTimeout(() => setResting(false), rest);
  }, []);
  const go = useCallback((steps: number) => { byHand(); motion.current.target = Math.round(motion.current.target) + steps; glide(); }, [byHand, glide]);
  const bring = useCallback((index: number) => {
    const state = motion.current;
    state.target = Math.round(state.target) + Math.round(offsetOf(index, Math.round(state.target), count));
    byHand();
    glide();
  }, [byHand, count, glide]);
  const setShade = useCallback((index: number, element: HTMLSpanElement | null) => { shades.current[index] = element; }, []);

  useEffect(() => () => clearTimeout(restTimer.current), []);

  // Off screen or in a hidden tab there is nobody to move for.
  useEffect(() => {
    const element = section.current;
    if (!element) return;
    let onScreen = false;
    const update = () => setSeen(onScreen && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; update(); }, { threshold: .2 });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, []);

  // Before the ring scrolls into view, fetch and decode every photo, so its first sweep does not
  // stop to decode pictures.
  useEffect(() => {
    const element = section.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      element.querySelectorAll("img").forEach(image => { image.loading = "eager"; image.decode?.().catch(() => undefined); });
    }, { rootMargin: "900px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const canPlay = mode !== "still";
  const running = canPlay && mode === "playing" && seen && !hovered && !focused && !resting;
  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => {
      if (list.current?.querySelector("li:hover")) { setHovered(true); return; }
      const state = motion.current;
      state.rate = soft;
      state.target = Math.round(state.target) + 1;
      setMoved(false);
      glide();
    }, dwell);
    return () => clearTimeout(timer);
  }, [running, front, glide]);

  // The ring sweeps into place the first time it comes into view.
  const arrived = useRef(false);
  useEffect(() => {
    if (!seen || arrived.current) return;
    arrived.current = true;
    if (!calm()) { motion.current.position = -1.2; motion.current.rate = 6; glide(); }
  }, [seen, glide]);
  useEffect(() => {
    const state = motion.current;
    return () => { cancelAnimationFrame(state.frame); state.frame = 0; };
  }, []);

  // The mouse wheel turns one card at a time while the pointer is over the ring. Going down
  // past the last card, or up past the first, lets the page scroll on, so nobody gets stuck.
  useEffect(() => {
    const element = stage.current;
    if (!element || count < 2) return;
    let gathered = 0, lastStep = 0, lastEvent = 0;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      const sideways = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      const delta = (sideways ? event.deltaX : event.deltaY) * (event.deltaMode === 1 ? 32 : event.deltaMode === 2 ? 400 : 1);
      if (!delta) return;
      const here = frontOf(motion.current.target, count);
      if (!sideways && (delta > 0 ? here >= count - 1 : here <= 0) && event.timeStamp - lastStep > 420) return;
      event.preventDefault();
      if (event.timeStamp - lastEvent > 220) gathered = 0;
      lastEvent = event.timeStamp;
      if (event.timeStamp - lastStep < 170) return;
      gathered += delta;
      if (Math.abs(gathered) < 30) return;
      go(Math.sign(gathered));
      gathered = 0;
      lastStep = event.timeStamp;
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [count, go]);

  function onKeyDown(event: KeyboardEvent) {
    const move = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (move) go(move);
    else if (event.key === "Home") bring(0);
    else if (event.key === "End") bring(count - 1);
    else return;
    event.preventDefault();
  }
  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    justDragged.current = false;
    if (event.pointerType !== "mouse") byHand();
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, from: motion.current.position, lastX: event.clientX, lastTime: event.timeStamp, speed: 0, active: false };
  }
  function onPointerMove(event: PointerEvent) {
    const held = drag.current;
    if (!held || held.id !== event.pointerId) return;
    const dx = event.clientX - held.x;
    if (!held.active) {
      if (Math.abs(dx) < 7 || Math.abs(dx) < Math.abs(event.clientY - held.y)) return;
      held.active = true;
      motion.current.dragging = true;
      stage.current?.setPointerCapture(event.pointerId);
      glide();
    }
    const width = (list.current?.firstElementChild as HTMLElement | null)?.offsetWidth ?? 320;
    const elapsed = Math.max(1, event.timeStamp - held.lastTime);
    held.speed = .6 * held.speed + .4 * ((event.clientX - held.lastX) / width / elapsed);
    held.lastX = event.clientX;
    held.lastTime = event.timeStamp;
    motion.current.position = held.from - dx / (width * .62);
    if (calm()) paint();
  }
  function onPointerUp(event: PointerEvent) {
    const held = drag.current;
    if (!held || held.id !== event.pointerId) return;
    drag.current = null;
    if (!held.active) return;
    justDragged.current = true;
    const state = motion.current;
    state.dragging = false;
    state.target = Math.round(state.position - Math.max(-2, Math.min(2, held.speed * 320)));
    byHand();
    glide();
    setTimeout(() => { justDragged.current = false; }, 0);
  }
  /** The cursor on a card stops the ring at once: a move in progress settles on the nearest card. */
  function hover(on: boolean) {
    setHovered(on);
    const state = motion.current;
    if (!on || state.rate !== soft || state.dragging) return;
    state.rate = brisk;
    state.target = Math.round(state.position);
    glide();
  }
  const lean = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse" || drag.current?.active || calm()) return;
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--lean-x", `${round(((event.clientX - box.left) / box.width - .5) * 8)}deg`);
    event.currentTarget.style.setProperty("--lean-y", `${round((.5 - (event.clientY - box.top) / box.height) * 6)}deg`);
  }, []);

  const current = items[front];
  if (!current) return null;
  return <div className="cap-ring" ref={section} data-seen={seen || undefined} aria-roledescription="carousel" aria-label="CareerForge tools" onKeyDown={onKeyDown} style={{ "--tool": current.accent } as CSSProperties}
    onFocus={event => { if (event.target.matches(":focus-visible")) setFocused(true); }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <span className="cap-ring-floor" aria-hidden="true" />
    <button type="button" className="cap-ring-arrow" aria-label="Previous tool" onClick={() => go(-1)}><AppIcon name="chevron" /></button>
    <button type="button" className="cap-ring-arrow" data-next aria-label="Next tool" onClick={() => go(1)}><AppIcon name="chevron" /></button>
    <div className="cap-ring-stage" ref={stage} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      onClickCapture={event => { if (justDragged.current) { event.preventDefault(); event.stopPropagation(); } }}>
      <ul className="cap-ring-list" ref={list} onPointerOver={event => { if (event.pointerType === "mouse") hover((event.target as Element).closest("li") !== null); }} onPointerLeave={() => hover(false)}>
        {items.map((item, index) => <RingCard key={item.id} item={item} index={index} count={count} isFront={index === front} bring={bring} lean={lean} setShade={setShade} />)}
      </ul>
    </div>
    <div className="cap-ring-controls">
      {canPlay && <button type="button" className="cap-ring-pause" aria-label={mode === "playing" ? "Pause the moving tools" : "Let the tools move"} title={mode === "playing" ? "Pause" : "Play"} onClick={() => setRingPlaying(mode !== "playing")}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d={mode === "playing" ? "M6.5 5h3.6v14H6.5z M13.9 5h3.6v14h-3.6z" : "M8 5l11 7-11 7z"} /></svg>
      </button>}
      <ol className="cap-ring-dots" aria-label="Choose a tool">
        {items.map((item, index) => <li key={item.id}><button type="button" aria-label={item.title} aria-current={index === front || undefined} onClick={() => bring(index)}>
          {index === front && canPlay && <i key={`${front}-${running}`} data-running={running || undefined} />}
        </button></li>)}
      </ol>
      <p className="cap-ring-hint" aria-hidden="true">Scroll, drag or use ← →</p>
    </div>
    <p className="sr-only" role="status" aria-live="polite">{moved ? `${front + 1} of ${count}: ${current.title}` : ""}</p>
  </div>;
}

function straighten(event: PointerEvent<HTMLElement>) {
  event.currentTarget.style.removeProperty("--lean-x");
  event.currentTarget.style.removeProperty("--lean-y");
}

type CardProps = { item: Capability; index: number; count: number; isFront: boolean; bring: (index: number) => void; lean: (event: PointerEvent<HTMLElement>) => void; setShade: (index: number, element: HTMLSpanElement | null) => void };
/** One card. Memoised: when another card reaches the front, only the old and the new front cards render again. */
const RingCard = memo(function RingCard({ item, index, count, isFront, bring, lean, setShade }: CardProps) {
  const place = placeOf(offsetOf(index, 0, count), count);
  return <li className="cap-ring-item" data-front={isFront || undefined} aria-hidden={!isFront || undefined} style={{ transform: place.transform, opacity: place.opacity, "--tool": item.accent } as CSSProperties}>
    <article className="cap-card" onPointerMove={isFront ? lean : undefined} onPointerLeave={straighten} onClickCapture={isFront ? undefined : event => { event.preventDefault(); event.stopPropagation(); bring(index); }}>
      <div className="cap-card-media">
        <Picture name={item.photo} sizes="(max-width: 760px) 76vw, 340px" eager={index < 2 || index === count - 1} />
        <p className="cap-card-index"><span>{String(index + 1).padStart(2, "0")}</span> / {String(count).padStart(2, "0")}</p>
        <p className="cap-card-stat"><strong>{item.stat.value}</strong><span>{item.stat.label}</span></p>
        <div className="cap-card-viz">{item.viz}</div>
      </div>
      <div className="cap-card-text">
        <h3>{item.title}</h3>
        <p>{item.text}</p>
        <Link href={item.href} className="cap-card-link" tabIndex={isFront ? undefined : -1}>{item.cta} <span aria-hidden="true">→</span></Link>
      </div>
      <span className="cap-card-shade" aria-hidden="true" ref={element => setShade(index, element)} style={{ opacity: place.dim }} />
    </article>
  </li>;
});
