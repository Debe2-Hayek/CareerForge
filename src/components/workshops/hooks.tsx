"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { nextTick } from "@/lib/workshops/lifecycle";
import type { Workshop } from "@/lib/workshops/types";
import { useDeviceStore } from "./device-store";

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
export function LocalTime({ iso, compact = false }: { iso: string; compact?: boolean }) {
  const mounted = useMounted();
  const date = new Date(iso);
  const options: Intl.DateTimeFormatOptions = compact
    ? { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }
    : { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZoneName: "short" };
  const label = new Intl.DateTimeFormat(mounted ? undefined : "en-GB", { ...options, ...(mounted ? {} : { timeZone: "UTC" }) }).format(date);
  return <time dateTime={iso}>{label}{mounted ? "" : compact ? " UTC" : ""}</time>;
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
