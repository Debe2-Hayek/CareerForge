import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalSkill, demonstrated, linkSkill, sameSkill } from "./skill-match";
import { ALIASES, RELATED, SHOWS } from "../data/skill-relations";
import { analyseFit, type CandidateInput, type JobInput } from "./cv-analysis/score";
import { coveringName } from "./career-analysis/score";

test("spellings people type map to one name; Java is never JavaScript", () => {
  assert.equal(canonicalSkill("postgres"), "PostgreSQL");
  assert.equal(canonicalSkill(" ReactJS "), "React");
  assert.equal(canonicalSkill("node.js"), "Node.js");
  assert.equal(canonicalSkill("k8s"), "Kubernetes");
  assert.equal(canonicalSkill("Underwater basket weaving"), "Underwater basket weaving", "unknown names stay as typed");
  assert.equal(sameSkill("React.js", "react"), true);
  assert.equal(sameSkill("Java", "JavaScript"), false);
  assert.equal(sameSkill("C", "C#"), false);
});

test("what a skill shows follows the reviewed list, transitively, and never loops", () => {
  assert.deepEqual(demonstrated("Next.js").sort(), ["JavaScript", "React"]);
  assert.deepEqual(demonstrated("postgres"), ["SQL"]);
  assert.deepEqual(demonstrated("SQL"), [], "a general skill does not show a specific one");
  assert.deepEqual(demonstrated("Java"), []);
  for (const skill of Object.keys(SHOWS)) assert.ok(demonstrated(skill).length < 20, skill);
});

test("linking: exact, shows, related, or nothing", () => {
  assert.deepEqual(linkSkill("SQL", ["PostgreSQL"]), { relation: "shows", via: "PostgreSQL" });
  assert.deepEqual(linkSkill("PostgreSQL", ["SQL"]), null, "knowing SQL does not prove PostgreSQL");
  assert.deepEqual(linkSkill("PostgreSQL", ["MySQL"]), { relation: "related", via: "MySQL" });
  assert.deepEqual(linkSkill("React", ["reactjs", "Vue"]), { relation: "exact", via: "reactjs" });
  assert.deepEqual(linkSkill("JavaScript", ["Java"]), null);
  assert.deepEqual(linkSkill("Python", ["Django"]), { relation: "shows", via: "Django" });
});

test("the reviewed list stays well formed: no self links, every alias points to a known name", () => {
  for (const [skill, shows] of Object.entries(SHOWS)) assert.equal(shows.includes(skill), false, skill);
  for (const group of RELATED) assert.equal(new Set(group).size, group.length);
  const known = new Set([...Object.keys(SHOWS), ...Object.values(SHOWS).flat(), ...RELATED.flat(), "Go", "C#", ".NET", "HTML", "CSS", "Excel", "UI/UX", "REST APIs", "Artificial Intelligence", "Git", "Cybersecurity", "Machine Learning", "Kubernetes", "AWS", "GCP", "Azure", "Scrum"]);
  for (const [alias, name] of Object.entries(ALIASES)) assert.ok(known.has(name), `${alias} → ${name}`);
});

const job: JobInput = { title: "Backend Engineer", company: "Acme", skills: ["SQL", "Python", "PostgreSQL", "Docker"], description: "", experienceLevel: null };
const candidate = (skills: string[]): CandidateInput => ({ headline: "Backend developer", skills: skills.map(name => ({ name, status: "self_declared" as const })), experience: [], education: [], project: "", checkable: [] });

test("CV analysis: a skill that shows another counts, a related one earns half, and titles match by meaning", () => {
  const before = analyseFit(job, candidate([]));
  const fit = analyseFit(job, candidate(["Django", "MySQL"]));
  const by = (name: string) => fit.skills.find(skill => skill.name === name)!;
  assert.deepEqual(by("Python").link, { relation: "shows", via: "Django" });
  assert.equal(by("Python").matched, true);
  assert.equal(by("SQL").matched, true, "MySQL shows SQL");
  assert.deepEqual(by("PostgreSQL").link, { relation: "related", via: "MySQL" });
  assert.equal(by("PostgreSQL").matched, false);
  assert.equal(by("Docker").link, null);
  const skills = fit.factors.find(factor => factor.id === "skills")!;
  assert.equal(Math.round(skills.score! * 1000), Math.round(((0.85 + 0.85 + 0.425) / 4) * 1000));
  assert.match(skills.detail, /1 more close to one you have/);
  assert.ok(fit.steps.some(step => step.text.includes("Learn PostgreSQL (your MySQL is a head start)")));
  assert.equal(fit.factors.find(factor => factor.id === "role")!.score, 1, "Engineer and developer mean the same here");
  assert.ok(fit.score > before.score);
});

test("career analysis: a skill covers topics it shows", () => {
  assert.equal(coveringName("Next.js", "React fundamentals"), "React");
  assert.equal(coveringName("postgres", "PostgreSQL basics"), "PostgreSQL");
  assert.equal(coveringName("Java", "JavaScript basics"), null);
});
