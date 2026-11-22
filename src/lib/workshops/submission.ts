import { canonicalUrl, identityOf } from "./discovery";
import { httpsUrlSchema, workshopCategories, workshopDifficulties, workshopFormats, workshopPriceTypes, workshopSchema, type Workshop } from "./types";

// Validation for workshops a learner adds for themselves. Pure, so the form and
// the tests apply exactly the same rules. Nothing here publishes anything.

export type SubmissionInput = {
  url: string; title: string; category: string; format: string;
  hook: string; difficulty: string; durationMinutes: string; priceType: string;
  /** Local date and time from the browser, e.g. 2026-12-01T18:00. */
  startLocal: string;
};
export type SubmissionErrors = Partial<Record<keyof SubmissionInput, string>>;

const includes = (list: readonly string[], value: string) => list.includes(value);

export function validateEssentials(input: SubmissionInput, existing: readonly Workshop[]): SubmissionErrors {
  const errors: SubmissionErrors = {};
  const url = httpsUrlSchema.safeParse(input.url);
  if (!url.success) errors.url = "Enter a full address that starts with https://";
  // A live page can host several sessions, so those are compared with their time later.
  else if (input.format !== "Live Online" && existing.some(workshop => canonicalUrl(workshop.registrationOrWatchUrl) === canonicalUrl(url.data))) errors.url = "This workshop is already in the list.";
  const title = input.title.trim();
  if (title.length < 4) errors.title = "Enter the workshop’s title.";
  else if (title.length > 140) errors.title = "Keep the title under 140 characters.";
  if (!includes(workshopCategories, input.category)) errors.category = "Choose a topic.";
  if (!includes(workshopFormats, input.format)) errors.format = "Choose a format.";
  return errors;
}

export function validateDetails(input: SubmissionInput, now: number): SubmissionErrors {
  const errors: SubmissionErrors = {};
  const hook = input.hook.trim();
  if (hook.length < 8) errors.hook = "Say in one sentence what you will be able to do.";
  else if (hook.length > 160) errors.hook = "Keep it under 160 characters.";
  if (!includes(workshopDifficulties, input.difficulty)) errors.difficulty = "Choose a level.";
  if (!includes(workshopPriceTypes, input.priceType)) errors.priceType = "Choose the cost.";
  const minutes = Number(input.durationMinutes);
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 60_000) errors.durationMinutes = "Enter the length in minutes (at least 5).";
  if (input.format === "Live Online") {
    const start = Date.parse(input.startLocal);
    if (!Number.isFinite(start)) errors.startLocal = "Choose the date and time.";
    else if (start <= now) errors.startLocal = "Choose a time in the future.";
  }
  return errors;
}

async function shortHash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].slice(0, 8).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

/** A private, unverified record, or the reason it cannot be added. */
export async function buildSubmission(input: SubmissionInput, existing: readonly Workshop[], now: number): Promise<{ workshop: Workshop } | { errors: SubmissionErrors }> {
  const errors = { ...validateEssentials(input, existing), ...validateDetails(input, now) };
  if (Object.keys(errors).length) return { errors };
  const url = new URL(input.url.trim());
  const live = input.format === "Live Online";
  const host = url.hostname.replace(/^www\./, "");
  const record = workshopSchema.safeParse({
    id: "local-draft", title: input.title.trim(), outcomeHook: input.hook.trim(), description: input.hook.trim(),
    instructorOrHost: host, platform: host, category: input.category, difficulty: input.difficulty, format: input.format, priceType: input.priceType,
    ...(live ? { startDateTime: new Date(Date.parse(input.startLocal)).toISOString() } : {}),
    durationMinutes: Number(input.durationMinutes), prerequisites: [], keyTakeaways: [],
    registrationOrWatchUrl: url.href, sourceType: "submission", verificationStatus: "unverified", submissionStatus: "private"
  });
  if (!record.success) return { errors: { url: "This workshop could not be added. Check each answer." } };
  const identity = identityOf(record.data);
  if (existing.some(workshop => identityOf(workshop) === identity)) return { errors: { url: "This workshop is already in the list." } };
  return { workshop: { ...record.data, id: `local-${await shortHash(identity)}` } };
}
