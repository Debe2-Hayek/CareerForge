import { detectSkills, requiredYears } from "../jobs/text-signals";
import type { ClaimStatus } from "../claims/model";
import { linkSkill, sameSkill, type SkillLink } from "../skill-match";

/**
 * CV-to-job compatibility (report M6, FR-6.2): a deterministic, reproducible score
 * from the owner's saved records. The AI never computes or changes it.
 */
export type JobInput = { title: string; company: string; skills: string[]; description: string; experienceLevel: string | null };
export type CandidateInput = {
  headline: string;
  skills: { name: string; status: ClaimStatus }[];
  experience: { role: string; company: string; startDate: string | null; endDate: string | null; isCurrent: boolean }[];
  education: { degree: string; institution: string }[];
  project: string;
  checkable: string[];
};
export type FactorId = "skills" | "experience" | "role" | "education";
export type Factor = { id: FactorId; label: string; weight: number; score: number | null; detail: string };
/** matched: the profile has the skill or one that shows it ("PostgreSQL" shows "SQL"); a related alternative only earns partial credit. */
export type SkillMatch = { name: string; status: ClaimStatus | null; matched: boolean; link: SkillLink | null };
export type NextStep = { kind: "check" | "learn" | "prove" | "experience" | "education" | "profile"; text: string; href: string };
export type Analysis = {
  score: number; label: "Strong match" | "Good match" | "Partial match" | "Early stage";
  factors: Factor[]; skills: SkillMatch[]; yearsRequired: number | null; yearsHave: number;
  steps: NextStep[];
};

const LEVEL_YEARS: Record<string, number> = { internship: 0, entry: 0, mid: 2, senior: 5, lead: 7 };
const STOP = new Set(["and", "or", "of", "the", "a", "an", "to", "in", "for", "with", "at", "on", "senior", "junior", "sr", "jr", "lead", "principal", "staff", "intern", "internship", "entry", "level", "mid", "remote", "hybrid", "full", "part", "time", "i", "ii", "iii"]);
const norm = (value: string) => value.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase().replace(/[^\p{L}\p{N}+#]+/gu, " ").trim();
// Job-title words with the same meaning count as the same word for role fit.
const TITLE_SYNONYMS: Record<string, string> = { engineer: "developer", programmer: "developer", dev: "developer", coder: "developer", swe: "developer",
  frontend: "frontend", "front-end": "frontend", backend: "backend", "back-end": "backend", fullstack: "fullstack", "full-stack": "fullstack",
  analytics: "analyst", analysis: "analyst", designer: "designer", design: "designer", administrator: "admin", sysadmin: "admin", ml: "machine", ai: "machine" };
const titleWords = (value: string) => {
  const joined = norm(value).replace(/\bfront end\b/g, "frontend").replace(/\bback end\b/g, "backend").replace(/\bfull stack\b/g, "fullstack");
  return joined.split(" ").filter(word => word.length > 1 && !STOP.has(word)).map(word => TITLE_SYNONYMS[word] ?? word);
};

/** Months of experience, counting overlapping jobs once. Dates without a start are ignored. */
export function experienceYears(records: CandidateInput["experience"], now = new Date()): number {
  const spans = records.flatMap(record => {
    if (!record.startDate) return [];
    const start = Date.parse(record.startDate);
    const end = record.isCurrent || !record.endDate ? now.getTime() : Date.parse(record.endDate);
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? [[start, Math.min(end, now.getTime())] as const] : [];
  }).sort((a, b) => a[0] - b[0]);
  let total = 0;
  let current: [number, number] | null = null;
  for (const [start, end] of spans) {
    if (current && start <= current[1]) current[1] = Math.max(current[1], end);
    else { if (current) total += current[1] - current[0]; current = [start, end]; }
  }
  if (current) total += current[1] - current[0];
  return Math.round((total / (365.25 * 24 * 3600 * 1000)) * 10) / 10;
}

export function analyseFit(job: JobInput, candidate: CandidateInput, now = new Date()): Analysis {
  const required = [...new Map((job.skills.length ? job.skills : detectSkills(job.title, job.description)).filter(s => s.trim()).map(s => [norm(s), s.trim()])).values()].slice(0, 25);
  const ownNames = candidate.skills.map(skill => skill.name);
  const skills: SkillMatch[] = required.map(name => {
    const link = linkSkill(name, ownNames);
    const own = link ? candidate.skills.find(skill => skill.name === link.via) : undefined;
    return { name, status: own?.status ?? null, matched: link?.relation === "exact" || link?.relation === "shows", link };
  });
  // A proven skill counts fully; a self-declared one slightly less, so proof visibly helps.
  // A related alternative (MySQL for PostgreSQL) earns half.
  const confirmed = (status: ClaimStatus | null) => status === "verified" || status === "reviewed";
  const credit = (skill: SkillMatch) => !skill.link ? 0 : (confirmed(skill.status) ? 1 : 0.85) * (skill.link.relation === "related" ? 0.5 : 1);
  const skillScore = required.length ? skills.reduce((sum, skill) => sum + credit(skill), 0) / required.length : null;
  const relatedCount = skills.filter(skill => skill.link?.relation === "related").length;
  const matchedCount = skills.filter(skill => skill.matched).length;

  const yearsRequired = requiredYears(job.description) ?? (job.experienceLevel ? LEVEL_YEARS[job.experienceLevel] ?? null : null);
  const yearsHave = experienceYears(candidate.experience, now);
  const experienceScore = yearsRequired === null ? null : yearsRequired === 0 ? (candidate.experience.length ? 1 : 0.7) : Math.min(1, yearsHave / yearsRequired);

  const jobWords = titleWords(job.title);
  const ownWords = new Set(titleWords([candidate.headline, ...candidate.experience.map(item => item.role), candidate.project].join(" ")));
  const roleScore = jobWords.length ? jobWords.filter(word => ownWords.has(word)).length / jobWords.length : null;

  const degreeAsked = /\b(bachelor'?s?|degree|b\.?sc|b\.?e\b|b\.?a\b|master'?s?|m\.?sc|mba|ph\.?d|diploma)\b/i.test(job.description);
  const educationScore = degreeAsked ? (candidate.education.length ? 1 : 0) : (candidate.education.length ? 1 : 0.8);

  const factors: Factor[] = [
    { id: "skills", label: "Skills", weight: 45, score: skillScore, detail: required.length ? `${matchedCount} of ${required.length} listed skills on your profile${matchedCount ? `, ${skills.filter(skill => skill.matched && confirmed(skill.status)).length} proven` : ""}${relatedCount ? `; ${relatedCount} more close to one you have` : ""}.` : "The posting lists no skills CareerForge can recognise." },
    { id: "experience", label: "Experience", weight: 25, score: experienceScore, detail: yearsRequired === null ? "The posting does not say how much experience it wants." : yearsRequired === 0 ? `Entry level. You have ${yearsHave} ${yearsHave === 1 ? "year" : "years"} in your work history.` : `Asks for about ${yearsRequired}+ years; your work history adds up to ${yearsHave}.` },
    { id: "role", label: "Role fit", weight: 15, score: roleScore, detail: roleScore === null ? "The job title gives nothing to compare." : roleScore >= 0.5 ? "Your headline or past roles use the same words as the job title." : "Your headline and past roles share few words with the job title." },
    { id: "education", label: "Education", weight: 15, score: educationScore, detail: degreeAsked ? (candidate.education.length ? "The posting mentions a degree; you have education on your profile." : "The posting mentions a degree; your profile has no education record.") : "The posting does not ask for a degree." }
  ];
  const assessable = factors.filter(factor => factor.score !== null);
  const weight = assessable.reduce((sum, factor) => sum + factor.weight, 0);
  const score = weight ? Math.round(assessable.reduce((sum, factor) => sum + factor.weight * (factor.score ?? 0), 0) / weight * 100) : 0;
  const label = score >= 75 ? "Strong match" : score >= 55 ? "Good match" : score >= 35 ? "Partial match" : "Early stage";

  const steps: NextStep[] = [];
  for (const skill of skills.filter(item => !item.matched).slice(0, 4)) {
    const check = candidate.checkable.find(name => sameSkill(name, skill.name));
    const head = skill.link?.relation === "related" ? ` (your ${skill.link.via} is a head start)` : "";
    steps.push(check ? { kind: "check", text: `Add ${skill.name} to your profile and pass the ${check} check${head}`, href: "/skill-checks" } : { kind: "learn", text: `Learn ${skill.name}${head}: find a free path`, href: "/learning-roadmap" });
  }
  for (const skill of skills.filter(item => item.matched && !confirmed(item.status)).slice(0, 2)) {
    steps.push({ kind: "prove", text: `Prove ${skill.link?.relation === "shows" ? skill.link.via : skill.name}: a passed check or reviewed certificate counts fully`, href: candidate.checkable.some(name => sameSkill(name, skill.name)) ? "/skill-checks" : "/account/verification" });
  }
  if (experienceScore !== null && experienceScore < 1 && yearsRequired) steps.push({ kind: "experience", text: candidate.experience.length ? "Add every job, internship and dated project to your work history" : "Add your work history, including internships", href: "/account/history" });
  if (degreeAsked && !candidate.education.length) steps.push({ kind: "education", text: "Add your education record", href: "/account/history" });
  if (roleScore !== null && roleScore < 0.5) steps.push({ kind: "profile", text: "Use a headline that names the role you are aiming for", href: "/account#account-headline" });
  return { score, label, factors, skills, yearsRequired, yearsHave, steps: steps.slice(0, 6) };
}
