import { z } from "zod";
import { failure, isSameOrigin, json } from "../account/http";
import { readBoundedJson } from "../account/request-body";
import { AiError, type AiProvider } from "./provider";
import { AiLimitError, runAi, type AiRunStore } from "./runner";
import { CV_FILE_MAX_BYTES, DocumentTextError, cvText, tidyText } from "./document-text";
import { PROFILE_AUTOFILL_PROMPT, aiProfileSchema, groundProfile, profileAutofillPrompt } from "./profile-autofill";
import { DOCUMENT_GENERATE_PROMPT, aiDocumentSchema, documentGeneratePrompt, groundDocument } from "./document-generate";

export type AiAccess = { userId: string; runs: AiRunStore };
type Authorize = () => Promise<AiAccess | null>;
type ProviderFactory = () => AiProvider | null;

function aiFailure(error: unknown) {
  if (error instanceof AiLimitError) {
    const response = failure(error.code, error.message, 429);
    if (error.retryAfter) response.headers.set("Retry-After", String(error.retryAfter));
    return response;
  }
  if (error instanceof AiError) {
    return error.code === "AI_TIMEOUT"
      ? failure("AI_TIMEOUT", "The AI took too long. Please try again.", 504)
      : failure("AI_UNAVAILABLE", "The AI could not complete this request. Please try again later.", 503);
  }
  return null;
}

const notesSchema = z.string().transform(tidyText).pipe(z.string().min(40).max(6000));
const MULTIPART_MAX_BYTES = CV_FILE_MAX_BYTES + 64 * 1024;

/** POST /api/v1/profile/autofill — CV file or notes in, grounded profile suggestions out. Nothing is saved to the profile. */
export function profileAutofillHandlers(authorize: Authorize, provider: ProviderFactory) {
  async function POST(request: Request) {
    if (!isSameOrigin(request)) return failure("FORBIDDEN", "This request must come from CareerForge.", 403);
    const length = request.headers.get("content-length");
    if (!/^multipart\/form-data;/i.test(request.headers.get("content-type") ?? "") || !length || !/^\d+$/.test(length) || Number(length) > MULTIPART_MAX_BYTES) {
      void request.body?.cancel().catch(() => {});
      return failure("INVALID_INPUT", "Send a PDF or Word CV up to 4 MB, or 40 to 6,000 characters about yourself.", 400);
    }
    let access: AiAccess | null;
    try { access = await authorize(); }
    catch { return failure("AUTH_UNAVAILABLE", "Your session could not be verified. Please try again.", 503); }
    if (!access) return failure("UNAUTHORIZED", "Sign in to use AI autofill.", 401);
    const ai = provider();
    if (!ai) return failure("AI_NOT_CONFIGURED", "AI autofill is not available right now. Enter your details below instead.", 501);

    let form: FormData;
    try { form = await request.formData(); }
    catch { return failure("INVALID_INPUT", "The upload could not be read. Please try again.", 400); }
    if (form.get("consent") !== "yes") return failure("CONSENT_REQUIRED", "Agree to send your text to the AI service first.", 400);
    const source = form.get("source");
    let content: string;
    if (source === "cv") {
      const file = form.get("file");
      if (!(file instanceof File)) return failure("INVALID_INPUT", "Choose a PDF or Word (.docx) CV.", 400);
      try { content = await cvText(file); }
      catch (error) {
        if (error instanceof DocumentTextError) return failure(error.code, error.message, error.code === "UNSUPPORTED_FILE" ? 400 : 422);
        return failure("UNREADABLE_FILE", "This CV could not be read. Try another PDF or Word file.", 422);
      }
    } else if (source === "notes") {
      const notes = notesSchema.safeParse(form.get("text"));
      if (!notes.success) return failure("INVALID_INPUT", "Write between 40 and 6,000 characters about yourself.", 400);
      content = notes.data;
    } else return failure("INVALID_INPUT", "Choose a CV or write about yourself.", 400);

    try {
      const prompt = profileAutofillPrompt(source, content);
      const run = await runAi(access.runs, ai, { feature: "profile_autofill", promptVersion: PROFILE_AUTOFILL_PROMPT, schema: aiProfileSchema, ...prompt, cacheKey: [source, content] });
      // Grounding runs on every response, cached or fresh, against this exact source.
      return json({ result: groundProfile(run.value, content), cached: run.cached, remaining: run.remaining });
    } catch (error) {
      return aiFailure(error) ?? failure("AI_UNAVAILABLE", "The AI could not complete this request. Please try again later.", 503);
    }
  }
  return { POST };
}

const documentInputSchema = z.object({ text: z.string().trim().min(1).max(8000) }).strict();

/**
 * Builder generation: notes in, grounded PortfolioBuilder data out. Without a
 * configured provider it keeps returning 501 so the supplied component shows
 * its labeled demo fallback.
 */
export function documentGenerateHandlers(authorize: Authorize, provider: ProviderFactory) {
  async function POST(request: Request) {
    if (!isSameOrigin(request)) return failure("FORBIDDEN", "This request must come from CareerForge.", 403);
    let access: AiAccess | null;
    try { access = await authorize(); }
    catch { return failure("AUTH_UNAVAILABLE", "Your session could not be verified. Please try again.", 503); }
    if (!access) return failure("UNAUTHORIZED", "Sign in to use the document builder.", 401);
    const input = documentInputSchema.safeParse(await readBoundedJson(request, 65536));
    if (!input.success) return failure("INVALID_INPUT", "Enter between 1 and 8,000 characters of notes.", 400);
    const ai = provider();
    if (!ai) return failure("NOT_IMPLEMENTED", "AI generation is not connected. The builder can show fictional sample content in demo mode.", 501);
    const notes = tidyText(input.data.text);
    if (notes.length < 20) return failure("INVALID_INPUT", "Write a little more about yourself: at least 20 characters.", 400);
    try {
      const prompt = documentGeneratePrompt(notes);
      const run = await runAi(access.runs, ai, { feature: "document_generate", promptVersion: DOCUMENT_GENERATE_PROMPT, schema: aiDocumentSchema, ...prompt, cacheKey: [notes] });
      return json({ document: groundDocument(run.value, notes), cached: run.cached, remaining: run.remaining });
    } catch (error) {
      return aiFailure(error) ?? failure("AI_UNAVAILABLE", "The AI could not complete this request. Please try again later.", 503);
    }
  }
  // The supplied component reads the data object itself and a string error.
  async function compatibilityPOST(request: Request) {
    const response = await POST(request);
    const body = await response.json() as { document?: unknown; error?: { message: string } };
    const reply = response.ok ? json(body.document, 200) : json({ error: body.error?.message ?? "Request failed" }, response.status);
    const retry = response.headers.get("Retry-After");
    if (retry) reply.headers.set("Retry-After", retry);
    return reply;
  }
  return { POST, compatibilityPOST };
}
