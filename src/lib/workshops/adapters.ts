import { z } from "zod";
import { clip, htmlToText } from "@/lib/jobs/normalize";
import { parseIcal, type IcalEvent } from "./ical";
import { httpsUrlSchema, parseWorkshops, workshopSchema, type Workshop, type WorkshopCategory, type WorkshopDifficulty, type WorkshopPriceType } from "./types";

// Turn each feed format into validated workshops. Feed text is untrusted: it is
// reduced to plain text, clipped, and links must stay on the feed's own hosts.

/** What a trusted feed's events have in common and the calendar itself does not say. */
export type IcalSource = {
  idPrefix: string;
  organizer: string;
  platform: string;
  linkHosts: readonly string[];
  /** Venue text that still means online, besides an empty venue or a link to the event itself. */
  onlineVenue?: RegExp;
  defaultCategory: WorkshopCategory;
  /** Editorial estimate for the series, stated as such in the access note. */
  difficulty: WorkshopDifficulty;
  priceType: WorkshopPriceType;
  accessNotes: string;
  relatedRoadmaps: string[];
};

const categoryWords: readonly [WorkshopCategory, RegExp][] = [
  ["Cybersecurity", /\b(security|cyber|owasp|vulnerabilit\w*|threat|zero trust|pentest\w*|malware)\b/i],
  ["AI & ML", /\b(ai|a\.i\.|llms?|agents?|agentic|machine learning|ml|deep learning|rag|graphrag|genai|prompt\w*|neural|nlp|mlops)\b/i],
  ["Cloud & DevOps", /\b(cloud|devops|kubernetes|docker|terraform|ci\/cd|aws|azure|gcp|serverless|infrastructure|observability|pipelines?)\b/i],
  ["Web Dev", /\b(web|frontend|front-end|react|javascript|typescript|css|html|next\.js|vue|angular)\b/i],
  ["Python", /\b(python|pandas|numpy|django|fastapi|jupyter)\b/i],
  ["Systems & Algorithms", /\b(algorithms?|data structures?|systems?|databases?|sql|distributed|linux|compiler|networking)\b/i]
];

/** Deterministic, word-based classification with a declared default for the source. */
export function classify(title: string, fallback: WorkshopCategory): WorkshopCategory {
  return categoryWords.find(([, pattern]) => pattern.test(title))?.[0] ?? fallback;
}

const plain = (value: string, max: number) => clip(htmlToText(value, max * 2), max);

function eventLink(event: IcalEvent, hosts: readonly string[]): string | null {
  const candidates = [event.url, ...`${event.description} ${event.location}`.match(/https:\/\/[^\s<>"\\]+/g) ?? []];
  for (const candidate of candidates) {
    const parsed = httpsUrlSchema.safeParse(candidate.replace(/[).,;]+$/, ""));
    if (!parsed.success) continue;
    const host = new URL(parsed.data).hostname.toLowerCase();
    if (hosts.some(allowed => host === allowed || host.endsWith(`.${allowed}`))) return parsed.data;
  }
  return null;
}

/** Calendars mix online sessions with meetups; a street address is never "Live Online". */
function isOnline(event: IcalEvent, config: IcalSource): boolean {
  const venue = event.location.trim();
  if (/\b(in[- ]person|on[- ]?site|happy hour|dinner|after ?party|breakfast)\b/i.test(event.summary)) return false;
  return venue === "" || eventLink({ ...event, url: venue, description: "", location: "" }, config.linkHosts) !== null || Boolean(config.onlineVenue?.test(venue));
}

const idPart = (value: string) => value.replace(/@.*$/, "").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export function workshopsFromIcal(source: string, config: IcalSource, now: number): { workshops: Workshop[]; rejected: number } {
  const { events, skipped } = parseIcal(source);
  const workshops: Workshop[] = [];
  let rejected = skipped;
  for (const event of events) {
    // Calendars keep years of history; finished events without a recording are not workshops to offer.
    if (event.end <= now) continue;
    if (!isOnline(event, config)) { rejected++; continue; }
    const url = eventLink(event, config.linkHosts);
    const title = plain(event.summary, 140);
    const hosts = /Hosted by ([^\n]{2,100})/i.exec(event.description)?.[1];
    const host = plain(hosts ?? event.organizer, 100);
    const record = workshopSchema.safeParse({
      id: `${config.idPrefix}-${idPart(event.uid)}`,
      sourceId: plain(event.uid, 120),
      title,
      outcomeHook: `Live online session${host ? ` with ${clip(host, 80)}` : ""}.`,
      description: `${title}. A live online session organised by ${config.organizer}. Open the event page for the full agenda and to register.`,
      instructorOrHost: host ? clip(`${host}`, 120) : config.organizer,
      platform: config.platform,
      category: classify(title, config.defaultCategory),
      difficulty: config.difficulty,
      format: "Live Online",
      priceType: config.priceType,
      startDateTime: new Date(event.start).toISOString(),
      durationMinutes: Math.round((event.end - event.start) / 60_000),
      prerequisites: [],
      keyTakeaways: [],
      registrationOrWatchUrl: url,
      sourceUrl: url,
      sourceType: "feed",
      verificationStatus: "verified",
      lastVerifiedAt: new Date(now).toISOString().slice(0, 10),
      accessNotes: config.accessNotes,
      relatedRoadmaps: config.relatedRoadmaps
    });
    if (record.success) workshops.push(record.data); else rejected++;
  }
  return { workshops, rejected };
}

const jsonFeedSchema = z.union([z.array(z.unknown()), z.object({ workshops: z.array(z.unknown()) })]);

/** A JSON feed follows the Workshop model; it can never claim curated or featured status. */
export function workshopsFromJson(payload: unknown, now: number): { workshops: Workshop[]; rejected: number } {
  const parsed = jsonFeedSchema.safeParse(payload);
  if (!parsed.success) throw new Error("Feed is not a workshop list");
  const records = Array.isArray(parsed.data) ? parsed.data : parsed.data.workshops;
  const result = parseWorkshops(records.map(record => typeof record === "object" && record !== null
    ? { ...record, sourceType: "feed", isFeatured: undefined, badge: undefined, priority: undefined, durationNote: undefined, submissionStatus: undefined, lastVerifiedAt: new Date(now).toISOString().slice(0, 10) }
    : record));
  // Remote ids live in their own space so they cannot replace a curated resource.
  return { ...result, workshops: result.workshops.map(workshop => ({ ...workshop, id: workshop.id.startsWith("feed-") ? workshop.id : `feed-${workshop.id}`.slice(0, 80) })) };
}
