import { isAvailable, lifecycleOf, startOf } from "./lifecycle";
import { workshopDifficulties, type Workshop, type WorkshopCategory, type WorkshopDifficulty, type WorkshopFormat } from "./types";

// Pure search, filtering, ordering and spotlight rules.

export const sortOptions = ["relevant", "soon", "shortest", "beginner"] as const;
export type WorkshopSort = (typeof sortOptions)[number];
export const sortLabels: Record<WorkshopSort, string> = { relevant: "Most Relevant", soon: "Starting Soon", shortest: "Shortest Duration", beginner: "Beginner First" };

export type RailSelection = "all" | "saved" | WorkshopCategory;

export type DiscoveryFilters = {
  query: string;
  difficulty: WorkshopDifficulty | null;
  format: WorkshopFormat | null;
  freeOnly: boolean;
  sort: WorkshopSort;
};
export const defaultFilters: DiscoveryFilters = { query: "", difficulty: null, format: null, freeOnly: false, sort: "relevant" };

export const activeFilterCount = (filters: DiscoveryFilters) =>
  Number(filters.difficulty !== null) + Number(filters.format !== null) + Number(filters.freeOnly) + Number(filters.sort !== "relevant");

const normalize = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
const termsOf = (query: string) => normalize(query).split(/\s+/).filter(Boolean).slice(0, 8);

/** Higher is better; 0 means no match. Title words count most. */
export function relevance(workshop: Workshop, query: string): number {
  const terms = termsOf(query);
  if (!terms.length) return 1;
  const title = normalize(workshop.title);
  const near = normalize(`${workshop.outcomeHook} ${workshop.category} ${workshop.instructorOrHost} ${workshop.platform}`);
  const far = normalize(workshop.description);
  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += 6;
    else if (near.includes(term)) score += 3;
    else if (far.includes(term)) score += 1;
    else return 0;
  }
  return score;
}

const timeRank = (workshop: Workshop, now: number) => ({ live: 0, upcoming: 1, replay: 2, anytime: 3, ended: 4 })[lifecycleOf(workshop, now)];
const byStart = (a: Workshop, b: Workshop) => (startOf(a) ?? Infinity) - (startOf(b) ?? Infinity) || 0;
const byPriority = (a: Workshop, b: Workshop) => (a.priority ?? 500) - (b.priority ?? 500);
/** Final tie-break, so the same data always produces the same order. */
const byTitle = (a: Workshop, b: Workshop) => a.title.localeCompare(b.title, "en") || a.id.localeCompare(b.id, "en");
const level = (workshop: Workshop) => workshopDifficulties.indexOf(workshop.difficulty);

/** "Relevant": live now, then live sessions within a week, then the editorial order, then later sessions. */
function relevantRank(workshop: Workshop, now: number): number {
  const state = lifecycleOf(workshop, now);
  if (state === "live") return 0;
  if (state === "upcoming") return (startOf(workshop) ?? Infinity) - now <= 7 * 86_400_000 ? 1 : 3;
  return 2;
}

export function sortWorkshops(workshops: readonly Workshop[], sort: WorkshopSort, now: number, query = ""): Workshop[] {
  const compare: Record<WorkshopSort, (a: Workshop, b: Workshop) => number> = {
    relevant: (a, b) => relevance(b, query) - relevance(a, query) || relevantRank(a, now) - relevantRank(b, now) || byStart(a, b) || byPriority(a, b),
    soon: (a, b) => timeRank(a, now) - timeRank(b, now) || byStart(a, b) || byPriority(a, b),
    shortest: (a, b) => a.durationMinutes - b.durationMinutes,
    beginner: (a, b) => level(a) - level(b) || timeRank(a, now) - timeRank(b, now) || byStart(a, b) || byPriority(a, b)
  };
  return [...workshops].sort((a, b) => compare[sort](a, b) || byTitle(a, b));
}

export function discover(workshops: readonly Workshop[], rail: RailSelection, filters: DiscoveryFilters, saved: ReadonlySet<string>, now: number): Workshop[] {
  const matches = workshops.filter(workshop =>
    isAvailable(workshop, now)
    && (rail === "all" || (rail === "saved" ? saved.has(workshop.id) : workshop.category === rail))
    && (!filters.difficulty || workshop.difficulty === filters.difficulty)
    // A finished event with a recording behaves like any other recording.
    && (!filters.format || (lifecycleOf(workshop, now) === "replay" ? "Self-Paced / Recorded" : workshop.format) === filters.format)
    && (!filters.freeOnly || workshop.priceType === "Free")
    && relevance(workshop, filters.query) > 0);
  return sortWorkshops(matches, filters.sort, now, filters.query);
}

/** Saved workshops that can be opened today; expired events keep their bookmark but are not counted. */
export const availableSavedCount = (workshops: readonly Workshop[], saved: ReadonlySet<string>, now: number) =>
  workshops.filter(workshop => saved.has(workshop.id) && isAvailable(workshop, now)).length;

const tracking = /^(utm_|fbclid$|gclid$|mc_|wt\.|ref$|source$)/i;

/** Compares links by what they point at: no tracking, fragment, "www." or trailing slash. */
export function canonicalUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (tracking.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.hostname.toLowerCase().replace(/^www\./, "")}${path}${url.search}`;
  } catch { return value.trim().toLowerCase(); }
}

/** Live sessions often share one registration page, so their start time is part of the identity. */
export function identityOf(workshop: Workshop): string {
  const url = canonicalUrl(workshop.registrationOrWatchUrl);
  return workshop.format === "Live Online" ? `${url}@${startOf(workshop) ?? "unknown"}` : url;
}

/** Earlier lists win: curated records are not replaced by a feed's version of the same thing. */
export function mergeWorkshops(...lists: readonly (readonly Workshop[])[]): Workshop[] {
  const ids = new Set<string>(), identities = new Set<string>(), merged: Workshop[] = [];
  for (const workshop of lists.flat()) {
    const identity = identityOf(workshop);
    if (ids.has(workshop.id) || identities.has(identity)) continue;
    ids.add(workshop.id);
    identities.add(identity);
    merged.push(workshop);
  }
  return merged;
}
