import { test } from "node:test";
import assert from "node:assert/strict";
import { analyseFit, experienceYears, type CandidateInput, type JobInput } from "./score";
import { explainInput, guardExplanation, aiExplanationSchema, explainPrompt } from "./explain";
import { cvExplainHandlers, type ExplainAccess } from "./handlers";
import { providerFromEnv } from "../ai/provider";
import type { AiRunStore } from "../ai/runner";

const now = new Date("2026-11-23T00:00:00Z");
const job: JobInput = { title: "Junior Backend Developer", company: "Murex", skills: ["Java", "Spring Boot", "PostgreSQL", "Docker"], description: "We want 2+ years of experience building APIs. A bachelor's degree in computer science is required.", experienceLevel: "entry" };
const candidate: CandidateInput = {
  headline: "Backend developer", project: "Budget tracker in Spring Boot",
  skills: [{ name: "Java", status: "verified" }, { name: "spring boot", status: "self_declared" }, { name: "React", status: "self_declared" }],
  experience: [
    { role: "Backend Developer", company: "Murex", startDate: "2024-11-23", endDate: null, isCurrent: true },
    { role: "Intern", company: "Areeba", startDate: "2024-06-01", endDate: "2024-12-31", isCurrent: false }
  ],
  education: [{ degree: "B.E. Computer Engineering", institution: "Lebanese American University" }],
  checkable: ["Docker", "SQL"]
};

test("overlapping jobs count once and undated ones are ignored", () => {
  // Jun 2024 to Nov 2026 with an overlap: about 2.5 years, not 2.6.
  assert.equal(experienceYears(candidate.experience, now), 2.5);
  assert.equal(experienceYears([{ role: "x", company: "y", startDate: null, endDate: null, isCurrent: true }], now), 0);
});

test("the score is deterministic and every factor is explained", () => {
  const first = analyseFit(job, candidate, now);
  assert.deepEqual(analyseFit(job, candidate, now), first, "same input, same result");
  const by = (id: string) => first.factors.find(factor => factor.id === id)!;
  assert.equal(first.skills.filter(skill => skill.matched).length, 2, "Java and Spring Boot (case and spacing ignored)");
  assert.equal(by("skills").score, (1 + 0.85) / 4, "a verified skill counts fully, a self-declared one at 0.85");
  assert.equal(by("experience").score, 1, "2.5 years against 2+ asked");
  assert.equal(by("education").score, 1);
  assert.equal(by("role").score, 1, "backend and developer appear in the headline");
  assert.ok(first.score > 0 && first.score <= 100);
  assert.equal(first.label, first.score >= 75 ? "Strong match" : first.score >= 55 ? "Good match" : first.score >= 35 ? "Partial match" : "Early stage");
});

test("next steps point to real actions: checks where they exist, learning otherwise, and proof", () => {
  const { steps } = analyseFit(job, candidate, now);
  assert.ok(steps.some(step => step.kind === "check" && /Docker/.test(step.text) && step.href === "/skill-checks"));
  assert.ok(steps.some(step => step.kind === "learn" && /PostgreSQL/.test(step.text)));
  assert.ok(steps.some(step => step.kind === "prove" && /Spring Boot/i.test(step.text)));
  assert.equal(steps.some(step => step.kind === "prove" && /Java/.test(step.text)), false, "Java is already verified");
});

test("a pasted posting has its skills detected; an empty profile scores low with clear steps", () => {
  const pasted: JobInput = { title: "Data Analyst", company: "", skills: [], description: "You will use SQL, Python and Power BI daily. 3 years of experience in data analysis.", experienceLevel: null };
  const empty: CandidateInput = { headline: "", project: "", skills: [], experience: [], education: [], checkable: [] };
  const result = analyseFit(pasted, empty, now);
  assert.deepEqual(result.skills.map(skill => skill.name).sort(), ["Data Analysis", "Power BI", "Python", "SQL"].sort());
  assert.equal(result.yearsRequired, 3);
  assert.ok(result.score < 35);
  assert.equal(result.label, "Early stage");
  assert.ok(result.steps.some(step => step.kind === "experience"));
});

test("factors the posting gives no data for are left out rather than counted as zero", () => {
  const vague: JobInput = { title: "Team member", company: "", skills: [], description: "Join our friendly team and grow with us in a great culture every day.", experienceLevel: null };
  const result = analyseFit(vague, candidate, now);
  assert.equal(result.factors.find(factor => factor.id === "skills")!.score, null);
  assert.equal(result.factors.find(factor => factor.id === "experience")!.score, null);
  assert.ok(result.score > 0);
});

test("the AI guard drops invented numbers, unowned strengths and tips naming missing skills", () => {
  const analysis = analyseFit(job, candidate, now);
  const facts = explainInput(job, candidate, analysis);
  const raw = aiExplanationSchema.parse({
    summary: "You match well.",
    strengths: ["Your Java skill is listed for this job.", "You led a team of 40 engineers.", "Strong communication."],
    gaps: [{ item: "Docker", suggestion: "Build a small project with Docker." }, { item: "PostgreSQL", suggestion: "Finish 12 courses." }],
    cvTips: ["Lead with your Spring Boot project.", "List Docker among your skills."]
  });
  const { explanation, removed } = guardExplanation(raw, facts, `${job.title}\n${job.description}`);
  assert.deepEqual(explanation.strengths, ["Your Java skill is listed for this job."]);
  assert.deepEqual(explanation.gaps.map(gap => gap.item), ["Docker"]);
  assert.deepEqual(explanation.cvTips, ["Lead with your Spring Boot project."]);
  assert.equal(removed, 4);
  const prompt = explainPrompt(facts);
  assert.match(prompt.system, /Never say or imply the user has a skill listed in missingSkills/);
  assert.match(prompt.user, /^<analysis>\n/);
});

const memoryRuns = (): AiRunStore => {
  let n = 0;
  return { async reserve() { n++; return { status: "reserved", runId: `r${n}`, remaining: 4 }; }, async finish() {} };
};
const access = (over: Partial<ExplainAccess> = {}): ExplainAccess => ({ candidate: async () => candidate, job: async id => id === "job-1" ? job : null, runs: memoryRuns(), ...over });
const ORIGIN = "http://localhost:3000";
const req = (body: unknown, origin = ORIGIN) => new Request(`${ORIGIN}/api/v1/cv-analysis/explain`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("explain endpoint: session, input and missing jobs are handled before any AI call", async () => {
  const fake = () => providerFromEnv({ AI_FAKE: "1", NODE_ENV: "test" })!.provider;
  assert.equal((await cvExplainHandlers(async () => null, fake).POST(req({ jobId: "job-1" }))).status, 401);
  assert.equal((await cvExplainHandlers(async () => access(), fake).POST(req({ jobId: "job-1" }, "https://evil.example"))).status, 403);
  for (const body of [{}, { jobId: "../x" }, { pasted: { title: "x", description: "short" } }, { jobId: "job-1", score: 100 }]) {
    assert.equal((await cvExplainHandlers(async () => access(), fake).POST(req(body))).status, 400, JSON.stringify(body));
  }
  assert.equal((await cvExplainHandlers(async () => access(), fake).POST(req({ jobId: "gone" }))).status, 404);
  assert.equal((await cvExplainHandlers(async () => access(), () => null).POST(req({ jobId: "job-1" }))).status, 501);
});

test("explain endpoint: the test AI answers and the guard removes its deliberately unsafe tip", async () => {
  const fake = () => providerFromEnv({ AI_FAKE: "1", NODE_ENV: "test" })!.provider;
  const response = await cvExplainHandlers(async () => access(), fake).POST(req({ jobId: "job-1" }));
  assert.equal(response.status, 200);
  const body = await response.json() as { explanation: { cvTips: string[]; strengths: string[] }; removed: number; model: string };
  assert.equal(body.model, "careerforge-test-ai");
  assert.ok(body.removed >= 1, "the 'List PostgreSQL among your skills' tip is removed");
  assert.equal(body.explanation.cvTips.some(tip => /PostgreSQL|Docker/.test(tip)), false);
  const pasted = await cvExplainHandlers(async () => access(), fake).POST(req({ pasted: { title: "Data Analyst", company: "", description: "You will use SQL and Python every day in this data analysis role." } }));
  assert.equal(pasted.status, 200);
});
