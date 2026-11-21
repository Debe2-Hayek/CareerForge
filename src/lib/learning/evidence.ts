import { normalizeSkill } from "@/lib/demo-workspace";
import { courses } from "./catalog";
import type { LearningSnapshot } from "./api";

// Distinguishes how strongly a skill is evidenced. Order matters: an assessed
// skill check outranks a built project, which outranks completed lessons.
// Self-reported profile skills are handled by the caller and rank lowest.
export type SkillEvidenceLevel = "assessed" | "project" | "practised";
export type SkillEvidence = { level: SkillEvidenceLevel; label: string };

const rank: Record<SkillEvidenceLevel, number> = { assessed: 3, project: 2, practised: 1 };
export const skillKey = (value: string) => normalizeSkill(value).replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();

export function collectSkillEvidence(snapshot: LearningSnapshot | null, passedChecks: string[]): Map<string, SkillEvidence> {
  const evidence = new Map<string, SkillEvidence>();
  const add = (skill: string, item: SkillEvidence) => {
    const key = skillKey(skill);
    const current = evidence.get(key);
    if (!current || rank[item.level] > rank[current.level]) evidence.set(key, item);
  };
  for (const skill of passedChecks) add(skill, { level: "assessed", label: `Passed the CareerForge ${skill} fundamentals check` });
  for (const course of courses) {
    const progress = snapshot?.progress[course.id];
    if (!progress) continue;
    for (const project of course.projects) {
      const saved = progress.projects[project.id];
      if (saved?.state !== "completed") continue;
      for (const skill of project.skills) add(skill, { level: "project", label: `Built “${project.title}”${saved.evidenceUrl ? " with a public link" : " (self-reported)"}` });
    }
    for (const topic of course.topics) {
      if (progress.topics[topic.id] !== "completed") continue;
      for (const skill of topic.skills) add(skill, { level: "practised", label: `Practised in the ${course.title} path (self-reported)` });
    }
  }
  return evidence;
}

export function strongestEvidence(evidence: Map<string, SkillEvidence>, skills: string[]): SkillEvidence | null {
  let best: SkillEvidence | null = null;
  for (const skill of skills) {
    const item = evidence.get(skillKey(skill));
    if (item && (!best || rank[item.level] > rank[best.level])) best = item;
  }
  return best;
}
