import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { LearningSnapshot } from "@/lib/learning/api";
import { getCourse } from "@/lib/learning/catalog";
import { buildLearningPlan, type LearningProgress, type LearningSettings } from "@/lib/learning/plan";
import { recommendNextSteps } from "@/lib/learning/recommendations";

// CSS modules resolve to their class names; next/navigation needs a mounted app
// router, so client components get an inert router for static rendering.
const localRequire = createRequire(import.meta.url);
localRequire.extensions[".css"] = module => {
  module.exports = { __esModule: true, default: new Proxy({}, { get: (_target, property) => String(property) }) };
};
const navigation = localRequire.resolve("next/navigation");
localRequire.cache[navigation] = { id: navigation, filename: navigation, loaded: true, exports: { useRouter: () => ({ refresh() {}, replace() {}, push() {} }) } } as unknown as NodeJS.Module;

const python = getCourse("python")!;
const settings: LearningSettings = { goalId: "backend", level: "new", weeklyHours: 6, format: "interactive" };
const hrefs = { topic: (id: string) => `/learning-roadmap/python?topic=${id}`, view: (view: string) => `/learning-roadmap/python?view=${view}`, close: "/learning-roadmap/python" };

async function renderRoadmap(mode: "enrolled" | "preview", progress: LearningProgress, selectedTopicId: string | null = null, storageAvailable = true) {
  const { CourseRoadmap } = await import("./course-roadmap");
  const plan = buildLearningPlan(python, settings, progress);
  return renderToStaticMarkup(<CourseRoadmap course={python} plan={plan} mode={mode} view="path" selectedTopicId={selectedTopicId}
    recommendations={recommendNextSteps(python, plan)} hrefs={hrefs} storageAvailable={storageAvailable} />);
}

test("dashboard explains the journey, lists real paths and offers no fake continue state", async () => {
  const { LearningDashboard } = await import("./learning-dashboard");
  const html = renderToStaticMarkup(<LearningDashboard snapshot={{ enrollments: [], progress: {} }} />);
  assert.ok(html.includes("Learn for free"));
  assert.ok(html.includes("/learning-roadmap/python"));
  assert.ok(html.includes("/learning-roadmap/careers?track=backend"));
  assert.ok(html.includes("Guided path") && html.includes("Career roadmap"));
  assert.equal(html.includes("Pick up where you left off"), false);
  assert.equal(html.includes("Popular"), false);
});

test("dashboard resumes an enrolment with honest progress and degrades when storage is down", async () => {
  const { LearningDashboard } = await import("./learning-dashboard");
  const snapshot: LearningSnapshot = {
    enrollments: [{ courseId: "python", ...settings, contentVersion: 1, startedAt: "2026-11-21T10:00:00Z", lastActiveAt: "2026-11-21T10:00:00Z" }],
    progress: { python: { topics: { "how-programs-work": "completed", "python-setup": "in_progress" }, projects: {} } }
  };
  const html = renderToStaticMarkup(<LearningDashboard snapshot={snapshot} />);
  assert.ok(html.includes("Pick up where you left off"));
  assert.ok(html.includes("Install Python and an editor"));
  assert.ok(html.includes("Continue topic"));
  assert.ok(html.includes('role="progressbar"'));
  const down = renderToStaticMarkup(<LearningDashboard snapshot={null} />);
  assert.ok(down.includes("temporarily unavailable"));
});

test("preview roadmap shows the plan and a save action, but no progress controls", async () => {
  const html = await renderRoadmap("preview", { topics: {}, projects: {} }, "functions");
  assert.ok(html.includes("Roadmap preview"));
  assert.ok(html.includes("Save and start learning"));
  assert.ok(html.includes("Specialisation: backend development"));
  assert.ok(html.includes("Needs prerequisites"));
  assert.ok(html.includes("Save this roadmap"));
  assert.equal(html.includes("Mark as complete"), false);
});

test("topic detail answers what, why, prerequisites, free resources, practice and completion", async () => {
  const html = await renderRoadmap("enrolled", { topics: { loops: "completed", conditionals: "completed" }, projects: {} }, "functions");
  for (const text of ["Why it matters", "You will be able to", "Know first", "Learn it for free", "Practise", "How you know you understand it", "Mark as complete", "I already know this", "Next in your plan"]) {
    assert.ok(html.includes(text), text);
  }
  assert.ok(html.includes('rel="noopener noreferrer"'));
  assert.ok(html.includes("Free"));
  // Preferred format (interactive) resources are labelled.
  assert.ok(html.includes("Your format") || !python.topics.find(topic => topic.id === "functions")!.resources.some(resource => resource.type === "interactive"));
});

test("finished projects offer a portfolio entry built from their own facts", async () => {
  const progress: LearningProgress = {
    topics: { conditionals: "completed", loops: "completed", functions: "completed" },
    projects: { calculator: { state: "completed", evidenceUrl: "https://github.com/example/calculator" } }
  };
  const html = await renderRoadmap("enrolled", progress);
  assert.ok(html.includes("Add it to your portfolio"));
  assert.ok(html.includes("Code / demo: https://github.com/example/calculator"));
  assert.ok(html.includes("Completion is self-reported"));
  assert.ok(html.includes('href="/documents"'));
});

test("read-only mode explains that saving is unavailable", async () => {
  const html = await renderRoadmap("enrolled", { topics: {}, projects: {} }, "how-programs-work", false);
  assert.ok(html.includes("read-only"));
  assert.ok(html.includes("Progress saving is temporarily unavailable."));
  assert.equal(html.includes("Mark as complete"), false);
});
