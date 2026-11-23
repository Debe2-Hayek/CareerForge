import { createHash } from "node:crypto";
import type { z } from "zod";
import { AiError, completeJson, type AiProvider } from "./provider";

export type AiFeature = "profile_autofill" | "document_generate" | "evidence_check" | "skill_bank_draft";
export type Reservation =
  | { status: "cached"; output: unknown }
  | { status: "reserved"; runId: string; remaining: number }
  | { status: "limited"; retryAfter: number }
  | { status: "busy" };
/** Database-backed ledger (supabase/migrations/202611240001_ai_runs.sql). */
export type AiRunStore = {
  reserve(feature: AiFeature, inputHash: string, promptVersion: string): Promise<Reservation>;
  finish(runId: string, model: string | null, output: unknown | null): Promise<void>;
};

export class AiLimitError extends Error {
  constructor(public code: "AI_DAILY_LIMIT" | "AI_BUSY", message: string, public retryAfter?: number) { super(message); }
}

export function inputHash(parts: string[]): string {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex");
}

type Spec<T> = { feature: AiFeature; promptVersion: string; schema: z.ZodType<T>; system: string; user: string; maxTokens: number; cacheKey: string[]; images?: string[] };

/**
 * Returns the raw validated AI value: from the 30-day cache when the same
 * input was already processed, otherwise from one reserved provider call.
 * Callers re-apply grounding to cached and fresh values alike.
 */
export async function runAi<T>(store: AiRunStore, provider: AiProvider, spec: Spec<T>): Promise<{ value: T; cached: boolean; remaining: number | null; model: string | null }> {
  const reservation = await store.reserve(spec.feature, inputHash([spec.feature, ...spec.cacheKey]), spec.promptVersion);
  if (reservation.status === "cached") {
    const cached = spec.schema.safeParse(reservation.output);
    if (cached.success) return { value: cached.data, cached: true, remaining: null, model: null };
    throw new AiError("AI_INVALID_OUTPUT", "A saved AI result could not be read.");
  }
  if (reservation.status === "limited") throw new AiLimitError("AI_DAILY_LIMIT", "You have used today's AI requests for this feature. Try again tomorrow.", reservation.retryAfter);
  if (reservation.status === "busy") throw new AiLimitError("AI_BUSY", "CareerForge's AI is at its daily limit. Please try again tomorrow.");
  try {
    const { value, model } = await completeJson(provider, spec.schema, { system: spec.system, user: spec.user, maxTokens: spec.maxTokens, images: spec.images });
    await store.finish(reservation.runId, model, value);
    return { value, cached: false, remaining: reservation.remaining, model };
  } catch (error) {
    await store.finish(reservation.runId, null, null).catch(() => {});
    throw error;
  }
}
