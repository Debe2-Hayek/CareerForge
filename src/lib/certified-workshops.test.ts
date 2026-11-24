import { test } from "node:test";
import assert from "node:assert/strict";
import { eligible, sessionText, workshopFieldsSchema, type WorkshopFields } from "./certified-workshops";
import { adminWorkshopHandlers, learnerWorkshopHandlers, staffWorkshopHandlers, WorkshopError, type AdminAccess, type LearnerAccess, type StaffAccess } from "./certified-workshops-handlers";

const fields = { title: "Docker in a day", mode: "online", startsAt: "2026-12-12T16:00:00.000Z", endsAt: "2026-12-12T18:00:00.000Z", capacity: 30, certificateKind: "attendance" };

test("workshop form: end after start, a pass mark only (and always) for assessed workshops", () => {
  assert.equal(workshopFieldsSchema.parse({ ...fields, passMark: 70 }).passMark, null, "attendance certificates have no pass mark");
  assert.equal(workshopFieldsSchema.parse({ ...fields, certificateKind: "assessed", passMark: 70 }).passMark, 70);
  assert.equal(workshopFieldsSchema.safeParse({ ...fields, certificateKind: "assessed" }).success, false);
  assert.equal(workshopFieldsSchema.safeParse({ ...fields, endsAt: fields.startsAt }).success, false);
  assert.equal(workshopFieldsSchema.safeParse({ ...fields, capacity: 0 }).success, false);
  assert.equal(workshopFieldsSchema.safeParse({ ...fields, title: "A" }).success, false);
  assert.equal(workshopFieldsSchema.safeParse({ ...fields, startsAt: "soon" }).success, false);
  assert.equal(workshopFieldsSchema.safeParse({ ...fields, extra: true }).success, false);
  assert.equal(sessionText(fields.startsAt, fields.endsAt), "12 Dec 2026, 16:00–18:00 UTC");
  assert.equal(sessionText(fields.startsAt, "2026-12-13T18:00:00.000Z"), "12 Dec 2026 – 13 Dec 2026");
});

test("who gets a certificate: present, enrolled, not yet issued, and (if assessed) at or above the pass mark", () => {
  const learner = { enrollmentId: "8b0c1f4e-7d55-4c55-9a51-0b9a1d1f2c3e", name: "A", status: "enrolled" as const, attended: true, score: 70, showName: true, certificate: null };
  const attendance = { certificateKind: "attendance" as const, passMark: null };
  const assessed = { certificateKind: "assessed" as const, passMark: 70 };
  assert.equal(eligible(learner, attendance), true);
  assert.equal(eligible(learner, assessed), true, "exactly the pass mark passes");
  assert.equal(eligible({ ...learner, score: 69 }, assessed), false);
  assert.equal(eligible({ ...learner, score: null }, assessed), false);
  assert.equal(eligible({ ...learner, attended: null }, attendance), false);
  assert.equal(eligible({ ...learner, attended: false }, attendance), false);
  assert.equal(eligible({ ...learner, status: "withdrawn" }, attendance), false);
  assert.equal(eligible({ ...learner, certificate: { id: learner.enrollmentId, issuedAt: "x", revokedAt: null } }, attendance), false, "never issued twice");
});

const ORIGIN = "http://localhost:3000";
const ID = "8b0c1f4e-7d55-4c55-9a51-0b9a1d1f2c3e";
const post = (path: string, body: unknown, origin = ORIGIN) => new Request(`${ORIGIN}${path}`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const noLimit = () => 0;

test("learner endpoint: origin, session and input; database refusals become clear messages", async () => {
  const calls: string[] = [];
  const access: LearnerAccess = { userId: "u", async enroll(id, show) { calls.push(`enroll:${show}`); if (id !== ID) throw new WorkshopError("FULL", "This workshop is full.", 409); }, async withdraw() { calls.push("withdraw"); } };
  const { POST } = learnerWorkshopHandlers(async () => access, noLimit);
  assert.equal((await POST(post("/api/v1/certified-workshops", { action: "enroll", workshopId: ID, showName: true }, "https://evil.example"))).status, 403);
  assert.equal((await learnerWorkshopHandlers(async () => null, noLimit).POST(post("/api/v1/certified-workshops", { action: "withdraw", workshopId: ID }))).status, 401);
  assert.equal((await POST(post("/api/v1/certified-workshops", { action: "enroll", workshopId: ID }))).status, 400, "the name choice is required");
  assert.equal((await POST(post("/api/v1/certified-workshops", { action: "issue", workshopId: ID }))).status, 400, "learners cannot issue");
  assert.equal((await POST(post("/api/v1/certified-workshops", { action: "enroll", workshopId: ID, showName: false }))).status, 200);
  const full = await POST(post("/api/v1/certified-workshops", { action: "enroll", workshopId: "1b0c1f4e-7d55-4c55-9a51-0b9a1d1f2c3e", showName: true }));
  assert.equal(full.status, 409);
  assert.equal((await POST(post("/api/v1/certified-workshops", { action: "withdraw", workshopId: ID }))).status, 200);
  assert.deepEqual(calls, ["enroll:false", "enroll:true", "withdraw"]);
});

test("staff endpoint: marks, issues and revokes; absent learners never keep a score; revoking needs a reason", async () => {
  const marks: [string, boolean, number | null][] = [];
  const access: StaffAccess = { userId: "t", async mark(id, attended, score) { marks.push([id, attended, score]); }, async issue() { return 3; }, async revoke() {} };
  const { POST } = staffWorkshopHandlers(async () => access, noLimit);
  assert.equal((await POST(post("/api/v1/certified-workshops/staff", { action: "mark", enrollmentId: ID, attended: false, score: 90 }))).status, 200);
  assert.deepEqual(marks[0], [ID, false, null]);
  assert.equal((await POST(post("/api/v1/certified-workshops/staff", { action: "mark", enrollmentId: ID, attended: true, score: 101 }))).status, 400);
  const issued = await POST(post("/api/v1/certified-workshops/staff", { action: "issue", workshopId: ID }));
  assert.deepEqual(await issued.json(), { issued: 3 });
  assert.equal((await POST(post("/api/v1/certified-workshops/staff", { action: "revoke", certificateId: ID, reason: " " }))).status, 400);
  assert.equal((await POST(post("/api/v1/certified-workshops/staff", { action: "revoke", certificateId: ID, reason: "Attendance recorded by mistake" }))).status, 200);
  const notStaff: StaffAccess = { ...access, async issue() { throw new WorkshopError("FORBIDDEN", "You are not staff for this workshop.", 403); } };
  assert.equal((await staffWorkshopHandlers(async () => notStaff, noLimit).POST(post("/api/v1/certified-workshops/staff", { action: "issue", workshopId: ID }))).status, 403);
});

test("admin endpoint: admins only, validated fields, unknown trainer emails explained", async () => {
  const saved: WorkshopFields[] = [];
  const access: AdminAccess = { userId: "a", async save(_id, value) { saved.push(value); return ID; }, async assign(_id, email) { return email === "trainer@example.com" || email === ""; } };
  const { POST } = adminWorkshopHandlers(async () => access, noLimit);
  assert.equal((await adminWorkshopHandlers(async () => null, noLimit).POST(post("/api/v1/admin/certified-workshops", { action: "save", fields }))).status, 403);
  const bad = await POST(post("/api/v1/admin/certified-workshops", { action: "save", fields: { ...fields, certificateKind: "assessed" } }));
  assert.equal(bad.status, 400);
  assert.match(((await bad.json()) as { error: { message: string } }).error.message, /pass mark/);
  assert.equal((await POST(post("/api/v1/admin/certified-workshops", { action: "save", fields }))).status, 201);
  assert.equal((await POST(post("/api/v1/admin/certified-workshops", { action: "save", id: ID, fields }))).status, 200);
  assert.equal(saved.length, 2);
  assert.equal((await POST(post("/api/v1/admin/certified-workshops", { action: "assign", workshopId: ID, email: "not-an-email" }))).status, 400);
  assert.equal((await POST(post("/api/v1/admin/certified-workshops", { action: "assign", workshopId: ID, email: "nobody@example.com" }))).status, 404);
  assert.equal((await POST(post("/api/v1/admin/certified-workshops", { action: "assign", workshopId: ID, email: "trainer@example.com" }))).status, 200);
  assert.equal((await POST(post("/api/v1/admin/certified-workshops", { action: "assign", workshopId: ID, email: "" }))).status, 200, "an empty email clears the trainer");
});
