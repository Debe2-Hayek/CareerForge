import { isAvailable, lifecycleOf, startOf } from "./lifecycle";
import type { RailSelection } from "./discovery";
import type { Workshop } from "./types";

// What the 3D ring shows and where each card stands. Pure, so it can be tested.

export const ringSize = 10;
const liveShare = 5;

/** Happening now, then the soonest live sessions, then the editors' order. Only checked workshops, never private ones. */
export function ringWorkshops(workshops: readonly Workshop[], rail: RailSelection, now: number): Workshop[] {
  if (rail === "saved") return [];
  const pool = workshops.filter(workshop => workshop.verificationStatus === "verified" && isAvailable(workshop, now) && (rail === "all" || workshop.category === rail));
  const isLive = (workshop: Workshop) => ["live", "upcoming"].includes(lifecycleOf(workshop, now));
  const live = pool.filter(isLive).sort((a, b) => (startOf(a) ?? 0) - (startOf(b) ?? 0) || a.id.localeCompare(b.id, "en"));
  const anytime = pool.filter(workshop => !isLive(workshop)).sort((a, b) => (a.priority ?? 500) - (b.priority ?? 500) || a.id.localeCompare(b.id, "en"));
  // Live sessions take half the ring, or more when there is nothing else to show.
  const picked = live.slice(0, Math.max(liveShare, ringSize - anytime.length));
  return [...picked, ...anytime.slice(0, ringSize - picked.length)];
}

/** Two cards cannot make a circle: they stand side by side. */
const closedFrom = 3;
export const isClosed = (count: number) => count >= closedFrom;

/** The signed distance of a card from the front, going the short way round a closed ring. */
export function offsetOf(index: number, position: number, count: number): number {
  const raw = index - position;
  if (!isClosed(count)) return raw;
  const wrapped = ((raw % count) + count) % count;
  return wrapped > count / 2 ? wrapped - count : wrapped;
}

/** The card at the front for a (possibly moving, possibly several turns along) position. */
export function frontOf(position: number, count: number): number {
  if (count === 0) return 0;
  if (!isClosed(count)) return Math.min(count - 1, Math.max(0, Math.round(position)));
  return ((Math.round(position) % count) + count) % count;
}

export type Placement = { x: number; y: number; z: number; turn: number; scale: number; dim: number; opacity: number };

/** Place on the circle, in card widths (x, z), card heights (y) and degrees. */
export function placementOf(offset: number, count: number): Placement {
  const step = isClosed(count) ? (2 * Math.PI) / count : Math.PI / 7;
  const angle = Math.max(-Math.PI, Math.min(Math.PI, offset * step));
  const radius = 0.86 / Math.sin(Math.min(step, Math.PI / 2));
  const away = (1 - Math.cos(angle)) / 2;
  const near = Math.max(0, 1 - Math.abs(offset));
  const degrees = (angle * 180) / Math.PI;
  return {
    x: radius * Math.sin(angle),
    y: -0.46 * away,
    z: radius * (Math.cos(angle) - 1),
    turn: Math.max(-58, Math.min(58, degrees * 0.8)) * (Math.abs(degrees) > 90 ? 1 - (Math.abs(degrees) - 90) / 90 : 1),
    scale: 0.78 + 0.22 * near,
    dim: Math.min(0.6, 0.12 * Math.abs(offset)),
    opacity: Math.max(0.2, Math.min(1, 1.2 - 0.2 * Math.abs(offset)))
  };
}
