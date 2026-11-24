import type { ClaimStatus } from "../claims/model";
import { isDone, type TopicMarks } from "../roadmaps/marks";
import { canonicalSkill, demonstrated } from "../skill-match";

/**
 * Career analysis (report M2, FR-2.1/2.3): a deterministic match between the user and a
 * career's roadmap, with every topic ranked Critical, Important or Optional. The AI never
 * computes or changes the score.
 */
export type Priority = "critical" | "important" | "optional";
export type EvidenceLevel = "proven" | "profile" | "learned" | "learning" | "none";
export type CareerTopic = { id: string; title: string; section: string; priority: Priority; evidence: EvidenceLevel; detail: string; href: string };
export type CareerSummary = { id: string; title: string; area: string; tagline: string; score: number; critical: { done: number; total: number }; important: { done: number; total: number } };
export type CareerDetail = CareerSummary & { topics: CareerTopic[] };
export type SkillWithStatus = { name: string; status: ClaimStatus };

type RoadmapLike = { id: string; title: string; area: string; tagline: string; sections: readonly { id: string; title: string; topics: readonly { id: string; title: string; kind: string }[] }[] };

const PRIORITY_WEIGHT: Record<Priority, number> = { critical: 3, important: 2, optional: 0 };
export const EVIDENCE_VALUE: Record<EvidenceLevel, number> = { proven: 1, profile: 0.8, learned: 0.7, learning: 0.3, none: 0 };
const norm = (value: string) => ` ${value.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase().replace(/\.js\b/g, " js").replace(/[^\p{L}\p{N}+#]+/gu, " ").trim()} `;

/** A profile skill covers a topic when it appears as whole words in the topic title ("Docker" in "Containers with Docker"). */
export function skillCoversTopic(skill: string, topicTitle: string): boolean {
  const phrase = norm(skill);
  return phrase.trim().length >= 1 && norm(topicTitle).includes(phrase);
}

/**
 * The name under which a profile skill covers a topic: the skill itself, its usual spelling
 * ("postgres" → PostgreSQL), or a skill it shows ("Next.js" shows React and JavaScript), using the
 * reviewed relations in src/data/skill-relations.ts. Null when it does not cover the topic.
 */
export function coveringName(skill: string, topicTitle: string): string | null {
  return [skill, canonicalSkill(skill), ...demonstrated(skill)].find(name => skillCoversTopic(name, topicTitle)) ?? null;
}

/** Foundations first: core topics in the first half of a roadmap are Critical, the rest Important. */
export function topicPriority(kind: string, sectionIndex: number, sectionCount: number): Priority {
  if (kind !== "core") return "optional";
  return sectionIndex < Math.ceil(sectionCount / 2) ? "critical" : "important";
}

export function analyseCareer(roadmap: RoadmapLike, skills: SkillWithStatus[], marks: TopicMarks): CareerDetail {
  const topics: CareerTopic[] = roadmap.sections.flatMap((section, index) => section.topics.map(topic => {
    const priority = topicPriority(topic.kind, index, roadmap.sections.length);
    const skill = skills.find(item => coveringName(item.name, topic.title) !== null);
    const via = skill ? coveringName(skill.name, topic.title) : null;
    const name = skill && via && canonicalSkill(via) !== canonicalSkill(skill.name) ? `${skill.name} (shows ${via})` : skill?.name;
    const mark = marks[topic.id];
    let evidence: EvidenceLevel = "none";
    let detail = "Not on your profile or roadmap yet";
    if (skill && (skill.status === "verified" || skill.status === "reviewed")) { evidence = "proven"; detail = `${name}: ${skill.status === "verified" ? "verified by a CareerForge check" : "proof reviewed"}`; }
    else if (skill) { evidence = "profile"; detail = `${name} is on your profile (self-declared)`; }
    else if (isDone(mark)) { evidence = "learned"; detail = mark?.via ? `Marked done in ${mark.via}` : mark?.state === "known" ? "Marked as already known" : "Completed on this roadmap"; }
    else if (mark?.state === "in_progress") { evidence = "learning"; detail = "In progress on your roadmap"; }
    return { id: topic.id, title: topic.title, section: section.title, priority, evidence, detail, href: `/learning-roadmap/${roadmap.id}?topic=${topic.id}` };
  }));
  const counted = topics.filter(topic => topic.priority !== "optional");
  const possible = counted.reduce((sum, topic) => sum + PRIORITY_WEIGHT[topic.priority], 0);
  const earned = counted.reduce((sum, topic) => sum + PRIORITY_WEIGHT[topic.priority] * EVIDENCE_VALUE[topic.evidence], 0);
  const tally = (priority: Priority) => ({ done: topics.filter(topic => topic.priority === priority && topic.evidence !== "none" && topic.evidence !== "learning").length, total: topics.filter(topic => topic.priority === priority).length });
  return { id: roadmap.id, title: roadmap.title, area: roadmap.area, tagline: roadmap.tagline, score: possible ? Math.round(earned / possible * 100) : 0, critical: tally("critical"), important: tally("important"), topics };
}

export function rankCareers(details: CareerDetail[]): CareerSummary[] {
  return details.map(({ topics: _topics, ...summary }) => summary).sort((a, b) => b.score - a.score || b.critical.done - a.critical.done || a.title.localeCompare(b.title));
}

export const careerLabel = (score: number) => score >= 75 ? "Ready to apply" : score >= 50 ? "Well on your way" : score >= 25 ? "Building foundations" : "Just starting";
