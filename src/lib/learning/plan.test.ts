import assert from "node:assert/strict";
import { test } from "node:test";
import { courses, getCourse, summarizeCourse } from "./catalog";
import { adjustedHours, buildLearningPlan, emptyProgress, orderResources, type LearningProgress, type LearningSettings } from "./plan";
import { recommendNextSteps } from "./recommendations";
import { courseSchema } from "./schema";

const python = getCourse("python")!;
const settings = (overrides: Partial<LearningSettings> = {}): LearningSettings => ({ goalId: "foundations", level: "new", weeklyHours: 6, format: "mixed", ...overrides });
const done = (...ids: string[]): LearningProgress => ({ topics: Object.fromEntries(ids.map(id => [id, "completed" as const])), projects: {} });
const allTopicIds = (phaseIds: string[]) => python.topics.filter(topic => phaseIds.includes(topic.phaseId)).map(topic => topic.id);

test("every course validates: acyclic ordered prerequisites, free required resources and HTTPS links", () => {
  assert.ok(courses.length >= 1);
  for (const course of courses) {
    assert.equal(courseSchema.safeParse(course).success, true);
    for (const topic of course.topics) {
      for (const resource of topic.resources) assert.equal(new URL(resource.url).protocol, "https:");
      if (topic.tier !== "optional") assert.ok(topic.resources.every(resource => resource.free), topic.id);
    }
  }
});

test("schema rejects a prerequisite cycle, unknown prerequisites and paid required resources", () => {
  const base = structuredClone(python);
  const cyclic = structuredClone(base);
  cyclic.topics[0].prerequisites = [cyclic.topics[1].id];
  assert.equal(courseSchema.safeParse(cyclic).success, false);
  const unknown = structuredClone(base);
  unknown.topics[1].prerequisites = ["does-not-exist"];
  assert.equal(courseSchema.safeParse(unknown).success, false);
  const paid = structuredClone(base);
  paid.topics[0].resources = [{ ...paid.topics[0].resources[0], free: false }];
  assert.equal(courseSchema.safeParse(paid).success, false);
});

test("a beginner starts at the first topic and is not offered advanced material first", () => {
  const plan = buildLearningPlan(python, settings());
  assert.equal(plan.nextTopic?.id, "how-programs-work");
  assert.equal(plan.progress.percent, 0);
  assert.ok(plan.thisWeek.length >= 1);
  assert.ok(plan.thisWeek.every(topic => topic.level === "foundation"));
  const oop = plan.phases.find(phase => phase.id === "oop")!;
  assert.ok(oop.topics.every(topic => topic.status === "locked"));
});

test("goals select specialisation branches; unrelated branches are excluded from progress", () => {
  const backend = buildLearningPlan(python, settings({ goalId: "backend" }));
  const included = backend.phases.filter(phase => phase.included).map(phase => phase.id);
  assert.ok(included.includes("backend"));
  assert.ok(!included.includes("data"));
  assert.ok(backend.phases.find(phase => phase.id === "data")!.topics.every(topic => !topic.inPlan));
  const ml = buildLearningPlan(python, settings({ goalId: "machine-learning" }));
  const mlIncluded = ml.phases.filter(phase => phase.included).map(phase => phase.id);
  assert.ok(mlIncluded.includes("data") && mlIncluded.includes("machine-learning"));
  assert.ok(ml.progress.requiredTotal > buildLearningPlan(python, settings()).progress.requiredTotal);
});

test("optional topics and non-career goals never count toward required progress", () => {
  const plan = buildLearningPlan(python, settings());
  const optional = plan.phases.flatMap(phase => phase.topics).filter(topic => topic.tier === "optional");
  assert.ok(optional.length > 0 && optional.every(topic => !topic.inPlan));
  assert.ok(plan.phases.find(phase => phase.id === "career")!.topics.every(topic => !topic.inPlan));
  const jobReady = buildLearningPlan(python, settings({ goalId: "job-ready" }));
  assert.ok(jobReady.phases.find(phase => phase.id === "career")!.topics.every(topic => topic.inPlan));
});

test("progress excludes skipped (known) topics from the denominator and ignores unknown ids", () => {
  const core = allTopicIds(["getting-started"]);
  const progress: LearningProgress = { topics: { [core[0]]: "known", [core[1]]: "completed", "removed-topic": "completed" }, projects: {} };
  const plan = buildLearningPlan(python, settings(), progress);
  assert.equal(plan.progress.known, 1);
  assert.equal(plan.progress.completed, 1);
  assert.equal(plan.progress.percent, Math.round(1 / (plan.progress.requiredTotal - 1) * 100));
});

test("completing every required topic reaches 100% and suggests optional enrichment", () => {
  const required = buildLearningPlan(python, settings()).phases.flatMap(phase => phase.topics).filter(topic => topic.inPlan).map(topic => topic.id);
  const plan = buildLearningPlan(python, settings(), done(...required));
  assert.equal(plan.progress.percent, 100);
  assert.equal(plan.progress.remainingHours, 0);
  assert.equal(plan.progress.weeksRemaining, 0);
  assert.equal(plan.nextIsOptional, true);
  assert.equal(plan.nextTopic?.tier, "optional");
});

test("changing goal preserves progress and recomputes the plan", () => {
  const progress = done(...allTopicIds(["getting-started", "fundamentals"]));
  const foundations = buildLearningPlan(python, settings(), progress);
  const data = buildLearningPlan(python, settings({ goalId: "data" }), progress);
  assert.equal(foundations.progress.completed, data.progress.completed);
  assert.notEqual(foundations.progress.requiredTotal, data.progress.requiredTotal);
});

test("experience level shortens estimates and suggests reviewing foundations, without marking them done", () => {
  assert.equal(adjustedHours(4, "foundation", "new"), 4);
  assert.equal(adjustedHours(4, "foundation", "experienced"), 1);
  const experienced = buildLearningPlan(python, settings({ level: "experienced" }));
  const beginner = buildLearningPlan(python, settings());
  assert.ok(experienced.progress.remainingHours < beginner.progress.remainingHours);
  assert.equal(experienced.progress.completed, 0);
  assert.equal(experienced.nextTopic?.reviewSuggested, true);
  assert.equal(beginner.nextTopic?.reviewSuggested, false);
});

test("weekly availability changes the completion estimate, not the curriculum", () => {
  const light = buildLearningPlan(python, settings({ weeklyHours: 3 }));
  const intensive = buildLearningPlan(python, settings({ weeklyHours: 15 }));
  assert.equal(light.progress.requiredTotal, intensive.progress.requiredTotal);
  assert.ok(light.progress.weeksRemaining > intensive.progress.weeksRemaining);
  assert.ok(intensive.thisWeek.length >= light.thisWeek.length);
  const hours = intensive.thisWeek.reduce((sum, topic) => sum + topic.hours, 0);
  assert.ok(hours <= 15 || intensive.thisWeek.length === 1);
});

test("this week's plan never schedules a topic before its prerequisites", () => {
  const plan = buildLearningPlan(python, settings({ weeklyHours: 40 }));
  const scheduled = new Set<string>();
  for (const topic of plan.thisWeek) {
    const prerequisites = python.topics.find(candidate => candidate.id === topic.id)!.prerequisites;
    assert.ok(prerequisites.every(id => scheduled.has(id)), `${topic.id} scheduled before prerequisites`);
    scheduled.add(topic.id);
  }
});

test("projects unlock only when required topics are done and match the learner's goal", () => {
  const fresh = buildLearningPlan(python, settings({ goalId: "backend" }));
  assert.ok(fresh.projects.every(project => project.readiness !== "ready"));
  const calculator = buildLearningPlan(python, settings(), done("conditionals", "loops", "functions")).projects.find(item => item.project.id === "calculator")!;
  assert.equal(calculator.readiness, "ready");
  const backendOnly = fresh.projects.find(item => item.project.id === "library-api")!;
  assert.equal(backendOnly.relevant, true);
  assert.equal(buildLearningPlan(python, settings({ goalId: "data" })).projects.find(item => item.project.id === "library-api")!.relevant, false);
});

test("recommendations explain themselves and point back to missing prerequisites", () => {
  const plan = buildLearningPlan(python, settings(), { topics: { "classes-objects": "in_progress" }, projects: {} });
  const recommendations = recommendNextSteps(python, plan);
  assert.ok(recommendations.length > 0);
  assert.ok(recommendations.every(item => item.reason.length > 10 && item.href.startsWith("/")));
  const guard = recommendations.find(item => item.kind === "prerequisite");
  assert.ok(guard, "expected a prerequisite recommendation");
  assert.match(guard.title, /before Classes and objects/);
});

test("finished projects lead to evidence, then portfolio recommendations", () => {
  const base = done("conditionals", "loops", "functions", "input-output");
  const noLink = buildLearningPlan(python, settings(), { ...base, projects: { calculator: { state: "completed", evidenceUrl: null } } });
  assert.ok(recommendNextSteps(python, noLink, undefined, 10).some(item => item.kind === "evidence"));
  const linked = buildLearningPlan(python, settings(), { ...base, projects: { calculator: { state: "completed", evidenceUrl: "https://github.com/example/calculator" } } });
  assert.ok(recommendNextSteps(python, linked, undefined, 10).some(item => item.kind === "portfolio"));
});

test("resource ordering puts the preferred format first without removing resources", () => {
  const resources = [{ type: "docs", id: 1 }, { type: "video", id: 2 }, { type: "interactive", id: 3 }];
  const ordered = orderResources(resources, "interactive");
  assert.equal(ordered[0].id, 3);
  assert.equal(ordered.length, 3);
  assert.deepEqual(orderResources(resources, "mixed").map(item => item.id), [1, 2, 3]);
});

test("course summaries report real counts and an empty plan is stable", () => {
  const summary = summarizeCourse(python);
  assert.equal(summary.topicCount, python.topics.length);
  assert.ok(summary.coreHours > 0);
  assert.deepEqual(buildLearningPlan(python, settings(), emptyProgress()).progress.completed, 0);
  assert.equal(buildLearningPlan(python, settings({ goalId: "unknown" })).goal.id, "foundations");
});
