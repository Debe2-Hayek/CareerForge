import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { LearningSnapshot } from "@/lib/learning/api";
import { getRoadmap } from "@/lib/roadmaps/catalog";
import { roadmapLookup } from "@/lib/roadmaps/lookup";
import { marksFor, trackFor } from "@/lib/roadmaps/progress";

// CSS modules resolve to their class names; next/navigation needs a mounted app
// router, so client components get an inert router for static rendering.
const localRequire = createRequire(import.meta.url);
localRequire.extensions[".css"] = module => {
  module.exports = { __esModule: true, default: new Proxy({}, { get: (_target, property) => String(property) }) };
};
const navigation = localRequire.resolve("next/navigation");
localRequire.cache[navigation] = { id: navigation, filename: navigation, loaded: true, exports: { useRouter: () => ({ refresh() {}, replace() {}, push() {} }) } } as unknown as NodeJS.Module;

const settings = { level: "new" as const, weeklyHours: 6, format: "mixed" as const };
const enrolled = (courseId: string, goalId = "complete") => ({ courseId, goalId, ...settings, contentVersion: 1, startedAt: "2026-11-21T10:00:00Z", lastActiveAt: "2026-11-21T10:00:00Z" });
const profile = { headline: "", skills: [] as string[] };

async function renderRoadmap(id: string, snapshot: LearningSnapshot | null, open: { kind: "topic" | "project"; id: string } | null = null) {
  const { RoadmapView } = await import("./roadmap-view");
  const { RoadmapExtras } = await import("./roadmap-extras");
  const { toViewRoadmap } = await import("./client-types");
  const roadmap = getRoadmap(id)!;
  return renderToStaticMarkup(<RoadmapView roadmap={toViewRoadmap(roadmap, roadmapLookup)} initialMarks={marksFor(roadmap, snapshot)}
    initialProjects={snapshot?.progress[id]?.projects ?? {}} initialTrack={trackFor(roadmap, snapshot)} started={Boolean(snapshot?.enrollments.length)} settings={settings}
    storageAvailable={snapshot !== null} initialOpen={open}><RoadmapExtras roadmap={roadmap} /></RoadmapView>);
}

test("home lists roles and skills plainly and invents no progress", async () => {
  const { RoadmapHome } = await import("./roadmap-home");
  const html = renderToStaticMarkup(<RoadmapHome snapshot={{ enrollments: [], progress: {} }} profile={profile} />);
  for (const text of ["Career roles", "Skills", "Frontend Developer", "/learning-roadmap/python", "Free courses", "/learning-roadmap/careers"]) assert.ok(html.includes(text), text);
  for (const text of ["Continue learning", "Suggested for you", "Started", "Popular"]) assert.equal(html.includes(text), false, text);
});

test("home resumes at the next topic and degrades when storage is down", async () => {
  const { RoadmapHome } = await import("./roadmap-home");
  const html = renderToStaticMarkup(<RoadmapHome snapshot={{ enrollments: [enrolled("frontend")], progress: { frontend: { topics: { internet: "completed" }, projects: {} } } }} profile={profile} />);
  assert.ok(html.includes("Continue learning"));
  assert.ok(html.includes('href="/learning-roadmap/frontend?topic=http"'));
  const down = renderToStaticMarkup(<RoadmapHome snapshot={null} profile={profile} />);
  assert.ok(down.includes("temporarily unavailable"));
});

test("a useful head start from other roadmaps replaces the topic count", async () => {
  const { RoadmapFinder } = await import("./roadmap-finder");
  const item = { id: "backend", kind: "role" as const, title: "Backend Developer", area: "web" as const, topics: 47, inDepth: false, percent: null, search: "" };
  assert.ok(renderToStaticMarkup(<RoadmapFinder items={[{ ...item, headStart: 24 }]} />).includes("24% already covered"));
  assert.ok(renderToStaticMarkup(<RoadmapFinder items={[{ ...item, headStart: 3 }]} />).includes("47 topics"));
});

test("a roadmap opens straight on the map with no setup form", async () => {
  const html = await renderRoadmap("frontend", { enrollments: [], progress: {} });
  assert.ok(html.includes("Start: How the internet works"));
  assert.ok(html.includes("Save for later"));
  assert.equal(html.includes('type="radio"'), false);
  for (const section of getRoadmap("frontend")!.sections) assert.ok(html.includes(section.title), section.title);
  assert.equal(html.match(/aria-label="Mark [^"]+ as done"/g)!.length, getRoadmap("frontend")!.sections.flatMap(section => section.topics).length);
  // Attribution: external sources are linked, never presented as our own or as partners.
  assert.ok(html.includes("CC BY 4.0") && html.includes("https://roadmap.sh/frontend") && html.includes("not affiliated"));
});

test("marks, the next topic and credit from other roadmaps are visible and spoken", async () => {
  const html = await renderRoadmap("backend", { enrollments: [enrolled("backend")], progress: { backend: { topics: { internet: "in_progress" }, projects: {} }, frontend: { topics: { http: "completed" }, projects: {} } } }, { kind: "topic", id: "http" });
  assert.ok(html.includes('data-state="in_progress"'));
  assert.ok(html.includes("Continue: How the internet works"));
  assert.ok(html.includes("You already finished this in Frontend Developer"));
  assert.ok(html.includes("Learn it free") && html.includes('rel="noopener noreferrer"'));
});

test("guided topics keep their full lessons inside the panel", async () => {
  const html = await renderRoadmap("python", { enrollments: [enrolled("python", "backend")], progress: {} }, { kind: "topic", id: "functions" });
  for (const text of ["Why it matters", "Example", "Practise", "You are done when", "Your goal", "Backend development"]) assert.ok(html.includes(text), text);
  assert.equal(html.includes("Machine learning</h3>"), false, "other specialisations stay out of the way");
});

test("compact topics teach the idea, a task and a self-test", async () => {
  const html = await renderRoadmap("frontend", { enrollments: [], progress: {} }, { kind: "topic", id: "html" });
  for (const text of ["The idea", "Try it", "Check yourself", "<details", "Learn it free"]) assert.ok(html.includes(text), text);
});

test("finished projects offer a portfolio entry built from their own facts", async () => {
  const html = await renderRoadmap("frontend", { enrollments: [enrolled("frontend")], progress: { frontend: { topics: {}, projects: { "recipe-finder": { state: "completed", evidenceUrl: "https://github.com/example/recipes" } } } } }, { kind: "project", id: "recipe-finder" });
  assert.ok(html.includes("Code / demo: https://github.com/example/recipes"));
  assert.ok(html.includes("Completion is self-reported"));
  assert.ok(html.includes('href="/documents"'));
});

test("read-only mode explains itself and disables every progress control", async () => {
  const html = await renderRoadmap("frontend", null, { kind: "topic", id: "html" });
  assert.ok(html.includes("read-only"));
  assert.equal(/<button(?![^>]*disabled)[^>]*aria-label="Mark /.test(html), false);
  assert.equal(html.includes("Save for later"), false);
});

test("course and project lists filter, page and credit their sources", async () => {
  const { CoursesPage, ProjectsPage } = await import("./library-pages");
  const courses = renderToStaticMarkup(<CoursesPage search={{ area: "ai" }} />);
  assert.ok(courses.includes("Page 1 of") && courses.includes("area=ai&amp;page=2"));
  assert.ok(courses.includes("Free Programming Books") && courses.includes("CC BY 4.0"));
  assert.ok(renderToStaticMarkup(<CoursesPage search={{ area: "nonsense", page: "-5" }} />).includes("Page 1 of"));
  assert.ok(renderToStaticMarkup(<CoursesPage search={{ q: "zzzz-nothing" }} />).includes("No course matches"));
  const projects = renderToStaticMarkup(<ProjectsPage search={{ level: "advanced" }} />);
  assert.ok(projects.includes('data-level="advanced"') && !projects.includes('data-level="beginner"'));
  assert.ok(renderToStaticMarkup(<ProjectsPage search={{ type: "tutorials" }} />).includes("CC0 1.0"));
});
