import assert from "node:assert/strict";
import { test } from "node:test";
import { learningHandlers, LearningError, type LearningAccess } from "./handlers";
import { toSnapshot } from "./api";

const enrollment = { courseId: "python", goalId: "backend", level: "new", weeklyHours: 6, format: "mixed" };
const topic = { courseId: "python", kind: "topic", itemId: "functions", state: "completed" };
const project = { courseId: "python", kind: "project", itemId: "calculator", state: "completed", evidenceUrl: "https://github.com/example/calculator" };
const request = (path: string, body: unknown, origin = "http://localhost:3000", method = "PUT") =>
  new Request(`http://localhost:3000/api/v1/learning${path}`, { method, headers: { Origin: origin }, body: JSON.stringify(body) });

function fakeAccess(overrides: Partial<LearningAccess> = {}) {
  const calls: unknown[] = [];
  const access: LearningAccess = {
    userId: "verified-owner",
    snapshot: async () => ({ enrollments: [], progress: {} }),
    enroll: async input => { calls.push(input); },
    saveProgress: async input => { calls.push(input); },
    ...overrides
  };
  return { access, calls };
}

test("learning API blocks foreign origins and anonymous users before any work", async () => {
  let authorizations = 0;
  const handlers = learningHandlers(async () => { authorizations++; return null; });
  assert.equal((await handlers.enroll(request("/enrollments", enrollment, "https://evil.example"))).status, 403);
  assert.equal((await handlers.progress(request("/progress", topic, "https://evil.example"))).status, 403);
  assert.equal(authorizations, 0);
  assert.equal((await handlers.enroll(request("/enrollments", enrollment))).status, 401);
  assert.equal((await handlers.GET(new Request("http://localhost:3000/api/v1/learning"))).status, 401);
});

test("learning API validates shape and curriculum ids before writing", async () => {
  const { access, calls } = fakeAccess();
  const handlers = learningHandlers(async () => access, () => 0);
  const invalid = [
    ["/enrollments", { ...enrollment, weeklyHours: 0 }],
    ["/enrollments", { ...enrollment, weeklyHours: 41 }],
    ["/enrollments", { ...enrollment, userId: "someone-else" }],
    ["/enrollments", { ...enrollment, courseId: "cobol" }],
    ["/enrollments", { ...enrollment, goalId: "astronaut" }],
    ["/progress", { ...topic, itemId: "not-a-topic" }],
    ["/progress", { ...topic, state: "building" }],
    ["/progress", { ...topic, evidenceUrl: "https://example.com" }],
    ["/progress", { ...project, itemId: "functions" }],
    ["/progress", { ...project, evidenceUrl: "http://insecure.example" }],
    ["/progress", { ...project, evidenceUrl: "javascript:alert(1)" }],
    ["/progress", { ...project, evidenceUrl: "https://user:pass@example.com/repo" }]
  ] as const;
  for (const [path, body] of invalid) {
    const handler = path === "/enrollments" ? handlers.enroll : handlers.progress;
    assert.equal((await handler(request(path, body))).status, 400, JSON.stringify(body));
  }
  assert.equal(calls.length, 0);
  assert.equal((await handlers.enroll(request("/enrollments", enrollment))).status, 200);
  assert.equal((await handlers.progress(request("/progress", topic))).status, 200);
  assert.equal((await handlers.progress(request("/progress", project))).status, 200);
  assert.equal((await handlers.progress(request("/progress", { ...topic, state: null }))).status, 200);
  assert.equal(calls.length, 4);
});

test("learning API applies the owner's write budget and keeps responses private", async () => {
  const { access, calls } = fakeAccess();
  const handlers = learningHandlers(async () => access, (scope, owner) => { assert.equal(scope, "learning"); assert.equal(owner, "verified-owner"); return 5; });
  const limited = await handlers.progress(request("/progress", topic));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "5");
  assert.equal(calls.length, 0);
  const read = await learningHandlers(async () => access).GET(new Request("http://localhost:3000/api/v1/learning"));
  assert.equal(read.status, 200);
  assert.equal(read.headers.get("cache-control"), "no-store");
  assert.equal((await learningHandlers(async () => access).GET(new Request("http://localhost:3000/api/v1/learning?user=other"))).status, 400);
});

test("learning API maps domain errors and hides internal failures", async () => {
  const notEnrolled = learningHandlers(async () => fakeAccess({ saveProgress: async () => { throw new LearningError("NOT_ENROLLED", "Start this learning path first.", 409); } }).access, () => 0);
  assert.equal((await notEnrolled.progress(request("/progress", topic))).status, 409);
  const broken = learningHandlers(async () => fakeAccess({ enroll: async () => { throw new Error("relation secret_table does not exist"); } }).access, () => 0);
  const response = await broken.enroll(request("/enrollments", enrollment));
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes("secret_table"), false);
});

test("snapshots map rows by course and ignore states that are invalid for their kind", () => {
  const snapshot = toSnapshot(
    [{ course_id: "python", goal_id: "data", experience_level: "some", weekly_hours: 8, resource_format: "video", content_version: 1, started_at: "2026-11-21T10:00:00Z", last_active_at: "2026-11-21T11:00:00Z" }],
    [
      { course_id: "python", item_kind: "topic", item_id: "functions", state: "completed", evidence_url: null },
      { course_id: "python", item_kind: "topic", item_id: "loops", state: "building", evidence_url: null },
      { course_id: "python", item_kind: "project", item_id: "calculator", state: "building", evidence_url: null }
    ]
  );
  assert.equal(snapshot.enrollments[0].goalId, "data");
  assert.deepEqual(snapshot.progress.python.topics, { functions: "completed" });
  assert.deepEqual(snapshot.progress.python.projects, { calculator: { state: "building", evidenceUrl: null } });
});
