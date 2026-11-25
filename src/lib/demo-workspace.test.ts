import assert from "node:assert/strict";
import { test } from "node:test";
import { initialWorkspace, matchSkills, readWorkspace } from "./demo-workspace";

test("skill matching normalizes aliases, case, whitespace and duplicate requirements", () => {
  assert.deepEqual(matchSkills([" JS ", "react", "React"], ["JavaScript", "React", "react", "SQL"]), { score: 67, missing: ["SQL"] });
  assert.deepEqual(matchSkills(["ts", "nodejs"], ["TypeScript", "Node.js"]), { score: 100, missing: [] });
});
test("empty skills do not produce invalid scores or imply readiness", () => {
  assert.deepEqual(matchSkills([], ["React"]), { score: 0, missing: ["React"] });
  assert.deepEqual(matchSkills(["React"], []), { score: 0, missing: [] });
  assert.deepEqual(matchSkills([], [" "]), { score: 0, missing: [] });
});
test("malformed browser storage falls back to a usable demo", () => {
  for (const raw of [null, "broken", "null", "[]", '{}', '{"profile":null,"applications":{}}', JSON.stringify({ profile: { ...initialWorkspace.profile, skills: [42] }, applications: {} })]) {
    assert.deepEqual(readWorkspace(raw), initialWorkspace);
  }
});
test("browser state preserves valid edits and discards unknown jobs and invalid statuses", () => {
  const saved = { profile: { ...initialWorkspace.profile, name: "Sam", skills: ["SQL"] }, applications: { "1": "Interview", "2": "invented", "99": "Saved" } };
  assert.deepEqual(readWorkspace(JSON.stringify(saved)), { profile: saved.profile, applications: { "1": "Interview" } });
});

test("jobs are ranked by matched skills, then percentage, then newest", async () => {
  const { rankJobs } = await import("./demo-workspace");
  const jobs = [
    { id: "one-skill", skills: ["SQL"], publishedAt: "2026-11-20" },
    { id: "two-of-four", skills: ["SQL", "Python", "Go", "Rust"], publishedAt: "2026-11-01" },
    { id: "two-of-two-old", skills: ["SQL", "Python"], publishedAt: "2026-10-01" },
    { id: "two-of-two-new", skills: ["sql", "python"], publishedAt: "2026-11-10" },
    { id: "none", skills: ["Java"], publishedAt: "2026-11-24" }
  ];
  assert.deepEqual(rankJobs(jobs, ["SQL", "Python"]).map(job => job.id), ["two-of-two-new", "two-of-two-old", "two-of-four", "one-skill", "none"]);
});
