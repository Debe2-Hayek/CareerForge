import assert from "node:assert/strict";
import { test } from "node:test";
import { diagnosticHandlers, feedbackHandlers, type FeedbackCounts, type ProductSignalAccess } from "./product-signals";

const counts: FeedbackCounts = { "live-job-source": { upvotes: 4, frictionReports: 2 } };
function access(overrides: Partial<ProductSignalAccess> = {}): ProductSignalAccess {
  return { userId: "signal-owner", feedback: async () => {}, diagnostic: async () => {}, ...overrides };
}
function request(method: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/v1/product-signal", { method, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
}

test("roadmap feedback publishes aggregate counts but requires an owner for writes", async () => {
  const handlers = feedbackHandlers(async () => null, async () => counts);
  assert.deepEqual(await (await handlers.GET()).json(), { counts });
  assert.equal((await handlers.POST(request("POST", { nodeId: "live-job-source", kind: "upvote" }))).status, 401);
  assert.equal((await handlers.POST(request("POST", { nodeId: "live-job-source", kind: "upvote" }, { Origin: "https://wrong.example" }))).status, 403);
});

test("roadmap feedback accepts only known nodes and private bounded friction text", async () => {
  let saved: unknown;
  const handlers = feedbackHandlers(async () => access({ feedback: async input => { saved = input; } }), async () => counts);
  assert.equal((await handlers.POST(request("POST", { nodeId: "invented-node", kind: "upvote" }))).status, 400);
  assert.equal((await handlers.POST(request("POST", { nodeId: "live-job-source", kind: "friction", summary: "short" }))).status, 400);
  const response = await handlers.POST(request("POST", { nodeId: "live-job-source", kind: "friction", summary: "  The source status is hard to find.  " }));
  assert.equal(response.status, 201);
  assert.deepEqual(saved, { nodeId: "live-job-source", kind: "friction", summary: "The source status is hard to find." });
});

test("feedback and diagnostic writes enforce separate owner budgets", async () => {
  let writes = 0;
  const deny = (scope: "feedback" | "diagnostics", id: string) => { assert.equal(id, "signal-owner"); return scope === "feedback" ? 7 : 9; };
  const feedback = feedbackHandlers(async () => access({ feedback: async () => { writes++; } }), async () => counts, deny);
  const diagnostics = diagnosticHandlers(async () => access({ diagnostic: async () => { writes++; } }), async () => [], deny);
  const feedbackResponse = await feedback.POST(request("POST", { nodeId: "live-job-source", kind: "upvote" }));
  const diagnosticResponse = await diagnostics.POST(request("POST", { fingerprint: "abcdef12", kind: "slow-api", route: "/api/v1/profile", label: "Slow API response", durationMs: 1201 }));
  assert.equal(feedbackResponse.status, 429);
  assert.equal(feedbackResponse.headers.get("Retry-After"), "7");
  assert.equal(diagnosticResponse.status, 429);
  assert.equal(diagnosticResponse.headers.get("Retry-After"), "9");
  assert.equal(writes, 0);
});

test("diagnostics discard invalid or identifying payload shapes and never block anonymous UX", async () => {
  const handlers = diagnosticHandlers(async () => null, async () => []);
  const anonymous = await handlers.POST(request("POST", { fingerprint: "abcdef12", kind: "ui-error", route: "/account", label: "Unhandled UI error" }));
  assert.equal(anonymous.status, 202);
  assert.deepEqual(await anonymous.json(), { recorded: false, reason: "authentication_required" });
  assert.equal((await handlers.POST(request("POST", { fingerprint: "abcdef12", kind: "ui-error", route: "/account?email=person@example.com", label: "Unhandled UI error" }))).status, 400);
  assert.equal((await handlers.POST(request("POST", { fingerprint: "abcdef12", kind: "ui-error", route: "/account", label: "person@example.com failed" }))).status, 400);
});

test("diagnostic summary states its privacy threshold and successful writes are accepted", async () => {
  let saved: unknown;
  const issues = [{ fingerprint: "abcdef12", kind: "rage-click" as const, route: "/jobs", label: "Rage click pattern" as const, occurrences: 7, affectedUsers: 3, lastSeen: "2026-11-20T00:00:00.000Z" }];
  const handlers = diagnosticHandlers(async () => access({ diagnostic: async input => { saved = input; } }), async () => issues);
  assert.deepEqual(await (await handlers.GET()).json(), { privacyThreshold: 3, issues });
  const response = await handlers.POST(request("POST", { fingerprint: "abcdef12", kind: "api-error", route: "/api/v1/applications/:id", label: "API error response", durationMs: 1300 }));
  assert.equal(response.status, 202);
  assert.equal((await response.json()).recorded, true);
  assert.deepEqual(saved, { fingerprint: "abcdef12", kind: "api-error", route: "/api/v1/applications/:id", label: "API error response", durationMs: 1300 });
});
