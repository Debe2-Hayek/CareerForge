import { test } from "node:test";
import assert from "node:assert/strict";
import { eligibleCVSkills, checkSubmission, bankSchema, submissionResultSchema, checkSessionSchema, sessionActionSchema, checkStandings, checkHref, findCheck, type CheckResult } from "./skill-checks";
const result: CheckResult = { skill: "React", version: 1, score: 4, passed: true, taken_at: "2026-10-23" };
test("CV requires selected skills and a passing check for that skill", () => {
  assert.deepEqual(eligibleCVSkills(["react", "SQL", "TypeScript"], [result]), ["react"]);
  for (const change of [{ passed: false }, { skill: "Docker" }]) assert.deepEqual(eligibleCVSkills(["React", "TypeScript"], [{ ...result, ...change }]), []);
  // Any published skill can be checked now, and a pass on an earlier version still counts.
  assert.deepEqual(eligibleCVSkills(["TypeScript"], [{ ...result, skill: "TypeScript", version: 3 }]), ["TypeScript"]);
  assert.deepEqual(eligibleCVSkills(["SQL"], [result]), []);
});
test("submissions cannot supply a pass or score and require a complete answer set", () => {
  const input = { sessionId: "f6d04d98-8104-4ea6-8cfa-c488c9af2197", answers: { r1: 0, r2: 1, r3: 2, r4: 0, r5: 1 } };
  assert.equal(checkSubmission.safeParse(input).success, true);
  for (const candidate of [{ ...input, score: 5 }, { ...input, passed: true }, { ...input, user_id: "other" }, { ...input, version: 2 }, { ...input, answers: {} }]) assert.equal(checkSubmission.safeParse(candidate).success, false);
});
test("client bank schema rejects answer keys", () => {
  const questions = Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, prompt: "Question", options: ["A", "B", "C"], answer: 1 }));
  assert.equal(bankSchema.safeParse([{ skill: "React", version: 1, questions }]).success, false);
});

test("a saved result must have consistent bounded grading and provenance", () => {
  const saved = { skill: "React", version: 1, score: 4, total: 5, passed: true, takenAt: "2026-10-28T10:00:00+00:00" };
  assert.equal(submissionResultSchema.safeParse(saved).success, true);
  assert.equal(submissionResultSchema.safeParse({ ...saved, score: 2, passed: false, retryAt: "2026-10-29T10:00:00+00:00" }).success, true);
  for (const change of [{ score: 3 }, { passed: false }, { total: 10 }, { score: 6 }, { score: 4.5 }, { version: 0 }, { version: 1.5 }, { skill: "" }, { skill: "x".repeat(61) }, { takenAt: "yesterday" }]) {
    assert.equal(submissionResultSchema.safeParse({ ...saved, ...change }).success, false);
  }
});

test("attempts are untimed (24-hour lifetime), carry their questions, and start cannot supply timing", () => {
  const questions = Array.from({ length: 5 }, (_, i) => ({ id: `r${i + 1}`, prompt: "Question", options: ["A", "B", "C"] }));
  const session = { id: "f6d04d98-8104-4ea6-8cfa-c488c9af2197", skill: "React", version: 1, timingMode: "untimed", state: "active", startedAt: "2026-11-26T10:00:00Z", deadlineAt: "2026-11-27T10:00:00Z", serverNow: "2026-11-26T10:00:00Z", questions };
  assert.equal(checkSessionSchema.safeParse(session).success, true);
  assert.equal(checkSessionSchema.safeParse({ ...session, timingMode: "standard", deadlineAt: "2026-11-26T10:10:00Z" }).success, true, "an older timed attempt still reads");
  assert.equal(checkSessionSchema.safeParse({ ...session, deadlineAt: "2026-11-26T10:11:00Z" }).success, false);
  assert.equal(checkSessionSchema.safeParse({ ...session, questions: [{ ...questions[0], answer: 1 }] }).success, false, "answers never reach the browser");
  assert.equal(sessionActionSchema.safeParse({ action: "start", skill: "React" }).success, true);
  assert.equal(sessionActionSchema.safeParse({ action: "start", skill: "React", addToProfile: true }).success, true);
  for (const extra of [{ startedAt: session.startedAt }, { timingMode: "extended" }, { version: 1 }]) assert.equal(sessionActionSchema.safeParse({ action: "start", skill: "React", ...extra }).success, false);
});

test("standings: latest pass, latest score, and a 24-hour wait only after a failed latest attempt", () => {
  const now = Date.parse("2026-11-26T12:00:00Z");
  const at = (hoursAgo: number) => new Date(now - hoursAgo * 3600000).toISOString();
  const standings = checkStandings([
    { skill: "React", version: 1, score: 5, passed: true, taken_at: at(30) },
    { skill: "React", version: 1, score: 2, passed: false, taken_at: at(3) },
    { skill: "SQL", version: 1, score: 3, passed: false, taken_at: at(25) },
    { skill: "Docker", version: 1, score: 2, passed: false, taken_at: at(5) },
    { skill: "Docker", version: 1, score: 4, passed: true, taken_at: at(1) }
  ], now);
  const react = standings.get("react")!;
  assert.equal(react.passedAt, at(30), "an earlier pass still counts after a later fail");
  assert.equal(react.lastScore, 2);
  assert.equal(react.retryAt, new Date(now + 21 * 3600000).toISOString());
  assert.equal(standings.get("sql")!.retryAt, null, "the wait is over after 24 hours");
  assert.equal(standings.get("docker")!.retryAt, null, "a later pass ends the wait");
  assert.equal(checkHref("C++"), "/skill-checks?skill=C%2B%2B");
  assert.equal(findCheck(["React", "SQL"], " react "), "React");
  assert.equal(findCheck(["React"], "Vue"), null);
});
