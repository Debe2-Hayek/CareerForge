import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClaimItems, evidenceType, trustSummary, type ClaimRow } from "./model";
import { claimEvidenceHandlers, claimReviewHandlers, ClaimError, type ClaimsAccess, type EvidenceInput, type ReviewAccess } from "./handlers";
import { profileStrength } from "../profile-strength";
import { emptyProfile } from "../account/schemas";
import type { ProfileHistory } from "../profile-history";

const ids = { edu: "11111111-1111-4111-8111-111111111111", job: "22222222-2222-4222-8222-222222222222", rev1: "33333333-3333-4333-8333-333333333333", rev2: "44444444-4444-4444-8444-444444444444", claim: "55555555-5555-4555-8555-555555555555" };
const meta = { createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z", evidenceStatus: "self_reported" as const, startDate: null, endDate: null, isCurrent: false };
const history: ProfileHistory = {
  education: [{ ...meta, id: ids.edu, revision: ids.rev1, institution: "Lebanese American University", degree: "B.E. Computer Engineering", gpa: null, gpaScale: null }],
  experience: [{ ...meta, id: ids.job, revision: ids.rev1, company: "Murex", role: "Backend Developer", description: "" }]
};
const row = (over: Partial<ClaimRow>): ClaimRow => ({ id: ids.claim, kind: "degree", education_id: ids.edu, experience_id: null, skill: null, source_revision: ids.rev1, subject: "x", status: "evidence_submitted", status_note: null, decided_at: null, updated_at: "2026-11-20T00:00:00.000Z", ...over });

test("trust levels: self-declared by default, proof pending, reviewed, verified by check, and changed after edits", () => {
  const plain = buildClaimItems(history, ["React", "Docker"], [], [], {});
  assert.deepEqual(plain.map(item => item.status), ["self_declared", "self_declared", "self_declared", "self_declared"]);
  assert.equal(plain.find(item => item.title === "React")?.checkAvailable, true);
  assert.equal(plain.find(item => item.title === "Docker")?.checkAvailable, false);

  const items = buildClaimItems(history, ["react", "Docker"], [{ skill: "React", takenAt: "2026-11-10T00:00:00.000Z" }], [
    row({ status: "reviewed", decided_at: "2026-11-21T00:00:00.000Z" }),
    row({ id: "66666666-6666-4666-8666-666666666666", kind: "employment", education_id: null, experience_id: ids.job, source_revision: ids.rev2 }),
    row({ id: "77777777-7777-4777-8777-777777777777", kind: "skill", education_id: null, skill: "docker", source_revision: null, status: "rejected", status_note: "Name does not match." })
  ], { [ids.claim]: 2 });
  const by = (title: string) => items.find(item => item.title.toLowerCase() === title.toLowerCase())!;
  assert.equal(by("B.E. Computer Engineering").status, "reviewed");
  assert.equal(by("B.E. Computer Engineering").evidenceCount, 2);
  assert.equal(by("Backend Developer").status, "changed", "proof was for an older revision of the job");
  assert.equal(by("react").status, "verified");
  assert.equal(by("react").method, "CareerForge check");
  assert.equal(by("react").checkAvailable, false);
  assert.equal(by("Docker").status, "rejected");
  assert.equal(by("Docker").note, "Name does not match.");
  assert.deepEqual(trustSummary(items), { total: 4, confirmed: 2, pending: 0, selfDeclared: 2 });
});

test("proof file type comes from the bytes, not the name", () => {
  assert.deepEqual(evidenceType(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])), { mime: "application/pdf", ext: "pdf" });
  assert.deepEqual(evidenceType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), { mime: "image/png", ext: "png" });
  assert.deepEqual(evidenceType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), { mime: "image/jpeg", ext: "jpg" });
  assert.equal(evidenceType(new TextEncoder().encode("<svg onload=alert(1)>")), null);
  assert.equal(evidenceType(new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03])), null, "an executable renamed to .pdf is refused");
});

test("profile strength rewards completeness and weighs proof most", () => {
  const empty = profileStrength(emptyProfile, { education: 0, experience: 0, claims: null });
  assert.equal(empty.percent, 0);
  assert.equal(empty.next?.id, "intro");
  assert.equal(empty.level.title, "Let's get you started");
  const full = profileStrength({ ...emptyProfile, name: "Rana", headline: "Backend developer", bio: "I build payment APIs and love clean, well-tested code.", skills: ["Java", "SQL", "Docker"] },
    { education: 1, experience: 1, claims: { proofSent: 1, confirmed: 1 } });
  assert.equal(full.percent, 100);
  assert.equal(full.next, null);
  assert.equal(full.level.title, "Standout profile");
  const noProof = profileStrength({ ...emptyProfile, name: "Rana", headline: "Dev", skills: ["a", "b", "c"] }, { education: 1, experience: 0, claims: { proofSent: 0, confirmed: 0 } });
  assert.equal(noProof.percent, 45);
  assert.equal(noProof.next?.id, "story");
});

const ORIGIN = "http://localhost:3000";
async function upload(fields: Record<string, string | Blob>, origin = ORIGIN) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  const body = await new Request(ORIGIN, { method: "POST", body: form });
  const bytes = await body.arrayBuffer();
  return new Request(`${ORIGIN}/api/v1/claims/evidence`, { method: "POST", headers: { Origin: origin, "content-type": body.headers.get("content-type") ?? "", "content-length": String(bytes.byteLength) }, body: bytes });
}
const pdf = () => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])], "diploma.pdf", { type: "application/pdf" });
const noLimit = () => 0;

test("proof upload: origin, session, target and real file type are checked before storage", async () => {
  const seen: EvidenceInput[] = [];
  const access: ClaimsAccess = { userId: "u1", async submitEvidence(input) { seen.push(input); return { claimId: ids.claim, status: "evidence_submitted" }; } };
  const { POST } = claimEvidenceHandlers(async () => access, noLimit);
  assert.equal((await POST(await upload({ kind: "degree", recordId: ids.edu, file: pdf() }, "https://evil.example"))).status, 403);
  assert.equal((await claimEvidenceHandlers(async () => null, noLimit).POST(await upload({ kind: "degree", recordId: ids.edu, file: pdf() }))).status, 401);
  assert.equal((await POST(await upload({ kind: "degree", recordId: "not-a-uuid", file: pdf() }))).status, 400);
  assert.equal((await POST(await upload({ kind: "passport", recordId: ids.edu, file: pdf() }))).status, 400);
  assert.equal((await POST(await upload({ kind: "skill", file: pdf() }))).status, 400, "a skill name is required");
  const fake = new File([new TextEncoder().encode("MZ fake")], "diploma.pdf", { type: "application/pdf" });
  assert.equal((await POST(await upload({ kind: "degree", recordId: ids.edu, file: fake }))).status, 400);
  assert.equal(seen.length, 0);
  const ok = await POST(await upload({ kind: "degree", recordId: ids.edu, file: new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "../../diploma\u0000.pdf") }));
  assert.equal(ok.status, 201);
  assert.equal(seen[0].mime, "application/pdf");
  assert.match(seen[0].sha256, /^[0-9a-f]{64}$/);
  assert.equal(seen[0].fileName.includes("/"), false, "path separators are stripped from file names");
  assert.equal(seen[0].fileName.includes("\u0000"), false);
  const tooBig = new Request(`${ORIGIN}/api/v1/claims/evidence`, { method: "POST", headers: { Origin: ORIGIN, "content-type": "multipart/form-data; boundary=x", "content-length": String(5 * 1024 * 1024) }, body: "x" });
  assert.equal((await POST(tooBig)).status, 400);
});

test("proof upload maps database refusals to clear errors without leaking details", async () => {
  const access: ClaimsAccess = { userId: "u1", async submitEvidence() { throw new ClaimError("ALREADY_REVIEWED", "This is already reviewed.", 409); } };
  const response = await claimEvidenceHandlers(async () => access, noLimit).POST(await upload({ kind: "degree", recordId: ids.edu, file: pdf() }));
  assert.equal(response.status, 409);
  const crash: ClaimsAccess = { userId: "u1", async submitEvidence() { throw new Error("relation claims: secret detail"); } };
  const failed = await claimEvidenceHandlers(async () => crash, noLimit).POST(await upload({ kind: "degree", recordId: ids.edu, file: pdf() }));
  assert.equal(failed.status, 503);
  assert.equal((await failed.text()).includes("secret"), false);
});

test("review: only admins, a reason is required to reject, and decisions pass through", async () => {
  const json = (body: unknown, origin = ORIGIN) => new Request(`${ORIGIN}/api/v1/admin/claims/review`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const decisions: string[] = [];
  const admin: ReviewAccess = { userId: "admin", async review(claimId, decision, note) { decisions.push(`${decision}:${note}`); return { claimId, status: decision === "approve" ? "reviewed" : "rejected" }; } };
  const { POST } = claimReviewHandlers(async () => admin, noLimit);
  assert.equal((await claimReviewHandlers(async () => null, noLimit).POST(json({ claimId: ids.claim, decision: "approve" }))).status, 403);
  assert.equal((await POST(json({ claimId: ids.claim, decision: "approve" }, "https://evil.example"))).status, 403);
  assert.equal((await POST(json({ claimId: ids.claim, decision: "reject" }))).status, 400, "reject needs a reason");
  assert.equal((await POST(json({ claimId: ids.claim, decision: "reject", note: "   " }))).status, 400);
  assert.equal((await POST(json({ claimId: ids.claim, decision: "delete" }))).status, 400);
  assert.equal((await POST(json({ claimId: ids.claim, decision: "approve", extra: true }))).status, 400);
  assert.equal((await POST(json({ claimId: ids.claim, decision: "approve" }))).status, 200);
  assert.equal((await POST(json({ claimId: ids.claim, decision: "reject", note: "Name does not match." }))).status, 200);
  assert.deepEqual(decisions, ["approve:", "reject:Name does not match."]);
  const own: ReviewAccess = { userId: "admin", async review() { throw new ClaimError("FORBIDDEN", "You cannot review your own claims.", 403); } };
  assert.equal((await claimReviewHandlers(async () => own, noLimit).POST(json({ claimId: ids.claim, decision: "approve" }))).status, 403);
});
