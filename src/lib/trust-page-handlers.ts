import { z } from "zod";
import { failure, isSameOrigin, json } from "./account/http";
import { readBoundedJson } from "./account/request-body";
import { privateWriteLimit } from "./account/attempt-limit";

export type TrustPageState = { slug: string | null; enabled: boolean };
export type TrustAccess = { userId: string; set(enabled: boolean, newLink: boolean): Promise<TrustPageState> };
const inputSchema = z.object({ enabled: z.boolean(), newLink: z.boolean().default(false) }).strict();

/** POST /api/v1/trust-page: turn the public trust page on or off, or replace its link. */
export function trustPageHandlers(authorize: () => Promise<TrustAccess | null>, limit = privateWriteLimit) {
  async function POST(request: Request) {
    if (!isSameOrigin(request)) return failure("FORBIDDEN", "This request must come from CareerForge.", 403);
    let access: TrustAccess | null;
    try { access = await authorize(); }
    catch { return failure("AUTH_UNAVAILABLE", "Your session could not be verified. Please try again.", 503); }
    if (!access) return failure("UNAUTHORIZED", "Sign in to share your checked facts.", 401);
    const input = inputSchema.safeParse(await readBoundedJson(request, 256));
    if (!input.success) return failure("INVALID_INPUT", "Choose whether to share the page.", 400);
    const wait = limit("profile", access.userId);
    if (wait) {
      const response = failure("RATE_LIMITED", "Too many requests. Please wait a moment and try again.", 429);
      response.headers.set("Retry-After", String(wait));
      return response;
    }
    try { return json(await access.set(input.data.enabled, input.data.newLink)); }
    catch { return failure("TRUST_PAGE_UNAVAILABLE", "The change could not be saved. Please try again.", 503); }
  }
  return { POST };
}

