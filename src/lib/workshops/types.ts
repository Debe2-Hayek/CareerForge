import { z } from "zod";

// Single source of truth for workshop data. The zod schema validates curated,
// remote and user-submitted records alike; the TypeScript types derive from it.

export const workshopCategories = ["AI & ML", "Web Dev", "Python", "Cybersecurity", "Cloud & DevOps", "Systems & Algorithms"] as const;
export type WorkshopCategory = (typeof workshopCategories)[number];
export const workshopDifficulties = ["Beginner", "Intermediate", "Advanced"] as const;
export type WorkshopDifficulty = (typeof workshopDifficulties)[number];
export const workshopFormats = ["Live Online", "Self-Paced / Recorded"] as const;
export type WorkshopFormat = (typeof workshopFormats)[number];
export const workshopPriceTypes = ["Free", "Free Audit", "Paid"] as const;
export type WorkshopPriceType = (typeof workshopPriceTypes)[number];
export const workshopBadges = ["Beginner Favorite", "Trending", "Filling Fast", "Staff Pick"] as const;

const text = (max: number) => z.string().trim().min(1).max(max);
export const workshopIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/);

/** Public https link without embedded credentials. Anything else is never rendered as a link. */
export const httpsUrlSchema = z.string().trim().max(500).refine(value => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && url.hostname.includes(".");
  } catch { return false; }
}, "Use a full https:// address");

const isoInstant = z.string().max(40).refine(value => /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)), "Use an ISO date and time with a time zone");

export const workshopSchema = z.object({
  id: workshopIdSchema,
  title: text(140),
  outcomeHook: text(160),
  description: text(1200),

  instructorOrHost: text(120),
  platform: text(80),

  category: z.enum(workshopCategories),
  difficulty: z.enum(workshopDifficulties),
  format: z.enum(workshopFormats),
  priceType: z.enum(workshopPriceTypes),

  startDateTime: isoInstant.optional(),
  durationMinutes: z.number().int().min(5).max(60_000),
  /** True when the publisher does not state a length and CareerForge estimated it. */
  durationEstimated: z.boolean().optional(),
  /** The publisher's own statement when it is a range; durationMinutes is then its middle. */
  durationNote: text(90).optional(),
  seatsRemaining: z.number().int().min(0).max(100_000).optional(),

  prerequisites: z.array(text(140)).max(6),
  keyTakeaways: z.array(text(160)).max(8),

  registrationOrWatchUrl: httpsUrlSchema,
  recordingUrl: httpsUrlSchema.optional(),
  /** A real joining destination. "Join Live" is offered only when this exists. */
  joinUrl: httpsUrlSchema.optional(),

  badge: z.enum(workshopBadges).optional(),
  isFeatured: z.boolean().optional(),
  /** Editorial order among self-paced resources; lower comes first. */
  priority: z.number().int().min(1).max(999).optional(),

  sourceId: text(120).optional(),
  sourceUrl: httpsUrlSchema.optional(),
  sourceType: z.enum(["curated", "feed", "submission", "community"]),
  lastVerifiedAt: z.iso.date().optional(),
  accessNotes: text(240).optional(),
  verificationStatus: z.enum(["verified", "unverified"]),
  submissionStatus: z.enum(["private"]).optional(),
  /** Stable roadmap ids (src/lib/roadmaps) this workshop helps to practise. */
  relatedRoadmaps: z.array(z.string().regex(/^[a-z0-9-]{1,60}$/)).max(6).optional()
}).strict().superRefine((workshop, context) => {
  if (workshop.format === "Live Online" && !workshop.startDateTime) context.addIssue({ code: "custom", message: "A live workshop needs a start time" });
});
export type Workshop = z.infer<typeof workshopSchema>;

export type SourceStatus = {
  id: string;
  label: string;
  url: string | null;
  state: "ok" | "empty" | "failed";
  count: number;
  rejected: number;
  checkedAt: string;
};

export type WorkshopCatalog = { workshops: Workshop[]; sources: SourceStatus[]; generatedAt: string };

/** Validates untrusted records one by one so a malformed item never hides the good ones. */
export function parseWorkshops(records: readonly unknown[], limit = 500): { workshops: Workshop[]; rejected: number } {
  const workshops: Workshop[] = [];
  let rejected = Math.max(0, records.length - limit);
  for (const record of records.slice(0, limit)) {
    const parsed = workshopSchema.safeParse(record);
    if (parsed.success) workshops.push(parsed.data); else rejected++;
  }
  return { workshops, rejected };
}
