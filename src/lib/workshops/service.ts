import { curatedWorkshops } from "@/data/workshops/curated";
import { boundedFetchText, SourceError, type FetchText } from "@/lib/jobs/fetch";
import { workshopsFromIcal, workshopsFromJson, type IcalSource } from "./adapters";
import { mergeWorkshops } from "./discovery";
import { parseWorkshops, type SourceStatus, type Workshop, type WorkshopCatalog } from "./types";

// Loads every source, validates and merges them. Remote sources are optional:
// whatever happens to them, the curated catalogue is always returned.

export type FeedSource = { id: string; label: string; url: string; hosts: readonly string[] } & ({ kind: "ical"; config: IcalSource } | { kind: "json" });

/**
 * Feeds enabled by default. Reviewed 22 November 2026: Luma publishes a calendar
 * subscription address for public calendars, with a 12-hour refresh hint and
 * times in UTC; robots.txt on that host allows it. Rejected: CNCF and GDG event
 * APIs (disallowed by robots.txt), TeSS (disallows AI agents), ACCESS events
 * (local times labelled as UTC), roadmap-style scraping of event sites.
 */
export const defaultFeeds: readonly FeedSource[] = [{
  id: "datatalks-club",
  label: "DataTalks.Club live events",
  kind: "ical",
  url: "https://api2.luma.com/ics/get?entity=calendar&id=cal-kg9jR2UeDILH68H",
  hosts: ["api2.luma.com"],
  config: {
    idPrefix: "dtc",
    organizer: "DataTalks.Club",
    platform: "DataTalks.Club on Luma",
    linkHosts: ["luma.com", "lu.ma"],
    defaultCategory: "AI & ML",
    difficulty: "Intermediate",
    priceType: "Free",
    accessNotes: "Free registration on Luma. The level is CareerForge's estimate for this series.",
    relatedRoadmaps: ["data-engineer", "ai-engineer"]
  }
}];

/** Optional operator feed: server-side only, https only, JSON in the Workshop model or iCalendar. */
export function configuredFeed(environment: Record<string, string | undefined> = process.env): FeedSource | null {
  const value = environment.WORKSHOPS_FEED_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const base = { id: "configured", label: "Configured workshop feed", url: url.href, hosts: [url.hostname.toLowerCase()] };
    if (environment.WORKSHOPS_FEED_FORMAT !== "ical") return { ...base, kind: "json" };
    return { ...base, kind: "ical", config: {
      idPrefix: "feed", organizer: "the event organiser", platform: url.hostname, linkHosts: [url.hostname.toLowerCase().replace(/^(www|api2?)\./, "")],
      defaultCategory: "AI & ML", difficulty: "Intermediate", priceType: "Free", accessNotes: "Check cost and access on the event page.", relatedRoadmaps: []
    } };
  } catch { return null; }
}

type Options = { feeds?: readonly FeedSource[]; now?: () => number; fetchText?: (source: FeedSource) => FetchText; ttlMs?: number; log?: (message: string) => void };

async function loadFeed(source: FeedSource, fetchText: FetchText, now: number): Promise<{ workshops: Workshop[]; rejected: number }> {
  const body = await fetchText(source.url);
  return source.kind === "ical" ? workshopsFromIcal(body, source.config, now) : workshopsFromJson(JSON.parse(body), now);
}

export function createWorkshopService({
  feeds = [...defaultFeeds, ...(configuredFeed() ? [configuredFeed() as FeedSource] : [])],
  now = Date.now,
  fetchText = source => boundedFetchText(source.hosts, { timeoutMs: 6000, maxBytes: 1_500_000, accept: source.kind === "ical" ? /calendar/i : /json/i, userAgent: "CareerForge-Workshops/1.0 (student career platform)" }),
  ttlMs = 30 * 60_000,
  log = message => { if (process.env.NODE_ENV !== "production") console.warn(`[workshops] ${message}`); }
}: Options = {}) {
  // A curated record that fails validation is a build mistake, so tests assert none do.
  const curated = parseWorkshops(curatedWorkshops);
  let cached: { at: number; catalog: WorkshopCatalog } | null = null;
  let pending: Promise<WorkshopCatalog> | null = null;
  const lastGood = new Map<string, Workshop[]>();

  async function refresh(): Promise<WorkshopCatalog> {
    const at = now();
    const checkedAt = new Date(at).toISOString();
    const sources: SourceStatus[] = [{ id: "curated", label: "Curated by CareerForge", url: null, state: "ok", count: curated.workshops.length, rejected: curated.rejected, checkedAt }];
    const remote = await Promise.all(feeds.map(async feed => {
      const status = { id: feed.id, label: feed.label, url: feed.url, checkedAt };
      try {
        const result = await loadFeed(feed, fetchText(feed), at);
        if (result.rejected) log(`${feed.id}: rejected ${result.rejected} records`);
        lastGood.set(feed.id, result.workshops);
        sources.push({ ...status, state: result.workshops.length ? "ok" : "empty", count: result.workshops.length, rejected: result.rejected });
        return result.workshops;
      } catch (error) {
        log(`${feed.id}: ${error instanceof SourceError ? error.code : error instanceof Error ? error.name : "failed"}`);
        // The lifecycle hides anything that has ended, so the last good copy stays safe to show.
        const previous = lastGood.get(feed.id) ?? [];
        sources.push({ ...status, state: "failed", count: previous.length, rejected: 0 });
        return previous;
      }
    }));
    const catalog = { workshops: mergeWorkshops(curated.workshops, ...remote), sources, generatedAt: checkedAt };
    // Retry a failed source sooner than a healthy one.
    cached = { at: sources.some(source => source.state === "failed") ? at - ttlMs + 120_000 : at, catalog };
    return catalog;
  }

  return {
    /** Cached for half an hour; simultaneous callers share one refresh. */
    async catalog(): Promise<WorkshopCatalog> {
      if (cached && now() - cached.at < ttlMs) return cached.catalog;
      pending ??= refresh().finally(() => { pending = null; });
      return pending;
    }
  };
}

export const workshopService = createWorkshopService();
