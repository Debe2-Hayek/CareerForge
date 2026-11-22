"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { z } from "zod";
import { parseWorkshops, workshopIdSchema, type Workshop } from "@/lib/workshops/types";

// What stays on this device: workshops the learner added privately, and
// bookmarks when account storage is unavailable. Stored text is untrusted: a
// damaged value is ignored instead of breaking the page.

const storedSchema = z.object({ bookmarks: z.array(z.unknown()).max(1000).catch([]), submissions: z.array(z.unknown()).max(200).catch([]) });
export type DeviceData = { bookmarks: string[]; submissions: Workshop[] };
const empty: DeviceData = { bookmarks: [], submissions: [] };
const changed = "careerforge-workshops";
const keyFor = (scope: string) => `careerforge-workshops:${scope}`;

export function parseDeviceData(raw: string | null): DeviceData {
  if (!raw || raw.length > 400_000) return empty;
  try {
    const stored = storedSchema.parse(JSON.parse(raw));
    return {
      bookmarks: [...new Set(stored.bookmarks.filter((id): id is string => workshopIdSchema.safeParse(id).success))],
      submissions: parseWorkshops(stored.submissions).workshops.filter(workshop => workshop.sourceType === "submission" && workshop.id.startsWith("local-"))
    };
  } catch { return empty; }
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(changed, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(changed, callback); };
}

export function useDeviceStore(scope: string) {
  const read = useCallback(() => { try { return localStorage.getItem(keyFor(scope)); } catch { return null; } }, [scope]);
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const data = useMemo(() => parseDeviceData(raw), [raw]);
  /** False when the browser refuses to store (private mode, full quota). */
  const update = useCallback((change: (current: DeviceData) => DeviceData): boolean => {
    try {
      localStorage.setItem(keyFor(scope), JSON.stringify(change(parseDeviceData(read()))));
      window.dispatchEvent(new Event(changed));
      return true;
    } catch { return false; }
  }, [scope, read]);
  return { data, update };
}
