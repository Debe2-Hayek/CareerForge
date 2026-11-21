import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyProfile } from "@/lib/account/schemas";
import { jobs } from "@/lib/demo-workspace";
import { demoListingFields, type CatalogJob } from "@/lib/tracker/schemas";

const catalog: CatalogJob[] = jobs.map(job => ({ ...job, isActive: true, isFictional: true, ...demoListingFields }));
const localRequire = createRequire(import.meta.url);
localRequire.extensions[".css"] = module => {
  const classNames = new Proxy({}, { get: (_target, property) => String(property) });
  module.exports = { __esModule: true, default: classNames };
};

async function learningRoadmap() {
  return (await import("./learning-roadmap")).LearningRoadmap;
}

test("roadmap opens with learner paths and never assumes a role for a new profile", async () => {
  const LearningRoadmap = await learningRoadmap();
  const html = renderToStaticMarkup(<LearningRoadmap profile={emptyProfile} jobs={catalog} />);
  assert.ok(html.includes("Six paths"));
  assert.ok(html.includes("Frontend"));
  assert.ok(html.includes("Data analysis"));
  assert.ok(html.includes("Your roadmap should answer"));
  assert.ok(html.includes("no saved skills"));
  assert.equal(html.includes("Ready for review when"), false);
  assert.equal(html.includes("Product evolution"), false);
});

test("role plan renders ordered phases, priority gaps, sources and evidence limits", async () => {
  const LearningRoadmap = await learningRoadmap();
  const html = renderToStaticMarkup(<LearningRoadmap profile={{ ...emptyProfile, skills: ["React", "CSS", "Git"] }} jobs={catalog} targetId="1" />);
  assert.ok(html.includes("Frontend Developer"));
  assert.ok(html.includes("Build the web foundation"));
  assert.ok(html.includes("Priority gap"));
  assert.ok(html.includes("Start here"));
  assert.ok(html.includes("Ready for review when"));
  assert.ok(html.includes("https://roadmap.sh/typescript"));
  assert.ok(html.includes("not verified"));
  assert.ok(html.includes("not certification"));
  assert.ok(html.includes('rel="noopener noreferrer"'));
});

test("track-only, empty-catalog and invalid-target states remain useful and safe", async () => {
  const LearningRoadmap = await learningRoadmap();
  const track = renderToStaticMarkup(<LearningRoadmap profile={emptyProfile} jobs={[]} trackId="data-analyst" />);
  assert.ok(track.includes("Data Analyst"));
  assert.ok(track.includes("Spreadsheet analysis"));
  assert.ok(track.includes("Role listings are unavailable"));
  const covered = renderToStaticMarkup(<LearningRoadmap profile={{ ...emptyProfile, skills: jobs[0].skills }} jobs={catalog} targetId="1" />);
  assert.ok(covered.includes("100%"));
  assert.ok(covered.includes("Self-reported coverage"));
  const invalid = renderToStaticMarkup(<LearningRoadmap profile={emptyProfile} jobs={catalog} targetId="&lt;script&gt;" />);
  assert.ok(invalid.includes("no longer available"));
  assert.equal(invalid.includes("<script>"), false);
});
