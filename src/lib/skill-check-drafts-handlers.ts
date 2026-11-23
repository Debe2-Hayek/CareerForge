import { failure, isSameOrigin, json } from "./account/http";
import { readBoundedJson } from "./account/request-body";
import { privateWriteLimit } from "./account/attempt-limit";
import { AiError } from "./ai/provider";
import { AiLimitError } from "./ai/runner";
import { draftActionSchema, type DraftAction } from "./skill-check-drafts";

export class DraftError extends Error {
  constructor(public code: string, message: string, public status: number, public details?: unknown) { super(message); }
}
export type DraftAccess = { userId: string; run(action: DraftAction): Promise<unknown> };

/** POST /api/v1/admin/skill-checks: generate, save, publish or discard a draft (admins only). */
export function skillDraftHandlers(authorize: () => Promise<DraftAccess | null>, limit = privateWriteLimit) {
  async function POST(request: Request) {
    if (!isSameOrigin(request)) return failure("FORBIDDEN", "This request must come from CareerForge.", 403);
    let access: DraftAccess | null;
    try { access = await authorize(); }
    catch { return failure("AUTH_UNAVAILABLE", "Your session could not be verified. Please try again.", 503); }
    if (!access) return failure("FORBIDDEN", "Reviewer access is required.", 403);
    const input = draftActionSchema.safeParse(await readBoundedJson(request, 32768));
    if (!input.success) return failure("INVALID_INPUT", "Check the draft and try again.", 400);
    const wait = limit("review", access.userId);
    if (wait) {
      const response = failure("RATE_LIMITED", "Too many requests. Please wait a moment.", 429);
      response.headers.set("Retry-After", String(wait));
      return response;
    }
    try { return json(await access.run(input.data)); }
    catch (error) {
      if (error instanceof DraftError) return json({ error: { code: error.code, message: error.message, details: error.details ?? null } }, error.status);
      if (error instanceof AiLimitError) {
        const response = failure(error.code, error.message, 429);
        if (error.retryAfter) response.headers.set("Retry-After", String(error.retryAfter));
        return response;
      }
      if (error instanceof AiError) return error.code === "AI_TIMEOUT"
        ? failure("AI_TIMEOUT", "The AI took too long. Try again.", 504)
        : failure("AI_UNAVAILABLE", "The AI could not draft questions right now. You can write them yourself.", 503);
      return failure("DRAFTS_UNAVAILABLE", "The draft could not be saved. Please try again.", 503);
    }
  }
  return { POST };
}
