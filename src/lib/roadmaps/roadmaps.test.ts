import assert from "node:assert/strict";
import { test } from "node:test";
import { progressInputSchema, validateAgainstCatalog, type LearningSnapshot } from "@/lib/learning/api";
import { courses, getCourse } from "@/lib/learning/catalog";
import { courseSchema } from "@/lib/learning/schema";
import { getRoadmap, isRoadmapGoal, roadmaps, roleRoadmaps, skillRoadmaps } from "./catalog";
import { readLibraryQuery } from "./library-query";
import { sectionsFor, summarize } from "./marks";
import { catalogCredits, courseArea, coursesFor, courseTopicList, hostOf, openCourses, openTutorials, searchCourses, searchTutorials } from "./open-catalog";
import { parseResources, parseRoadmap, parseSharedTopics, slugify } from "./parse";
import { activeRoadmaps, marksFor, suggestRoadmaps, trackFor, trackShowing } from "./progress";
import { roadmapSchema } from "./schema";

const settings = { goalId: "complete", level: "new" as const, weeklyHours: 6, format: "mixed" as const, contentVersion: 1, startedAt: "2026-11-21T10:00:00Z", lastActiveAt: "2026-11-21T10:00:00Z" };
const snapshot = (progress: LearningSnapshot["progress"], goals: Record<string, string> = {}): LearningSnapshot => ({
  enrollments: Object.keys(progress).map(courseId => ({ ...settings, courseId, goalId: goals[courseId] ?? "complete" })), progress
});
const allTopics = (id: string) => getRoadmap(id)!.sections.flatMap(section => section.topics);

test("the catalogue is large, unique and every reference resolves", () => {
  assert.ok(roleRoadmaps.length >= 25 && skillRoadmaps.length >= 35);
  const reserved = new Set(["careers", "product", "projects", "courses"]);
  for (const roadmap of roadmaps) {
    assert.equal(reserved.has(roadmap.id), false, `${roadmap.id} would be hidden by a page`);
    for (const id of roadmap.related) assert.ok(getRoadmap(id), `${roadmap.id} -> ${id}`);
    for (const topic of roadmap.courseTopics) assert.ok(courseTopicList.includes(topic), `${roadmap.id}: no open courses for ${topic}`);
    assert.ok(roadmap.projects.length >= 3, `${roadmap.id} needs projects`);
    assert.ok(allTopics(roadmap.id).some(topic => topic.kind === "core"));
    for (const topic of allTopics(roadmap.id)) for (const resource of topic.resources) {
      assert.equal(new URL(resource.url).protocol, "https:");
      assert.ok(resource.free, `${roadmap.id}/${topic.id}`);
    }
  }
});

test("a shared topic is identical in every roadmap that uses it", () => {
  const seen = new Map<string, string>();
  for (const roadmap of roadmaps) for (const topic of allTopics(roadmap.id).filter(item => item.shared)) {
    const content = `${topic.title}|${topic.summary}`;
    assert.equal(seen.get(topic.id) ?? content, content);
    seen.set(topic.id, content);
  }
  assert.ok(seen.size > 80);
});

test("the guided courses still reject cycles, unknown prerequisites and paid required resources", () => {
  for (const course of courses) assert.equal(courseSchema.safeParse(course).success, true);
  const python = getCourse("python")!;
  const cyclic = structuredClone(python);
  cyclic.topics[0].prerequisites = [cyclic.topics[1].id];
  assert.equal(courseSchema.safeParse(cyclic).success, false);
  const unknown = structuredClone(python);
  unknown.topics[1].prerequisites = ["does-not-exist"];
  assert.equal(courseSchema.safeParse(unknown).success, false);
  const paid = structuredClone(python);
  paid.topics[0].resources = [{ ...paid.topics[0].resources[0], free: false }];
  assert.equal(courseSchema.safeParse(paid).success, false);
});

test("the compact format rejects mistakes instead of publishing them", () => {
  const meta = { id: "sample", kind: "skill" as const, title: "Sample", area: "web" as const, tagline: "A sample.", keywords: [], related: [] };
  const shared = parseSharedTopics("git = Git | Version control. | learngit");
  const parse = (body: string) => parseRoadmap(meta, body, shared);
  const parsed = parse("## One | Goal | Task | exercism\n- First | Summary.\n- @git\n+ Extra | More. | mdn:Web/HTTP\n* App | beginner | Build it. | One; Two | HTML");
  assert.deepEqual(parsed.sections[0].topics.map(topic => [topic.id, topic.kind, topic.shared]), [["first", "core", false], ["git", "core", true], ["extra", "good", false]]);
  assert.deepEqual(parsed.projects[0].requirements, ["One", "Two"]);
  assert.throws(() => parse("- Orphan | No section."), /unrecognised line/);
  assert.throws(() => parse("## One | Goal\n- Topic | Summary."), /no resource/);
  assert.throws(() => parse("## One | Goal\n- @missing"), /unknown shared topic/);
  assert.throws(() => parse("## One"), /needs a goal/);
  assert.throws(() => parseResources("nowhere:path", "T", "here"), /unknown resource/);
  assert.throws(() => parseSharedTopics("git = Git | a | learngit\ngit = Git | a | learngit"), /Duplicate/);
  const duplicate = parse("## One | Goal | | exercism\n- Same | A.\n- Same | B.\n## Two | Goal | | exercism\n- Other | C.");
  assert.equal(roadmapSchema.safeParse(duplicate).success, false);
  assert.equal(slugify("C++ & C# basics"), "cpp-and-csharp-basics");
});

test("only core topics count, and skipped topics count as done", () => {
  const sections = [{ topics: [{ id: "a", title: "A", kind: "core" }, { id: "b", title: "B", kind: "core" }, { id: "c", title: "C", kind: "optional" }] }];
  assert.deepEqual(summarize(sections, {}), { total: 2, done: 0, percent: 0, nextId: "a", nextTitle: "A" });
  assert.equal(summarize(sections, { a: { state: "known", via: null }, c: { state: "completed", via: null } }).percent, 50);
  assert.equal(summarize(sections, { b: { state: "in_progress", via: null } }).nextId, "b", "a started topic comes first");
  assert.deepEqual(summarize(sections, { a: { state: "completed", via: null }, b: { state: "known", via: null } }), { total: 2, done: 2, percent: 100, nextId: null, nextTitle: null });
});

test("a shared topic finished in one roadmap counts in the others, unless marked differently there", () => {
  const backend = getRoadmap("backend")!;
  const finished = snapshot({ frontend: { topics: { git: "completed", html: "in_progress" }, projects: {} } });
  assert.deepEqual(marksFor(backend, finished).git, { state: "completed", via: "Frontend Developer" });
  const overridden = snapshot({ frontend: { topics: { git: "completed" }, projects: {} }, backend: { topics: { git: "in_progress" }, projects: {} } });
  assert.deepEqual(marksFor(backend, overridden).git, { state: "in_progress", via: null });
  assert.equal(marksFor(getRoadmap("full-stack")!, finished).html, undefined, "unfinished work is not shared");
  // "Functions" exists in several roadmaps but is not shared, so it never leaks.
  const functions = snapshot({ python: { topics: { functions: "completed" }, projects: {} } });
  for (const roadmap of roadmaps.filter(item => item.id !== "python")) assert.deepEqual(marksFor(roadmap, functions), {});
  assert.deepEqual(marksFor(backend, null), {});
});

test("specialisations choose which sections of a guided path are shown", () => {
  const python = getRoadmap("python")!;
  const ids = (track: string) => sectionsFor(python, track).map(section => section.id);
  assert.ok(ids("data").includes("data") && !ids("data").includes("backend"));
  assert.ok(ids("backend").includes("career") && !ids("foundations").includes("career"));
  assert.equal(trackFor(python, snapshot({ python: { topics: {}, projects: {} } }, { python: "data" })), "data");
  assert.equal(trackFor(python, snapshot({ python: { topics: {}, projects: {} } }, { python: "removed-goal" })), "foundations");
  assert.equal(trackFor(getRoadmap("frontend")!, null), null);
  const topic = python.sections.find(section => section.id === "machine-learning")!.topics[0].id;
  assert.equal(trackShowing(python, "foundations", topic), "machine-learning", "deep links never open a hidden topic");
  assert.equal(trackShowing(python, "data", null), "data");
});

test("the API accepts catalogue ids only", () => {
  const enroll = (courseId: string, goalId: string) => validateAgainstCatalog({ courseId, goalId, level: "new", weeklyHours: 6, format: "mixed" });
  assert.equal(enroll("frontend", "complete"), null);
  assert.equal(enroll("python", "backend"), null);
  assert.equal(enroll("python", "complete"), "Unknown learning goal.");
  assert.equal(enroll("frontend", "backend"), "Unknown learning goal.");
  assert.equal(enroll("cobol", "complete"), "Unknown roadmap.");
  const mark = (itemId: string, kind: "topic" | "project") => validateAgainstCatalog(progressInputSchema.parse({ courseId: "frontend", kind, itemId, state: "completed" }));
  assert.equal(mark("html", "topic"), null);
  assert.equal(mark("kanban-board", "project"), null);
  assert.equal(mark("kanban-board", "topic"), "Unknown topic.");
  // Every id fits the database constraints used for progress rows.
  for (const roadmap of roadmaps) for (const id of [roadmap.id, ...allTopics(roadmap.id).map(topic => topic.id), ...roadmap.projects.map(project => project.id)]) {
    assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(id.length <= 60);
  }
  for (const roadmap of roadmaps) assert.ok(isRoadmapGoal(roadmap, roadmap.defaultTrack ?? "complete"));
});

test("active roadmaps ignore removed ids, and suggestions explain themselves", () => {
  const active = activeRoadmaps(snapshot({ frontend: { topics: { internet: "completed" }, projects: {} }, "removed-roadmap": { topics: {}, projects: {} } }));
  assert.deepEqual(active.map(item => item.roadmap.id), ["frontend"]);
  assert.equal(active[0].summary.done, 1);
  const suggestions = suggestRoadmaps({ headline: "Junior Data Analyst", skills: ["SQL"] }, new Set());
  assert.equal(suggestions[0].roadmap.id, "data-analyst");
  assert.match(suggestions[0].reason, /data analyst/);
  assert.ok(suggestions.length <= 3);
  assert.equal(suggestRoadmaps({ headline: "Junior Data Analyst", skills: [] }, new Set(["data-analyst"])).some(item => item.roadmap.id === "data-analyst"), false);
  assert.deepEqual(suggestRoadmaps({ headline: "", skills: [] }, new Set()), []);
  assert.equal(suggestRoadmaps({ headline: "I like going outside", skills: [] }, new Set()).some(item => item.roadmap.id === "go"), false, "whole words only");
});

test("the open catalogue is safe, deduplicated, credited and searchable", () => {
  assert.ok(openCourses.length > 1000 && openTutorials.length > 400);
  const urls = [...openCourses, ...openTutorials].map(item => item.url);
  for (const value of urls) {
    const url = new URL(value);
    assert.equal(url.protocol, "https:");
    assert.equal(url.username + url.password, "");
    assert.equal(/(^|\.)roadmap\.sh$/.test(url.hostname), false);
  }
  assert.equal(new Set(openCourses.map(item => item.url)).size, openCourses.length);
  assert.equal(new Set(openTutorials.map(item => item.url)).size, openTutorials.length);
  assert.ok([...openCourses, ...openTutorials].every(item => !/[<>]/.test(item.title)));
  for (const credit of Object.values(catalogCredits)) assert.ok(credit.licence && credit.licenceUrl.startsWith("https://"));
  assert.ok(searchCourses({ query: "python" }).length > 20);
  assert.ok(searchCourses({ area: "ai" }).every(course => courseArea(course.topic) === "ai"));
  assert.equal(searchCourses({}).length, openCourses.length);
  assert.equal(searchCourses({ query: "zzzz-nothing" }).length, 0);
  assert.ok(searchTutorials("git").length > 0);
  for (const roadmap of roadmaps) assert.ok(coursesFor(roadmap, 6).length > 0, roadmap.id);
  assert.equal(hostOf("https://youtu.be/abc"), "youtube.com");
});

test("library filters keep only short single values", () => {
  assert.deepEqual(readLibraryQuery({ q: " react ", page: ["1", "2"], area: "x".repeat(61), other: "y", level: "" }), { q: "react" });
});
