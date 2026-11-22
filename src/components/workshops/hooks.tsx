"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { nextTick } from "@/lib/workshops/lifecycle";
import type { Workshop } from "@/lib/workshops/types";
import { useDeviceStore } from "./device-store";
import styles from "./workshops.module.css";

const never = () => () => {};
export const useMounted = () => useSyncExternalStore(never, () => true, () => false);

/**
 * The current time, updated only when something on the page can change: each
 * second during a close countdown, otherwise at the next minute, start or end.
 */
export function useNow(workshops: readonly Workshop[], initial: number): number {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      clearTimeout(timer);
      // Hidden tabs do not need to keep time; they catch up when shown again.
      if (!document.hidden) timer = setTimeout(tick, nextTick(workshops, current));
    };
    timer = setTimeout(tick, 0);
    document.addEventListener("visibilitychange", tick);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", tick); };
  }, [workshops]);
  return now;
}

/** A moment in the learner's own time zone; UTC until the browser's zone is known. */
export function LocalTime({ iso, compact = false, withDay = true }: { iso: string; compact?: boolean; /** False beside a DateTile, which already shows the day. */ withDay?: boolean }) {
  const mounted = useMounted();
  const date = new Date(iso);
  const options: Intl.DateTimeFormatOptions = compact
    ? { weekday: "short", ...(withDay ? { day: "numeric", month: "short" } as const : {}), hour: "numeric", minute: "2-digit" }
    : { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZoneName: "short" };
  const label = new Intl.DateTimeFormat(mounted ? undefined : "en-GB", { ...options, ...(mounted ? {} : { timeZone: "UTC" }) }).format(date);
  return <time dateTime={iso}>{label}{mounted ? "" : compact ? " UTC" : ""}</time>;
}

/** The day as a small calendar leaf, in the learner's own time zone. */
export function DateTile({ iso }: { iso: string }) {
  const mounted = useMounted();
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(mounted ? undefined : "en-GB", { ...options, ...(mounted ? {} : { timeZone: "UTC" }) }).format(new Date(iso));
  return <time className={styles.dateTile} dateTime={iso}><b>{format({ month: "short" })}</b> <strong>{format({ day: "numeric" })}</strong></time>;
}

// The ring moves by itself unless the learner paused it, turned the site's motion off, or asked their device for less motion.
const ringKey = "careerforge-ring", motionKey = "careerforge-motion", reducedQuery = "(prefers-reduced-motion: reduce)";
let pausedHere = false;
export type RingMode = "playing" | "paused" | "still";
function readRingMode(): RingMode {
  if (window.matchMedia(reducedQuery).matches) return "still";
  try {
    if (localStorage.getItem(motionKey) === "off") return "still";
    return (localStorage.getItem(ringKey) ?? (pausedHere ? "off" : "on")) === "off" ? "paused" : "playing";
  } catch { return pausedHere ? "paused" : "playing"; }
}
function subscribeRing(callback: () => void) {
  const query = window.matchMedia(reducedQuery);
  query.addEventListener("change", callback);
  for (const name of ["storage", ringKey, motionKey]) window.addEventListener(name, callback);
  return () => {
    query.removeEventListener("change", callback);
    for (const name of ["storage", ringKey, motionKey]) window.removeEventListener(name, callback);
  };
}
export const useRingMode = () => useSyncExternalStore<RingMode>(subscribeRing, readRingMode, () => "still");
export function setRingPlaying(playing: boolean) {
  pausedHere = !playing;
  try { localStorage.setItem(ringKey, playing ? "on" : "off"); } catch { /* kept for this page only */ }
  window.dispatchEvent(new Event(ringKey));
}

export type Notify = (text: string, tone?: "info" | "error") => void;

/** Account bookmarks when available, otherwise this device. Changes show at once and roll back if saving fails. */
export function useBookmarks(initial: string[] | null, scope: string, notify: Notify) {
  const device = useDeviceStore(scope);
  const [account, setAccount] = useState<ReadonlySet<string>>(() => new Set(initial ?? []));
  const usesAccount = initial !== null;
  const saved = useMemo(() => new Set([...account, ...device.data.bookmarks]), [account, device.data.bookmarks]);

  const toggle = useCallback(async (id: string, title: string) => {
    const save = !saved.has(id);
    const onDevice = !usesAccount || id.startsWith("local-") || (!save && !account.has(id));
    if (onDevice) {
      const stored = device.update(current => ({ ...current, bookmarks: save ? [...new Set([...current.bookmarks, id])] : current.bookmarks.filter(item => item !== id) }));
      notify(stored ? (save ? `Saved: ${title}` : `Removed: ${title}`) : "This browser is not allowing CareerForge to save. Check its storage settings.", stored ? "info" : "error");
      return;
    }
    const change = (add: boolean) => setAccount(current => {
      const next = new Set(current);
      if (add) next.add(id); else next.delete(id);
      return next;
    });
    change(save);
    let message = "You appear to be offline. Your change was not saved.";
    try {
      const response = await fetch("/api/v1/workshops/bookmarks", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workshopId: id, saved: save }) });
      if (response.ok) { notify(save ? `Saved: ${title}` : `Removed: ${title}`); return; }
      const payload: unknown = await response.json().catch(() => null);
      message = payload && typeof payload === "object" && "error" in payload && payload.error && typeof payload.error === "object" && "message" in payload.error ? String(payload.error.message) : "Your change could not be saved. Please retry.";
    } catch { /* message already describes the failure */ }
    change(!save);
    notify(message, "error");
  }, [saved, usesAccount, account, device, notify]);

  return { saved, toggle, usesAccount, device };
}
