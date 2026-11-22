import type { Workshop } from "./types";

// Everything time-dependent is derived from verified timestamps and an explicit
// "now". Source records are never rewritten, so an event that later gains a
// recording comes back as a replay on its own.

export type LifecycleState = "upcoming" | "live" | "replay" | "ended" | "anytime";

export function startOf(workshop: Workshop): number | null {
  if (workshop.format !== "Live Online" || !workshop.startDateTime) return null;
  const time = Date.parse(workshop.startDateTime);
  return Number.isFinite(time) ? time : null;
}

export function endOf(workshop: Workshop): number | null {
  const start = startOf(workshop);
  return start === null ? null : start + workshop.durationMinutes * 60_000;
}

export function lifecycleOf(workshop: Workshop, now: number): LifecycleState {
  if (workshop.format !== "Live Online") return "anytime";
  const start = startOf(workshop);
  const end = endOf(workshop);
  // A live record without a usable time can never be shown as bookable.
  if (start === null || end === null) return workshop.recordingUrl ? "replay" : "ended";
  if (now < start) return "upcoming";
  if (now < end) return "live";
  return workshop.recordingUrl ? "replay" : "ended";
}

export const isAvailable = (workshop: Workshop, now: number) => lifecycleOf(workshop, now) !== "ended";

export type CallToAction = { label: "Register" | "Join Live" | "Start Learning" | "Watch Recording"; url: string };

export function callToAction(workshop: Workshop, now: number): CallToAction {
  switch (lifecycleOf(workshop, now)) {
    case "live": return workshop.joinUrl ? { label: "Join Live", url: workshop.joinUrl } : { label: "Register", url: workshop.registrationOrWatchUrl };
    case "upcoming": return { label: "Register", url: workshop.registrationOrWatchUrl };
    case "replay":
    case "ended": return { label: "Watch Recording", url: workshop.recordingUrl ?? workshop.registrationOrWatchUrl };
    default: return { label: "Start Learning", url: workshop.registrationOrWatchUrl };
  }
}

export type Countdown = { days: number; hours: number; minutes: number; seconds: number };

/** Time left until the start, or null once it has started: never negative. */
export function countdownTo(workshop: Workshop, now: number): Countdown | null {
  const start = startOf(workshop);
  if (start === null || now >= start) return null;
  const seconds = Math.floor((start - now) / 1000);
  return { days: Math.floor(seconds / 86_400), hours: Math.floor(seconds / 3600) % 24, minutes: Math.floor(seconds / 60) % 60, seconds: seconds % 60 };
}

/**
 * How long a page may wait before its time-dependent content changes: one second
 * while a countdown shows seconds, otherwise a minute or the next start or end.
 */
export function nextTick(workshops: readonly Workshop[], now: number): number {
  let wait = 60_000;
  for (const workshop of workshops) {
    for (const boundary of [startOf(workshop), endOf(workshop)]) {
      if (boundary === null || boundary <= now) continue;
      wait = Math.min(wait, boundary - now);
    }
    const start = startOf(workshop);
    if (start !== null && start > now && start - now < 3_600_000) wait = Math.min(wait, 1000);
  }
  return Math.max(250, wait);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  if (hours >= 10) return `${Math.round(hours)} h`;
  const whole = Math.floor(hours), rest = Math.round(minutes - whole * 60);
  return rest ? `${whole} h ${rest} min` : `${whole} h`;
}
