import { z } from "zod";
import { failure, isSameOrigin, json } from "./account/http";
import { readBoundedJson } from "./account/request-body";
import { privateWriteLimit } from "./account/attempt-limit";
import { languageFieldsSchema, type LanguageFields, type ProfileLanguage } from "./languages";

export class LanguageError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}
export type LanguageAccess = {
  userId: string;
  save(id: string | null, fields: LanguageFields): Promise<ProfileLanguage>;
  remove(id: string): Promise<void>;
};
type Limit = typeof privateWriteLimit;

const saveSchema = z.object({ id: z.uuid().nullable().default(null), fields: z.unknown() }).strict();
const removeSchema = z.object({ id: z.uuid() }).strict();

/** POST (add or update) and DELETE /api/v1/languages: the owner's languages and levels. */
export function languageHandlers(authorize: () => Promise<LanguageAccess | null>, limit: Limit = privateWriteLimit) {
  async function begin(request: Request) {
    if (!isSameOrigin(request)) return failure("FORBIDDEN", "This request must come from CareerForge.", 403);
    let access: LanguageAccess | null;
    try { access = await authorize(); }
    catch { return failure("AUTH_UNAVAILABLE", "Your session could not be verified. Please try again.", 503); }
    if (!access) return failure("UNAUTHORIZED", "Sign in to edit your languages.", 401);
    const wait = limit("history", access.userId);
    if (wait) {
      const response = failure("RATE_LIMITED", "Too many requests. Please wait a moment and try again.", 429);
      response.headers.set("Retry-After", String(wait));
      return response;
    }
    return access;
  }
  function refused(error: unknown) {
    if (error instanceof LanguageError) return failure(error.code, error.message, error.status);
    return failure("LANGUAGES_UNAVAILABLE", "Your languages could not be saved. Please try again.", 503);
  }
  async function POST(request: Request) {
    const access = await begin(request);
    if (access instanceof Response) return access;
    const body = saveSchema.safeParse(await readBoundedJson(request, 2048));
    const fields = body.success ? languageFieldsSchema.safeParse(body.data.fields) : null;
    if (!body.success || !fields?.success) {
      const issue = fields && !fields.success ? fields.error.issues.find(item => item.code === "custom" || item.path[0] === "language") : null;
      return failure("INVALID_INPUT", issue?.message && issue.code === "custom" ? issue.message : "Enter a language (letters only) and choose a level.", 400);
    }
    try { return json({ language: await access.save(body.data.id, fields.data) }, body.data.id ? 200 : 201); }
    catch (error) { return refused(error); }
  }
  async function DELETE(request: Request) {
    const access = await begin(request);
    if (access instanceof Response) return access;
    const body = removeSchema.safeParse(await readBoundedJson(request, 512));
    if (!body.success) return failure("INVALID_INPUT", "Choose a language to remove.", 400);
    try { await access.remove(body.data.id); return new Response(null, { status: 204 }); }
    catch (error) { return refused(error); }
  }
  return { POST, DELETE };
}
