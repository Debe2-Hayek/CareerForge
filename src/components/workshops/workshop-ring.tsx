"use client";

import { memo, useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { AppIcon } from "@/components/app-icons";
import { pictureFor } from "@/data/workshops/pictures";
import { lifecycleOf } from "@/lib/workshops/lifecycle";
import { frontOf, isClosed, offsetOf, placementOf } from "@/lib/workshops/ring";
import type { Workshop } from "@/lib/workshops/types";
import { DateTile, LocalTime, setRingPlaying, useRingMode } from "./hooks";
import { Picture } from "./picture";
import { ActionLink, areaOf, BookmarkButton, CountdownClock, Difficulty, durationLabel, FormatLabel, topicIcon } from "./workshop-card";
import styles from "./workshops.module.css";

const round = (value: number) => Math.round(value * 1000) / 1000;
/**
 * Written to the style attribute, so the first paint from the server is already a ring. Only
 * transform and opacity change while it moves (the dimming is one shade's opacity), so nothing
 * inside a card is restyled frame by frame.
 */
function placeOf(offset: number, count: number) {
  const at = placementOf(offset, count);
  return {
    transform: `translate(-50%, -50%) translate3d(calc(var(--w) * ${round(at.x)}), ${round(at.y * 100)}%, calc(var(--w) * ${round(at.z)})) rotateY(${round(at.turn)}deg) scale(${round(at.scale)})`,
    opacity: String(round(at.opacity)),
    dim: String(round(at.dim))
  };
}

/** How long a workshop stays at the front, and how long the ring leaves the learner alone after they turn it. */
const dwell = 4200, rest = 9000;
/** How quickly the ring settles: brisk when turned by hand, soft when it moves by itself. */
const brisk = 8.5, soft = 3.4;

const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Workshops on a 3D ring. The position is a number that glides towards a whole
 * card; each frame only writes transforms, and React re-renders when another card
 * reaches the front. It moves on by itself, and waits while anyone is using it.
 */
export function WorkshopRing({ workshops, now, saved, held, onOpen, onToggle }: { workshops: readonly Workshop[]; now: number; saved: ReadonlySet<string>; /** Something else has the learner's attention. */ held: boolean; onOpen: (id: string) => void; onToggle: (workshop: Workshop) => void }) {
  const count = workshops.length;
  const [front, setFront] = useState(0);
  /** Turned by hand, so the new workshop is announced. Automatic moves are silent. */
  const [moved, setMoved] = useState(false);
  const mode = useRingMode();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [resting, setResting] = useState(false);
  const [seen, setSeen] = useState(false);
  const restTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const shades = useRef<(HTMLSpanElement | null)[]>([]);
  const motion = useRef({ position: 0, target: 0, frame: 0, last: 0, dragging: false, rate: brisk });
  const drag = useRef<{ id: number; x: number; y: number; from: number; lastX: number; lastTime: number; speed: number; active: boolean } | null>(null);
  const justDragged = useRef(false);
  const active = Math.min(front, Math.max(0, count - 1));

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

  const limit = useCallback((target: number) => isClosed(count) ? target : Math.min(count - 1, Math.max(0, target)), [count]);
  /** Every turn by hand ends here: announce it, and leave the ring alone for a while. */
  const byHand = useCallback(() => {
    motion.current.rate = brisk;
    setMoved(true);
    setResting(true);
    clearTimeout(restTimer.current);
    restTimer.current = setTimeout(() => setResting(false), rest);
  }, []);
  const go = useCallback((steps: number) => {
    const state = motion.current;
    byHand();
    const next = state.target + steps;
    // The arrows go round and round, even where the cards stand on an open curve.
    state.target = isClosed(count) ? next : ((next % count) + count) % count;
    glide();
  }, [byHand, count, glide]);
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
    const observer = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; update(); }, { threshold: .4 });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, []);

  const canPlay = mode !== "still" && isClosed(count);
  const running = canPlay && mode === "playing" && seen && !hovered && !focused && !resting && !held;
  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => {
      const state = motion.current;
      // Never pull a workshop from under the cursor, even one that arrived without moving.
      if (list.current?.querySelector("li:hover")) { setHovered(true); return; }
      state.rate = soft;
      state.target = Math.round(state.target) + 1;
      setMoved(false);
      glide();
    }, dwell);
    return () => clearTimeout(timer);
  }, [running, active, glide]);

  // The ring turns into place once when it first appears.
  useEffect(() => {
    const state = motion.current;
    if (!calm() && count > 2) { state.position = -1.4; glide(); } else paint();
    return () => { cancelAnimationFrame(state.frame); state.frame = 0; };
  }, [count, glide, paint]);

  // The wheel turns one card at a time while the mouse is over the ring. Past the first or last card the page scrolls on.
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
      if (event.timeStamp - lastStep < 190) return;
      gathered += delta;
      if (Math.abs(gathered) < 36) return;
      if (sideways || (delta > 0 ? here < count - 1 : here > 0)) go(Math.sign(gathered));
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
    if (event.button !== 0 || count < 2) return;
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
    const width = (list.current?.firstElementChild as HTMLElement | null)?.offsetWidth ?? 400;
    const elapsed = Math.max(1, event.timeStamp - held.lastTime);
    held.speed = .6 * held.speed + .4 * ((event.clientX - held.lastX) / width / elapsed);
    held.lastX = event.clientX;
    held.lastTime = event.timeStamp;
    const wanted = held.from - dx / (width * .62);
    motion.current.position = isClosed(count) ? wanted : Math.min(count - .7, Math.max(-.3, wanted));
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
    state.target = limit(Math.round(state.position - Math.max(-2, Math.min(2, held.speed * 320))));
    byHand();
    glide();
    // The click that ends a drag is ignored; the next one counts again.
    setTimeout(() => { justDragged.current = false; }, 0);
  }
  /** The cursor on a workshop stops the ring at once: a move in progress settles on the nearest workshop. */
  function hover(on: boolean) {
    setHovered(on);
    const state = motion.current;
    if (!on || state.rate !== soft || state.dragging) return;
    state.rate = brisk;
    state.target = Math.round(state.position);
    glide();
  }
  /** The front card leans a little towards the mouse. */
  const lean = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse" || drag.current?.active || calm()) return;
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--lean-x", `${round(((event.clientX - box.left) / box.width - .5) * 7)}deg`);
    event.currentTarget.style.setProperty("--lean-y", `${round((.5 - (event.clientY - box.top) / box.height) * 5)}deg`);
  }, []);

  const current = workshops[active];
  if (!current) return null;
  return <section className={styles.ring} data-area={areaOf[current.category]} aria-roledescription="carousel" aria-labelledby="ring-title" ref={section} onKeyDown={onKeyDown}
    onFocus={event => { if (event.target.matches(":focus-visible")) setFocused(true); }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <h2 id="ring-title" className="sr-only">Featured workshops</h2>
    {count > 1 && <div className={styles.ringControls}>
      {canPlay && <button type="button" className={styles.ringPause} aria-label={mode === "playing" ? "Pause the moving workshops" : "Let the workshops move"} title={mode === "playing" ? "Pause" : "Play"} onClick={() => setRingPlaying(mode !== "playing")}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d={mode === "playing" ? "M6.5 5h3.6v14H6.5z M13.9 5h3.6v14h-3.6z" : "M8 5l11 7-11 7z"} /></svg>
      </button>}
      {canPlay && <span className={styles.ringTrack} aria-hidden="true"><i key={`${active}-${running}`} data-running={running || undefined} /></span>}
      <p>{active + 1} of {count}</p>
    </div>}
    {/* For the keyboard and screen readers; seen only when reached with Tab. */}
    {count > 1 && <button type="button" className={styles.ringArrow} aria-label="Previous workshop" onClick={() => go(-1)}><AppIcon name="chevron" /></button>}
    {count > 1 && <button type="button" className={styles.ringArrow} data-next aria-label="Next workshop" onClick={() => go(1)}><AppIcon name="chevron" /></button>}
    <div className={styles.ringStage} ref={stage} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      onClickCapture={event => { if (justDragged.current) { event.preventDefault(); event.stopPropagation(); } }}>
      <ul className={styles.ringList} ref={list} onPointerOver={event => { if (event.pointerType === "mouse") hover((event.target as Element).closest("li") !== null); }} onPointerLeave={() => hover(false)}>
        {workshops.map((workshop, index) => <RingCard key={workshop.id} workshop={workshop} index={index} count={count} isFront={index === active} now={now} saved={saved.has(workshop.id)} onOpen={onOpen} onToggle={onToggle} bring={bring} lean={lean} setShade={setShade} />)}
      </ul>
    </div>
    <p className="sr-only" role="status" aria-live="polite">{moved ? `${active + 1} of ${count}: ${current.title}` : ""}</p>
  </section>;
}

function straighten(event: PointerEvent<HTMLElement>) {
  event.currentTarget.style.removeProperty("--lean-x");
  event.currentTarget.style.removeProperty("--lean-y");
}

type CardProps = {
  workshop: Workshop; index: number; count: number; isFront: boolean; now: number; saved: boolean;
  onOpen: (id: string) => void; onToggle: (workshop: Workshop) => void; bring: (index: number) => void;
  lean: (event: PointerEvent<HTMLElement>) => void; setShade: (index: number, element: HTMLSpanElement | null) => void;
};
/** One workshop card. Memoised: when another card reaches the front, only the old and the new front cards render again. */
const RingCard = memo(function RingCard({ workshop, index, count, isFront, now, saved, onOpen, onToggle, bring, lean, setShade }: CardProps) {
  const state = lifecycleOf(workshop, now);
  const place = placeOf(offsetOf(index, 0, count), count);
  return <li className={styles.ringItem} data-front={isFront || undefined} data-area={areaOf[workshop.category]} style={{ transform: place.transform, opacity: place.opacity } as CSSProperties}>
    <div className={styles.ringCard} onPointerMove={isFront ? lean : undefined} onPointerLeave={straighten}>
      <Picture name={pictureFor(workshop)} sizes="(max-width: 760px) 84vw, 560px" eager={index < 3 || index === count - 1} />
      {state === "upcoming" && <DateTile iso={workshop.startDateTime!} />}
      {isFront && <BookmarkButton saved={saved} title={workshop.title} onToggle={() => onToggle(workshop)} />}
      <div className={styles.ringText}>
        <p className={styles.ringLabel}><span><AppIcon name={topicIcon[workshop.category]} />{workshop.category}</span><FormatLabel workshop={workshop} now={now} withDay={false} /></p>
        <h3>
          {isFront
            ? <button type="button" data-workshop={workshop.id} aria-haspopup="dialog" onClick={() => onOpen(workshop.id)}>{workshop.title}</button>
            : <button type="button" tabIndex={-1} aria-label={`Bring to the front: ${workshop.title}`} onClick={() => bring(index)}>{workshop.title}</button>}
        </h3>
        {isFront && <div className={styles.ringMore}>
          <p className={styles.ringHook}>{workshop.outcomeHook}</p>
          <p className={styles.meta}><Difficulty workshop={workshop} /><span>{durationLabel(workshop)}</span><span>{workshop.priceType}</span><span>{workshop.instructorOrHost}</span></p>
          <div className={styles.ringActions}>
            <ActionLink workshop={workshop} now={now} primary />
            {state === "upcoming" && <CountdownClock workshop={workshop} now={now} />}
            {state === "upcoming" && <p className="sr-only"><LocalTime iso={workshop.startDateTime!} /></p>}
          </div>
        </div>}
      </div>
      <span className={styles.ringShade} aria-hidden="true" ref={element => setShade(index, element)} style={{ opacity: place.dim }} />
    </div>
  </li>;
});
