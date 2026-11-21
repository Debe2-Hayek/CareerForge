import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCareerLearningPath, getLearningTracks, parseLearningTrackId } from "./learning-path";

test("the public catalog contains meaningful ordered tracks with roadmap.sh provenance", () => {
  const tracks = getLearningTracks();
  assert.deepEqual(tracks.map(track => track.id), ["frontend", "backend", "full-stack", "data-analyst", "ux-design", "devops"]);
  assert.ok(tracks.every(track => track.phaseCount === 3 && track.topicCount >= 9));
  assert.ok(tracks.every(track => new URL(track.sourceUrl).origin === "https://roadmap.sh"));
});

test("role titles infer the right path and profile skills only count as self-reported coverage", () => {
  const frontend = buildCareerLearningPath(["React", "CSS", "Git"], {
    targetTitle: "Junior Frontend Developer",
    requiredSkills: ["React", "TypeScript", "CSS", "Git"]
  });
  assert.equal(frontend.track.id, "frontend");
  assert.equal(frontend.targetCoverage, 75);
  assert.equal(frontend.priorityCount, 1);
  assert.equal(frontend.startStep?.id, "typescript");
  assert.equal(frontend.startStep?.status, "priority");
  assert.ok(frontend.phases.flatMap(phase => phase.steps).some(step => step.status === "covered" && step.reason.includes("self-reported")));

  assert.equal(buildCareerLearningPath([], { targetTitle: "Data Analyst", requiredSkills: ["Python", "SQL"] }).track.id, "data-analyst");
  assert.equal(buildCareerLearningPath([], { targetTitle: "Backend Developer", requiredSkills: ["Node.js"] }).track.id, "backend");
  assert.equal(buildCareerLearningPath([], { targetTitle: "Product Designer", requiredSkills: ["Figma"] }).track.id, "ux-design");
});

test("unknown role requirements stay visible without fabricated upstream sources", () => {
  const plan = buildCareerLearningPath([], {
    trackId: "frontend",
    targetTitle: "Experimental Interface Developer",
    requiredSkills: ["Uncatalogued runtime"]
  });
  const extra = plan.phases[0].steps[0];
  assert.equal(plan.phases[0].id, "role-specific");
  assert.equal(extra.status, "priority");
  assert.equal(extra.sourceUrl, null);
  assert.ok(extra.task.includes("Uncatalogued runtime"));
});

test("track ids are allow-listed and every linked topic stays on roadmap.sh", () => {
  assert.equal(parseLearningTrackId("frontend"), "frontend");
  assert.equal(parseLearningTrackId("<script>"), undefined);
  const plan = buildCareerLearningPath([], { trackId: "devops" });
  for (const step of plan.phases.flatMap(phase => phase.steps)) {
    if (step.sourceUrl) assert.equal(new URL(step.sourceUrl).origin, "https://roadmap.sh");
  }
});
