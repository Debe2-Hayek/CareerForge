// Client-safe labels and freshness helpers for catalog listings.

export const regionLabels = {
  lebanon: "Lebanon",
  mena: "Middle East & North Africa",
  worldwide: "Worldwide remote",
  international: "Remote, open to Lebanon"
} as const;
export type RegionKey = keyof typeof regionLabels;

/** Experience levels, lowest first. Demo roles are entry level. */
export const levelLabels = {
  internship: "Internship",
  entry: "Entry level",
  mid: "Mid level",
  senior: "Senior",
  lead: "Lead / executive"
} as const;
export type LevelKey = keyof typeof levelLabels;

export const sourceLabels: Record<string, string> = { himalayas: "Himalayas", greenhouse: "Greenhouse", workable: "Workable", fictional: "Demo" };

/** Live rows stop counting as current after expiry or 7 days without a refresh (mirrors the database policy). */
export const freshnessWindowMs = 7 * 24 * 60 * 60 * 1000;
export function isCurrentListing(job: { isActive: boolean; isFictional: boolean; expiresAt?: string | null; fetchedAt?: string | null }, now = Date.now()) {
  if (!job.isActive) return false;
  if (job.isFictional) return true;
  if (job.expiresAt && Date.parse(job.expiresAt) <= now) return false;
  return !!job.fetchedAt && now - Date.parse(job.fetchedAt) < freshnessWindowMs;
}

export function relativeDays(iso: string | null | undefined, now = Date.now()): string | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return null;
  const days = Math.floor((now - time) / 86_400_000);
  if (days < 0) return null;
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months} month${months === 1 ? "" : "s"} ago` : "over a year ago";
}
