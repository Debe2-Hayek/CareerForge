import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { plannedItems, readySections } from "@/lib/feature-directory";
import { featureFacts } from "@/lib/feature-facts";
import { features } from "@/lib/features";
import type { Workshop } from "@/lib/workshops/types";

const localRequire = createRequire(import.meta.url);
localRequire.extensions[".css"] = module => {
  module.exports = { __esModule: true, default: new Proxy({}, { get: (_target, property) => String(property) }) };
};

const now = Date.parse("2026-12-01T12:00:00Z");
const nothing = { snapshot: null, workshops: null, applications: null, passedChecks: null, skills: 0, now };

test("every feature appears exactly once, and planned work is never mixed with working tools", () => {
  const ready = readySections().flatMap(section => section.items), planned = plannedItems();
  const ids = [...ready, ...planned].map(item => item.id);
  assert.deepEqual([...ids].sort(), features.map(feature => feature.id).sort());
  assert.equal(new Set(ids).size, ids.length);
  for (const item of ready) assert.ok(["Available", "Pilot"].includes(features.find(feature => feature.id === item.id)!.status), item.id);
  for (const item of planned) assert.ok(["Planned", "Stretch"].includes(features.find(feature => feature.id === item.id)!.status), item.id);
  assert.equal(new Set(features.map(feature => feature.icon)).size, features.length, "every feature has its own icon");
  assert.equal(new Set(features.map(feature => feature.href)).size, features.length);
});

test("the directory shows sections, real facts and no internal codes", async () => {
  const { FeatureDirectory } = await import("./feature-directory");
  const html = renderToStaticMarkup(<FeatureDirectory sections={readySections()} planned={plannedItems()} facts={{ workshops: "3 live sessions coming up" }} />);
  for (const text of ["All features", "Learn", "Find work", "Coming later", "/workshops", "3 live sessions coming up", "not built yet"]) assert.ok(html.includes(text), text);
  const visible = html.replace(/<[^>]+>/g, " ");
  for (const feature of features) assert.equal(visible.includes(feature.module) && /^M[0-9]/.test(feature.module), false, "module codes stay internal");
});

test("facts state only what the records show", () => {
  assert.deepEqual(featureFacts(nothing), {});
  const base = { title: "T", format: "Live Online", durationMinutes: 60 } as Workshop;
  const catalog = (...starts: string[]) => ({ workshops: starts.map(startDateTime => ({ ...base, startDateTime })), sources: [], generatedAt: "" });
  assert.equal(featureFacts({ ...nothing, workshops: catalog("2026-12-02T12:00:00Z") }).workshops, "1 live session coming up");
  assert.equal(featureFacts({ ...nothing, workshops: catalog("2026-12-01T11:30:00Z", "2026-12-02T12:00:00Z") }).workshops, "1 session happening now");
  assert.equal(featureFacts({ ...nothing, workshops: catalog("2026-11-01T12:00:00Z") }).workshops, undefined);
  const facts = featureFacts({ ...nothing, applications: 2, passedChecks: ["React"], skills: 1 });
  assert.deepEqual(facts, { applications: "2 roles saved", "skill-checks": "Passed: React", profile: "1 skill listed" });
  assert.equal(featureFacts({ ...nothing, applications: 0, passedChecks: [] }).applications, undefined);
  const learning = featureFacts({ ...nothing, snapshot: { enrollments: [{ courseId: "frontend", goalId: "complete", level: "new", weeklyHours: 6, format: "mixed", contentVersion: 1, startedAt: "", lastActiveAt: "" }], progress: { frontend: { topics: { internet: "completed" }, projects: { "recipe-finder": { state: "building", evidenceUrl: null }, "kanban-board": { state: "completed", evidenceUrl: null } } } } } });
  assert.match(learning["learning-roadmap"], /^Frontend Developer: \d+% done$/);
  assert.equal(learning.projects, "1 in progress, 1 built");
});
