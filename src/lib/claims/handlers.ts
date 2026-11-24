import { createHash } from "node:crypto";
import { z } from "zod";
import { failure, isSameOrigin, json } from "../account/http";
import { readBoundedJson } from "../account/request-body";
import { privateWriteLimit } from "../account/attempt-limit";
import { EVIDENCE_MAX_BYTES, evidenceType, type ClaimKind } from "./model";
import { AiError } from "../ai/provider";
import { AiLimitError } from "../ai/runner";
import { issuerForLink, ISSUER_NAMES } from "./issuers";

export class ClaimError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}
export type EvidenceInput = { kind: ClaimKind; recordId: string | null; skill: string | null; fileName: string; bytes: Uint8Array; mime: string; ext: string; sha256: string };
export type ClaimsAccess = {
  userId: string;
  submitEvidence(input: EvidenceInput): Promise<{ claimId: string; status: string }>;
  addLink(input: LinkInput): Promise<{ claimId: string; status: string }>;
};
export type LinkInput = { kind: ClaimKind; recordId: string | null; skill: string | null; url: string };
export type ReviewAccess = {
  userId: string;
  review(claimId: string, decision: "approve" | "reject", note: string): Promise<{ claimId: string; status: string }>;
};
type Limit = typeof privateWriteLimit;

function limited(limit: Limit, scope: "claims" | "review", userId: string) {
  const wait = limit(scope, userId);
  if (!wait) return null;
  const response = failure("RATE_LIMITED", "Too many requests. Please wait a moment and try again.", 429);
  response.headers.set("Retry-After", String(wait));
  return response;
}

const uuid = z.uuid();
const MULTIPART_MAX = EVIDENCE_MAX_BYTES + 64 * 1024;

/** POST /api/v1/claims/evidence: upload one proof file for one of the owner's facts. */
export function claimEvidenceHandlers(authorize: () => Promise<ClaimsAccess | null>, limit: Limit = privateWriteLimit) {
  async function POST(request: Request) {
    if (!isSameOrigin(request)) return failure("FORBIDDEN", "This request must come from CareerForge.", 403);
    const length = request.headers.get("content-length");
    if (!/^multipart\/form-data;/i.test(request.headers.get("content-type") ?? "") || !length || !/^\d+$/.test(length) || Number(length) > MULTIPART_MAX) {
      void request.body?.cancel().catch(() => {});
      return failure("INVALID_INPUT", "Upload one PDF, PNG or JPG file up to 4 MB.", 400);
    }
    let access: ClaimsAccess | null;
    try { access = await authorize(); }
    catch { return failure("AUTH_UNAVAILABLE", "Your session could not be verified. Please try again.", 503); }
    if (!access) return failure("UNAUTHORIZED", "Sign in to add proof.", 401);
    const denied = limited(limit, "claims", access.userId);
    if (denied) return denied;

    let form: FormData;
    try { form = await request.formData(); } catch { return failure("INVALID_INPUT", "The upload could not be read. Please try again.", 400); }
    const kind = form.get("kind");
    const file = form.get("file");
    if (kind !== "degree" && kind !== "employment" && kind !== "skill" && kind !== "language") return failure("INVALID_INPUT", "Choose what this proof is for.", 400);
    const record = uuid.safeParse(form.get("recordId"));
    const skill = typeof form.get("skill") === "string" ? String(form.get("skill")).trim() : "";
    if (kind === "skill" ? !skill || skill.length > 60 : !record.success) return failure("INVALID_INPUT", "Choose what this proof is for.", 400);
    if (!(file instanceof File) || !file.size) return failure("INVALID_INPUT", "Choose a PDF, PNG or JPG file.", 400);
    if (file.size > EVIDENCE_MAX_BYTES) return failure("INVALID_INPUT", "Choose a file smaller than 4 MB.", 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = evidenceType(bytes);
    if (!type) return failure("UNSUPPORTED_FILE", "Only PDF, PNG and JPG files are accepted.", 400);
    const fileName = (file.name || `proof.${type.ext}`).replace(/[\u0000-\u001f\\/]/g, "").slice(0, 200) || `proof.${type.ext}`;
    try {
      const result = await access.submitEvidence({
        kind, recordId: kind === "skill" ? null : record.data!, skill: kind === "skill" ? skill : null,
        fileName, bytes, mime: type.mime, ext: type.ext, sha256: createHash("sha256").update(bytes).digest("hex")
      });
      return json(result, 201);
    } catch (error) {
      if (error instanceof ClaimError) return failure(error.code, error.message, error.status);
      return failure("CLAIMS_UNAVAILABLE", "Your proof could not be saved. Please try again.", 503);
    }
  }
  return { POST };
}

const reviewSchema = z.object({ claimId: z.uuid(), decision: z.enum(["approve", "reject"]), note: z.string().trim().max(500).default("") }).strict()
  .refine(value => value.decision === "approve" || value.note.length > 0, { message: "A reason is required to reject.", path: ["note"] });

/** POST /api/v1/admin/claims/review: an admin approves or rejects a claim. */
export function claimReviewHandlers(authorize: () => Promise<ReviewAccess | null>, limit: Limit = privateWriteLimit) {
  async function POST(request: Request) {
    if (!isSameOrigin(request)) return failure("FORBIDDEN", "This request must come from CareerForge.", 403);
    let access: ReviewAccess | null;
    try { access = await authorize(); }
    catch { return failure("AUTH_UNAVAILABLE", "Your session could not be verified. Please try again.", 503); }
    if (!access) return failure("FORBIDDEN", "Reviewer access is required.", 403);
    const input = reviewSchema.safeParse(await readBoundedJson(request, 4096));
    if (!input.success) return failure("INVALID_INPUT", "Choose approve or reject. A reason (up to 500 characters) is required to reject.", 400);
    const denied = limited(limit, "review", access.userId);
    if (denied) return denied;
    try { return json(await access.review(input.data.claimId, input.data.decision, input.data.note)); }
    catch (error) {
      if (error instanceof ClaimError) return failure(error.code, error.message, error.status);
      return failure("CLAIMS_UNAVAILABLE", "The decision could not be saved. Please try again.", 503);
    }
  }
  return { POST };
}

export type CheckAccess = { userId: string; check(evidenceId: string): Promise<unknown> };
const checkSchema = z.object({ evidenceId: z.uuid() }).strict();

/** POST /api/v1/admin/claims/check: an admin asks the AI to read one proof file. */
export function claimCheckHandlers(authorize: () => Promise<CheckAccess | null>, limit: Limit = privateWriteLimit) {
  async function POST(request: Request) {
    if (!isSameOrigin(request)) return failure("FORBIDDEN", "This request must come from CareerForge.", 403);
    let access: CheckAccess | null;
    try { access = await authorize(); }
    catch { return failure("AUTH_UNAVAILABLE", "Your session could not be verified. Please try again.", 503); }
    if (!access) return failure("FORBIDDEN", "Reviewer access is required.", 403);
    const input = checkSchema.safeParse(await readBoundedJson(request, 1024));
    if (!input.success) return failure("INVALID_INPUT", "Choose a proof file to check.", 400);
    const denied = limited(limit, "review", access.userId);
    if (denied) return denied;
    try { return json({ check: await access.check(input.data.evidenceId) }); }
    catch (error) {
      if (error instanceof ClaimError) return failure(error.code, error.message, error.status);
      if (error instanceof AiLimitError) {
        const response = failure(error.code, error.message, 429);
        if (error.retryAfter) response.headers.set("Retry-After", String(error.retryAfter));
        return response;
      }
      if (error instanceof AiError) return error.code === "AI_TIMEOUT"
        ? failure("AI_TIMEOUT", "The AI took too long. Try again.", 504)
        : failure("AI_UNAVAILABLE", "The AI could not read this file right now. Open it and review it yourself.", 503);
      return failure("CLAIMS_UNAVAILABLE", "The check could not be completed. Please try again.", 503);
    }
  }
  return { POST };
}

const linkSchema = z.object({
  kind: z.enum(["degree", "employment", "skill", "language"]), recordId: z.uuid().nullable().default(null),
  skill: z.string().trim().max(60).nullable().default(null), url: z.string().trim().max(500)
}).strict().refine(value => value.kind === "skill" ? Boolean(value.skill) : Boolean(value.recordId), { message: "Choose what this link is for." });

/** POST /api/v1/claims/links: add a public verification link (known issuer sites only). */
export function claimLinkHandlers(authorize: () => Promise<ClaimsAccess | null>, limit: Limit = privateWriteLimit) {
  async function POST(request: Request) {
    if (!isSameOrigin(request)) return failure("FORBIDDEN", "This request must come from CareerForge.", 403);
    let access: ClaimsAccess | null;
    try { access = await authorize(); }
    catch { return failure("AUTH_UNAVAILABLE", "Your session could not be verified. Please try again.", 503); }
    if (!access) return failure("UNAUTHORIZED", "Sign in to add proof.", 401);
    const input = linkSchema.safeParse(await readBoundedJson(request, 2048));
    if (!input.success) return failure("INVALID_INPUT", "Choose what this link is for and paste its address.", 400);
    const known = issuerForLink(input.data.url);
    if (!known) return failure("UNSUPPORTED_LINK", `Paste the public verification link from ${ISSUER_NAMES.slice(0, -1).join(", ")} or ${ISSUER_NAMES.at(-1)}. It starts with https://.`, 400);
    const denied = limited(limit, "claims", access.userId);
    if (denied) return denied;
    try {
      const { kind, recordId, skill } = input.data;
      return json({ ...await access.addLink({ kind, recordId: kind === "skill" ? null : recordId, skill: kind === "skill" ? skill : null, url: known.url }), issuer: known.issuer.name }, 201);
    } catch (error) {
      if (error instanceof ClaimError) return failure(error.code, error.message, error.status);
      return failure("CLAIMS_UNAVAILABLE", "Your link could not be saved. Please try again.", 503);
    }
  }
  return { POST };
}

export type LinkCheckAccess = { userId: string; check(linkId: string): Promise<unknown> };
const linkCheckSchema = z.object({ linkId: z.uuid() }).strict();

/** POST /api/v1/admin/claims/link-check: an admin has a verification link checked with its issuer. */
export function linkCheckHandlers(authorize: () => Promise<LinkCheckAccess | null>, limit: Limit = privateWriteLimit) {
  async function POST(request: Request) {
    if (!isSameOrigin(request)) return failure("FORBIDDEN", "This request must come from CareerForge.", 403);
    let access: LinkCheckAccess | null;
    try { access = await authorize(); }
    catch { return failure("AUTH_UNAVAILABLE", "Your session could not be verified. Please try again.", 503); }
    if (!access) return failure("FORBIDDEN", "Reviewer access is required.", 403);
    const input = linkCheckSchema.safeParse(await readBoundedJson(request, 1024));
    if (!input.success) return failure("INVALID_INPUT", "Choose a link to check.", 400);
    const denied = limited(limit, "review", access.userId);
    if (denied) return denied;
    try { return json({ check: await access.check(input.data.linkId) }); }
    catch (error) {
      if (error instanceof ClaimError) return failure(error.code, error.message, error.status);
      return failure("CLAIMS_UNAVAILABLE", "The link could not be checked. Please try again.", 503);
    }
  }
  return { POST };
}

export type ReadAccess = { userId: string; read(evidenceId: string): Promise<unknown> };

/** POST /api/v1/admin/claims/read: an admin has CareerForge read a proof file's text (free, no AI). */
export function textReadHandlers(authorize: () => Promise<ReadAccess | null>, limit: Limit = privateWriteLimit) {
  async function POST(request: Request) {
    if (!isSameOrigin(request)) return failure("FORBIDDEN", "This request must come from CareerForge.", 403);
    let access: ReadAccess | null;
    try { access = await authorize(); }
    catch { return failure("AUTH_UNAVAILABLE", "Your session could not be verified. Please try again.", 503); }
    if (!access) return failure("FORBIDDEN", "Reviewer access is required.", 403);
    const input = checkSchema.safeParse(await readBoundedJson(request, 1024));
    if (!input.success) return failure("INVALID_INPUT", "Choose a proof file to read.", 400);
    const denied = limited(limit, "review", access.userId);
    if (denied) return denied;
    try { return json({ text: await access.read(input.data.evidenceId) }); }
    catch (error) {
      if (error instanceof ClaimError) return failure(error.code, error.message, error.status);
      return failure("READ_FAILED", "The file could not be read. Open it and review it yourself.", 503);
    }
  }
  return { POST };
}
