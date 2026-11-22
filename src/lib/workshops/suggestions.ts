import { z } from "zod";
import { workshopSchema, type Workshop } from "./types";

// Learner-added workshops kept in the account, and the ones an operator approved.
// Stored records are untrusted: they are validated on every read, and privileges
// such as badges, featured status or verification are never taken from them.

export const suggestionStatuses = ["private", "pending", "approved", "rejected"] as const;
export type SuggestionStatus = (typeof suggestionStatuses)[number];
export type OwnSuggestion = { workshop: Workshop; status: SuggestionStatus; note: string | null };

const ownRowSchema = z.object({ workshop_id: z.string(), record: z.unknown(), status: z.enum(suggestionStatuses), review_note: z.string().nullable() });
const approvedRowSchema = z.object({ workshop_id: z.string().regex(/^local-[0-9a-f]{16}$/), record: z.unknown(), reviewed_on: z.iso.date() });

function contentOf(record: unknown): unknown {
  if (typeof record !== "object" || record === null) return null;
  const { badge, isFeatured, priority, seatsRemaining, joinUrl, recordingUrl, relatedRoadmaps, lastVerifiedAt, sourceId, ...content } = record as Record<string, unknown>;
  void [badge, isFeatured, priority, seatsRemaining, joinUrl, recordingUrl, relatedRoadmaps, lastVerifiedAt, sourceId];
  return content;
}

/** The part of a workshop that is stored; everything else is decided when it is read. */
export const storedRecord = (workshop: Workshop): Record<string, unknown> => contentOf(workshop) as Record<string, unknown>;

export function parseOwnSuggestions(rows: readonly unknown[]): OwnSuggestion[] {
  return rows.flatMap(row => {
    const parsed = ownRowSchema.safeParse(row);
    if (!parsed.success) return [];
    const workshop = workshopSchema.safeParse({ ...(contentOf(parsed.data.record) as object | null), id: parsed.data.workshop_id, sourceType: "submission", verificationStatus: "unverified", submissionStatus: "private" });
    return workshop.success ? [{ workshop: workshop.data, status: parsed.data.status, note: parsed.data.review_note }] : [];
  });
}

/** Approved by an operator, so shown to everyone as a community suggestion with its review date. */
export function parseApproved(rows: readonly unknown[]): Workshop[] {
  return rows.flatMap(row => {
    const parsed = approvedRowSchema.safeParse(row);
    if (!parsed.success) return [];
    const content = contentOf(parsed.data.record);
    if (!content) return [];
    const { submissionStatus, ...rest } = content as Record<string, unknown>;
    void submissionStatus;
    const workshop = workshopSchema.safeParse({ ...rest, id: parsed.data.workshop_id.replace("local-", "community-"), sourceType: "community", verificationStatus: "verified", lastVerifiedAt: parsed.data.reviewed_on });
    return workshop.success ? [workshop.data] : [];
  });
}

export const suggestionInputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), input: z.object({
    url: z.string().max(500), title: z.string().max(140), category: z.string().max(40), format: z.string().max(40), hook: z.string().max(160),
    difficulty: z.string().max(20), durationMinutes: z.string().max(6), priceType: z.string().max(20), startLocal: z.string().max(40)
  }).strict() }).strict(),
  z.object({ action: z.enum(["suggest", "withdraw", "remove"]), workshopId: z.string().regex(/^local-[0-9a-f]{16}$/) }).strict()
]);
export type SuggestionInput = z.infer<typeof suggestionInputSchema>;
