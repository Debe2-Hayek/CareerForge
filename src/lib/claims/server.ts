import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "../supabase/server";
import { historyAccess } from "../profile-history-server";
import { readSkillResults } from "../skill-checks";
import { buildClaimItems, claimRowSchema, type ClaimItem } from "./model";
import { readLanguages } from "../languages-server";
import { LEVELS, TEST_IDS, type LanguageTest } from "../languages";
import { ClaimError, type ClaimsAccess, type ReviewAccess } from "./handlers";
import { checkResultSchema, compareEvidence, evidenceCheckPrompt, extractionSchema, EVIDENCE_CHECK_PROMPT, type CheckResult } from "./evidence-check";
import { pdfText, tidyText } from "../ai/document-text";
import { fingerprintProof, sha256Hex } from "./fingerprint";
import { checkCourseraCertificate, issuerForLink, type LinkCheck } from "./issuers";
import { runAi, type AiRunStore } from "../ai/runner";
import type { AiProvider } from "../ai/provider";

const BUCKET = "claim-evidence";

async function signedInUser(client: SupabaseClient) {
  const { data: { user }, error } = await client.auth.getUser();
  if (error) {
    if (error.status === 400 || error.status === 401 || error.name === "AuthSessionMissingError") return null;
    throw new Error("Session verification unavailable");
  }
  return user;
}

function rpcFailure(error: { code?: string; message?: string }): never {
  const message = error.message ?? "";
  if (error.code === "23514" && message.includes("Already reviewed")) throw new ClaimError("ALREADY_REVIEWED", "This is already reviewed. Edit the record first if it changed.", 409);
  if (error.code === "23514" && message.includes("Too many files")) throw new ClaimError("TOO_MANY_FILES", "You can attach up to 5 files to one claim.", 409);
  if (error.code === "23514" && message.includes("Too many links")) throw new ClaimError("TOO_MANY_LINKS", "You can add up to 3 links to one claim.", 409);
  if (error.code === "23505") throw new ClaimError("LINK_EXISTS", "You already added this link.", 409);
  if (error.code === "23514") throw new ClaimError("NOT_AWAITING_REVIEW", "This claim is no longer waiting for review. Reload the queue.", 409);
  if (error.code === "55000" || error.code === "40001") throw new ClaimError("RECORD_CHANGED", "The owner edited this record after sending proof. It cannot be approved for the old version.", 409);
  if (error.code === "P0002") throw new ClaimError("NOT_FOUND", "This item is no longer in your profile. Reload the page.", 404);
  if (error.code === "42501") throw new ClaimError("FORBIDDEN", message.includes("own claims") ? "You cannot review your own claims." : "Reviewer access is required.", 403);
  if (error.code === "22023") throw new ClaimError("INVALID_INPUT", "Check the request and try again.", 400);
  throw new Error("Claims storage unavailable");
}

export async function authorizeClaims(): Promise<ClaimsAccess | null> {
  const client = await createClient();
  const user = await signedInUser(client);
  if (!user) return null;
  return {
    userId: user.id,
    async submitEvidence(input) {
      const path = `${user.id}/${randomUUID()}.${input.ext}`;
      const upload = await client.storage.from(BUCKET).upload(path, input.bytes, { contentType: input.mime, upsert: false });
      if (upload.error) throw new Error("Evidence upload failed");
      const { data, error } = await client.rpc("submit_claim_evidence", {
        p_kind: input.kind, p_record_id: input.recordId, p_skill: input.skill, p_storage_path: path,
        p_file_name: input.fileName, p_mime: input.mime, p_size: input.bytes.byteLength, p_sha256: input.sha256
      });
      if (error) {
        // Unreferenced uploads may be removed by their owner (storage policy).
        await client.storage.from(BUCKET).remove([path]).catch(() => {});
        rpcFailure(error);
      }
      return z.object({ claimId: z.uuid(), status: z.string() }).parse(data);
    },
    async addLink(input) {
      const { data, error } = await client.rpc("add_claim_link", { p_kind: input.kind, p_record_id: input.recordId, p_skill: input.skill, p_url: input.url });
      if (error) rpcFailure(error);
      return z.object({ claimId: z.uuid(), status: z.string() }).parse(data);
    }
  };
}

/** Admins only: a signed-in user whose profile role is admin, checked by the database. */
export async function authorizeReview(): Promise<(ReviewAccess & { client: SupabaseClient }) | null> {
  const client = await createClient();
  const user = await signedInUser(client);
  if (!user) return null;
  const { data, error } = await client.rpc("careerforge_is_admin");
  if (error) throw new Error("Role check unavailable");
  if (data !== true) return null;
  return {
    userId: user.id, client,
    async review(claimId, decision, note) {
      const { data: result, error: failed } = await client.rpc("review_claim", { p_claim_id: claimId, p_decision: decision, p_note: note });
      if (failed) rpcFailure(failed);
      return z.object({ claimId: z.uuid(), status: z.string() }).parse(result);
    }
  };
}

/** The owner's facts with their trust levels, for the verification page and profile ring. */
export async function readClaimsOverview(client: SupabaseClient, userId: string, skills: string[]): Promise<ClaimItem[]> {
  const [history, results, claims, evidence, catalog, links, languages] = await Promise.all([
    historyAccess(client, userId).readAll(),
    readSkillResults(client, userId),
    client.from("claims").select("id,kind,education_id,experience_id,language_id,skill,source_revision,subject,status,status_note,decided_at,updated_at").eq("user_id", userId),
    client.from("claim_evidence").select("claim_id").eq("user_id", userId),
    client.rpc("skill_check_catalog"),
    client.from("claim_links").select("claim_id").eq("user_id", userId),
    readLanguages(client, userId)
  ]);
  if (claims.error || evidence.error || links.error) throw new Error("Claims unavailable");
  const rows = z.array(claimRowSchema).parse(claims.data ?? []);
  const counts: Record<string, number> = {};
  for (const item of evidence.data ?? []) counts[item.claim_id] = (counts[item.claim_id] ?? 0) + 1;
  const linkCounts: Record<string, number> = {};
  for (const item of links.data ?? []) linkCounts[item.claim_id] = (linkCounts[item.claim_id] ?? 0) + 1;
  const passed = results.filter(result => result.passed).map(result => ({ skill: result.skill, takenAt: result.taken_at }));
  // Skills with a published CareerForge check (any skill an admin has published).
  const checkable = catalog.error ? undefined : z.array(z.object({ skill: z.string() }).loose()).catch([]).parse(catalog.data ?? []).map(bank => bank.skill);
  return buildClaimItems(history, skills, passed, rows, counts, checkable, linkCounts, languages);
}

const matchSchema = z.object({
  reason: z.enum(["same_file", "same_text", "same_number", "similar_image"]), path: z.string(), mime: z.string(),
  ownerName: z.string(), subject: z.string(), status: z.string(), uploadedAt: z.string()
});
const linkCheckSchema = z.object({
  status: z.enum(["confirmed", "name_mismatch", "not_found", "failed"]), holderName: z.string().nullable(), title: z.string().nullable(),
  issuer: z.string().nullable(), issuedOn: z.string().nullable(), checkedAt: z.string()
});
export type StoredLinkCheck = z.infer<typeof linkCheckSchema>;
const queueSchema = z.array(z.object({
  id: z.uuid(), kind: z.enum(["degree", "employment", "skill", "language"]), subject: z.string(), updatedAt: z.string(),
  language: z.object({ language: z.string(), level: z.enum(LEVELS), test: z.enum(TEST_IDS as [LanguageTest, ...LanguageTest[]]).nullable(), score: z.string().nullable(), testDate: z.string().nullable() }).nullable().catch(null),
  ownerName: z.string(), own: z.boolean(),
  record: z.object({ institution: z.string().nullable(), title: z.string(), startDate: z.string().nullable(), endDate: z.string().nullable(), isCurrent: z.boolean() }).nullable().catch(null),
  evidence: z.array(z.object({
    id: z.uuid(), path: z.string(), fileName: z.string(), mime: z.string(), size: z.number(), uploadedAt: z.string(), sha256: z.string(), duplicateOwners: z.number(),
    fingerprint: z.enum(["pending", "verified", "altered"]).catch("pending"),
    matches: z.array(matchSchema).catch([]),
    check: checkResultSchema.nullable().catch(null)
  })),
  links: z.array(z.object({ id: z.uuid(), url: z.string(), addedAt: z.string(), check: linkCheckSchema.nullable().catch(null) })).catch([])
}));
type RawQueueItem = z.infer<typeof queueSchema>[number];
type RawFile = RawQueueItem["evidence"][number];
export type ProofMatch = z.infer<typeof matchSchema> & { url: string | null };
export type QueueItem = Omit<RawQueueItem, "evidence"> & { evidence: (Omit<RawFile, "matches"> & { url: string | null; matches: ProofMatch[] })[] };

/** Claims awaiting review with short-lived links to their proof files (10 minutes). */
export async function readReviewQueue(client: SupabaseClient): Promise<QueueItem[]> {
  const { data, error } = await client.rpc("claim_review_queue");
  if (error) throw new Error("Review queue unavailable");
  const queue = queueSchema.parse(data ?? []);
  // Each file and every matching file from another account, so the reviewer can compare them.
  const paths = [...new Set(queue.flatMap(item => item.evidence.flatMap(file => [file.path, ...file.matches.map(match => match.path)])))];
  const signed = paths.length ? await client.storage.from(BUCKET).createSignedUrls(paths, 600) : { data: [], error: null };
  const urls = new Map((signed.data ?? []).map(entry => [entry.path, entry.signedUrl]));
  return queue.map(item => ({ ...item, evidence: item.evidence.map(file => ({
    ...file, url: urls.get(file.path) ?? null, matches: file.matches.map(match => ({ ...match, url: urls.get(match.path) ?? null }))
  })) }));
}

const backlogSchema = z.array(z.object({ id: z.uuid(), path: z.string(), mime: z.string() }));

async function recordFingerprint(client: SupabaseClient, evidenceId: string, bytes: Uint8Array, mime: string) {
  const print = await fingerprintProof(bytes, mime);
  const { error } = await client.rpc("record_evidence_fingerprint", { p_evidence_id: evidenceId, p_sha256: print.sha256, p_text_hash: print.textHash, p_image_hash: print.imageHash });
  if (error) throw new Error("Fingerprint could not be saved");
}

/**
 * Admin side: recompute the fingerprints of files that do not have one yet (waiting files
 * first) from the stored bytes. Runs before the queue is read; a failure only delays it.
 */
export async function refreshFingerprints(client: SupabaseClient, limit = 10): Promise<number> {
  const { data, error } = await client.rpc("evidence_fingerprint_backlog", { p_limit: limit });
  if (error) throw new Error("Fingerprint backlog unavailable");
  const files = backlogSchema.parse(data ?? []);
  let done = 0;
  for (let start = 0; start < files.length; start += 3) {
    await Promise.all(files.slice(start, start + 3).map(async file => {
      const download = await client.storage.from(BUCKET).download(file.path);
      if (download.error || !download.data) return;
      await recordFingerprint(client, file.id, new Uint8Array(await download.data.arrayBuffer()), file.mime);
      done++;
    }).map(task => task.catch(() => {})));
  }
  return done;
}

/**
 * Admin-only issuer check of one verification link on a claim awaiting review. Coursera
 * course certificates are read from Coursera; other issuers are opened by the reviewer.
 */
export async function runLinkCheck(client: SupabaseClient, linkId: string, fetchImpl: typeof fetch = fetch): Promise<LinkCheck & { checkedAt: string }> {
  const { data, error } = await client.rpc("claim_review_queue");
  if (error) throw new Error("Review queue unavailable");
  const queue = queueSchema.parse(data ?? []);
  const item = queue.find(entry => entry.links.some(link => link.id === linkId));
  const link = item?.links.find(entry => entry.id === linkId);
  if (!item || !link) throw new ClaimError("NOT_FOUND", "This link is no longer waiting for review. Reload the queue.", 404);
  const known = issuerForLink(link.url);
  if (!known?.courseraCode) throw new ClaimError("MANUAL_CHECK", "This issuer cannot be checked automatically. Open the link and compare it yourself.", 422);
  const result = await checkCourseraCertificate(known.courseraCode, item.ownerName === "Unnamed user" ? "" : item.ownerName, fetchImpl);
  const saved = await client.rpc("record_link_check", { p_link_id: linkId, p_status: result.status, p_holder_name: result.holderName, p_title: result.title, p_issuer: result.issuer, p_issued_on: result.issuedOn });
  if (saved.error) throw new Error("Check could not be saved");
  return { ...result, checkedAt: new Date().toISOString() };
}

/**
 * Admin-only AI proof check: reads one file in a claim awaiting review, compares it with
 * the claim, and stores the result (only admins can store results). The AI call uses the
 * admin's own usage ledger and is cached per file fingerprint.
 */
export async function runEvidenceCheck(client: SupabaseClient, runs: AiRunStore, provider: AiProvider, evidenceId: string): Promise<CheckResult> {
  const { data, error } = await client.rpc("claim_review_queue");
  if (error) throw new Error("Review queue unavailable");
  const queue = queueSchema.parse(data ?? []);
  const item = queue.find(entry => entry.evidence.some(file => file.id === evidenceId));
  const file = item?.evidence.find(entry => entry.id === evidenceId);
  if (!item || !file || !item.record) throw new ClaimError("NOT_FOUND", "This proof is no longer waiting for review. Reload the queue.", 404);
  const download = await client.storage.from(BUCKET).download(file.path);
  if (download.error || !download.data) throw new Error("Evidence download failed");
  const bytes = new Uint8Array(await download.data.arrayBuffer());
  // The fingerprint sent with the upload can be forged; cache by the real file instead.
  const realSha = sha256Hex(bytes);
  if (file.fingerprint === "pending") await recordFingerprint(client, file.id, bytes, file.mime).catch(() => {});

  let documentText: string | null = null;
  let images: string[] = [];
  if (file.mime === "application/pdf") {
    documentText = tidyText(await pdfText(bytes).catch(() => "")).slice(0, 6000);
  } else {
    images = [`data:${file.mime};base64,${Buffer.from(bytes).toString("base64")}`];
  }
  const context = { kind: item.kind, ownerName: item.ownerName, ...item.record };
  let result: Omit<CheckResult, "checkedAt">;
  // A scanned PDF has no text layer; reading page images is a later step, so say so honestly.
  if (documentText !== null && documentText.length < 30) {
    result = { status: "unreadable", model: null, extracted: extractionSchema.parse({ readable: false, notes: ["Scanned PDF without text: open the file to check it."] }), findings: [] };
  } else {
    const prompt = evidenceCheckPrompt(documentText);
    const run = await runAi(runs, provider, { feature: "evidence_check", promptVersion: EVIDENCE_CHECK_PROMPT, schema: extractionSchema, ...prompt, images, cacheKey: [realSha] });
    const compared = compareEvidence(context, run.value);
    result = { ...compared, model: run.model ?? "cached", extracted: run.value };
  }
  const saved = await client.rpc("record_evidence_check", { p_evidence_id: evidenceId, p_status: result.status, p_model: result.model, p_prompt_version: EVIDENCE_CHECK_PROMPT, p_extracted: result.extracted, p_findings: result.findings });
  if (saved.error) throw new Error("Check could not be saved");
  return { ...result, checkedAt: new Date().toISOString() };
}
