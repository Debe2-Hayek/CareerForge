import { test } from "node:test";
import assert from "node:assert/strict";
import { analyseCareer, rankCareers, skillCoversTopic, topicPriority } from "./score";
import { careerFacts, guardCareer, aiCareerSchema, careerPrompt } from "./explain";
import { careerExplainHandlers, type CareerExplainAccess } from "./handlers";
import { roleRoadmaps } from "../roadmaps/catalog";
import { providerFromEnv } from "../ai/provider";
import type { AiRunStore } from "../ai/runner";

const roadmap = {
  id: "frontend", title: "Frontend Developer", area: "web", tagline: "Build interfaces.",
  sections: [
    { id: "s1", title: "Pages", topics: [{ id: "html", title: "HTML", kind: "core" }, { id: "css", title: "CSS", kind: "core" }] },
    { id: "s2", title: "Interaction", topics: [{ id: "js", title: "JavaScript", kind: "core" }, { id: "storage", title: "Browser storage", kind: "good" }] },
    { id: "s3", title: "A framework", topics: [{ id: "react", title: "React", kind: "core" }, { id: "vue", title: "Vue", kind: "optional" }] },
    { id: "s4", title: "Quality", topics: [{ id: "docker", title: "Containers with Docker", kind: "core" }] }
  ]
};

test("skills match topics as whole words, and priority follows the roadmap", () => {
  assert.equal(skillCoversTopic("Docker", "Containers with Docker"), true);
  assert.equal(skillCoversTopic("Node.js", "JavaScript and Node.js"), true);
  assert.equal(skillCoversTopic("SQL", "PostgreSQL"), false);
  assert.equal(skillCoversTopic("Java", "JavaScript"), false);
  assert.equal(topicPriority("core", 0, 4), "critical");
  assert.equal(topicPriority("core", 1, 4), "critical");
  assert.equal(topicPriority("core", 2, 4), "important");
  assert.equal(topicPriority("good", 0, 4), "optional");
  assert.equal(topicPriority("optional", 0, 4), "optional");
});

test("evidence strength: proven beats profile beats learned beats in progress; optional never counts", () => {
  const detail = analyseCareer(roadmap, [{ name: "HTML", status: "verified" }, { name: "css", status: "self_declared" }, { name: "Figma", status: "self_declared" }],
    { js: { state: "known", via: null }, react: { state: "in_progress", via: null } });
  const by = (id: string) => detail.topics.find(topic => topic.id === id)!;
  assert.equal(by("html").evidence, "proven");
  assert.equal(by("css").evidence, "profile");
  assert.equal(by("js").evidence, "learned");
  assert.equal(by("react").evidence, "learning");
  assert.equal(by("docker").evidence, "none");
  assert.equal(by("vue").priority, "optional");
  // Critical: html 1.0, css 0.8, js 0.7 (weight 3 each); Important: react 0.3, docker 0 (weight 2 each).
  assert.equal(detail.score, Math.round((3 * (1 + 0.8 + 0.7) + 2 * 0.3) / (3 * 3 + 2 * 2) * 100));
  assert.deepEqual(detail.critical, { done: 3, total: 3 });
  assert.deepEqual(detail.important, { done: 0, total: 2 }, "in progress does not count as done");
  assert.equal(by("docker").href, "/learning-roadmap/frontend?topic=docker");
});

test("ranking is deterministic and every real career can be scored", () => {
  const details = roleRoadmaps.map(item => analyseCareer(item, [{ name: "React", status: "verified" }, { name: "JavaScript", status: "self_declared" }, { name: "CSS", status: "self_declared" }, { name: "HTML", status: "self_declared" }], {}));
  const ranked = rankCareers(details);
  assert.equal(ranked.length, roleRoadmaps.length);
  assert.deepEqual(rankCareers(details), ranked);
  assert.ok(ranked.every((career, i) => i === 0 || ranked[i - 1].score >= career.score));
  assert.ok(["frontend", "full-stack"].includes(ranked[0].id), `a web skill set ranks a web career first (got ${ranked[0].id})`);
  assert.ok(ranked.every(career => career.score >= 0 && career.score <= 100 && career.critical.total > 0));
});

test("the AI guard keeps only priorities that are real gaps and numbers from the inputs", () => {
  const detail = analyseCareer(roadmap, [{ name: "HTML", status: "verified" }], {});
  const facts = careerFacts(detail, "Aspiring frontend developer");
  assert.deepEqual(facts.criticalGaps, ["CSS", "JavaScript"]);
  const raw = aiCareerSchema.parse({ summary: "You have a start.", priorities: [{ topic: "css", why: "Every page needs it." }, { topic: "Kubernetes", why: "Invented." }, { topic: "JavaScript", why: "Takes 300 hours." }] });
  const { explanation, removed } = guardCareer(raw, facts);
  assert.deepEqual(explanation.priorities, [{ topic: "CSS", why: "Every page needs it." }]);
  assert.equal(removed, 2);
  assert.match(careerPrompt(facts).system, /copied exactly from criticalGaps or importantGaps/);
});

const runs: AiRunStore = { async reserve() { return { status: "reserved", runId: "r1", remaining: 4 }; }, async finish() {} };
const access: CareerExplainAccess = { runs, detail: async id => id === "frontend" ? { detail: analyseCareer(roadmap, [], {}), headline: "" } : null };
const req = (body: unknown, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/v1/career-analysis/explain", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("career explain endpoint: session, input, unknown careers and the test AI with its invented priority removed", async () => {
  const fake = () => providerFromEnv({ AI_FAKE: "1", NODE_ENV: "test" })!.provider;
  assert.equal((await careerExplainHandlers(async () => null, fake).POST(req({ careerId: "frontend" }))).status, 401);
  assert.equal((await careerExplainHandlers(async () => access, fake).POST(req({ careerId: "frontend" }, "https://evil.example"))).status, 403);
  assert.equal((await careerExplainHandlers(async () => access, fake).POST(req({ careerId: "../x" }))).status, 400);
  assert.equal((await careerExplainHandlers(async () => access, fake).POST(req({ careerId: "astronaut" }))).status, 404);
  assert.equal((await careerExplainHandlers(async () => access, () => null).POST(req({ careerId: "frontend" }))).status, 501);
  const ok = await careerExplainHandlers(async () => access, fake).POST(req({ careerId: "frontend" }));
  assert.equal(ok.status, 200);
  const body = await ok.json() as { explanation: { priorities: { topic: string }[] }; removed: number };
  assert.ok(body.explanation.priorities.length >= 1);
  assert.equal(body.explanation.priorities.some(item => /basket/i.test(item.topic)), false);
  assert.ok(body.removed >= 1);
});
