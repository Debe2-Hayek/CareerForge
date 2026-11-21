import assert from "node:assert/strict";
import { test } from "node:test";
import { prioritizeFeedback, prioritizeFriction, prioritizeIssues } from "./product-signals-export-lib";

test("diagnostic priority favors errors and preserves anonymous aggregates only", () => {
  const result = prioritizeIssues([
    { fingerprint: "slow0001", kind: "slow-api", route: "/api/v1/profile", label: "Slow API response", occurrences: 40, affectedUsers: 5, durationMs: 4200, lastSeen: "2026-11-20T00:00:00.000Z" },
    { fingerprint: "error001", kind: "ui-error", route: "/account", label: "Unhandled UI error", occurrences: 3, affectedUsers: 3, lastSeen: "2026-11-20T00:00:00.000Z" }
  ]);
  assert.equal(result[0].kind, "ui-error");
  assert.ok(result.every(issue => !("userId" in issue) && !("message" in issue)));
});

test("feedback priority weights friction above a passive vote", () => {
  const result = prioritizeFeedback({
    "node-votes": { upvotes: 5, frictionReports: 0 },
    "node-friction": { upvotes: 1, frictionReports: 2 }
  });
  assert.equal(result[0].nodeId, "node-friction");
});

test("friction queue excludes passive votes and exports aggregate counts only", () => {
  const result = prioritizeFriction({
    "passive-votes": { upvotes: 20, frictionReports: 0 },
    "repeated-friction": { upvotes: 1, frictionReports: 3 },
    "popular-friction": { upvotes: 8, frictionReports: 2 }
  });
  assert.deepEqual(result.map(item => item.nodeId), ["repeated-friction", "popular-friction"]);
  assert.ok(result.every(item => !("summary" in item) && !("userId" in item)));
});
