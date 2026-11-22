import type { LearningSnapshot } from "@/lib/learning/api";
import { defaultGoal, getRoadmap, isRoadmapGoal, roadmaps } from "./catalog";
import { sectionsFor, summarize, type ProgressSummary, type TopicMarks } from "./marks";
import type { Roadmap } from "./schema";

// Server-side progress for the learner's saved rows. Deterministic: no AI and
// no estimates. The pure maths shared with the browser lives in marks.ts.

/** The learner's marks for one roadmap, including shared topics finished elsewhere. */
export function marksFor(roadmap: Roadmap, snapshot: LearningSnapshot | null): TopicMarks {
  const own = snapshot?.progress[roadmap.id]?.topics ?? {};
  const marks: TopicMarks = {};
  for (const topic of roadmap.sections.flatMap(section => section.topics)) {
    if (own[topic.id]) { marks[topic.id] = { state: own[topic.id], via: null }; continue; }
    if (!topic.shared) continue;
    for (const [otherId, progress] of Object.entries(snapshot?.progress ?? {})) {
      const state = otherId === roadmap.id ? undefined : progress.topics[topic.id];
      if (state !== "completed" && state !== "known") continue;
      const other = getRoadmap(otherId);
      // The same id in another roadmap only counts when it is the same shared topic.
      if (!other?.sections.some(section => section.topics.some(item => item.id === topic.id && item.shared))) continue;
      marks[topic.id] = { state, via: other.title };
      break;
    }
  }
  return marks;
}

/** The learner's saved specialisation when it still exists, otherwise the default. */
export function trackFor(roadmap: Roadmap, snapshot: LearningSnapshot | null): string | null {
  if (!roadmap.tracks.length) return null;
  const saved = snapshot?.enrollments.find(item => item.courseId === roadmap.id)?.goalId;
  return saved && isRoadmapGoal(roadmap, saved) ? saved : defaultGoal(roadmap);
}

/** Moves to a specialisation that shows the requested topic, so deep links never open an invisible topic. */
export function trackShowing(roadmap: Roadmap, trackId: string | null, topicId: string | null): string | null {
  if (!topicId || !roadmap.tracks.length) return trackId;
  const shows = (id: string | null) => sectionsFor(roadmap, id).some(section => section.topics.some(topic => topic.id === topicId));
  return shows(trackId) ? trackId : roadmap.tracks.find(track => shows(track.id))?.id ?? trackId;
}

export type ActiveRoadmap = { roadmap: Roadmap; summary: ProgressSummary };

/** Roadmaps the learner has started or saved, most recent first. */
export function activeRoadmaps(snapshot: LearningSnapshot | null): ActiveRoadmap[] {
  return (snapshot?.enrollments ?? []).flatMap(enrollment => {
    const roadmap = getRoadmap(enrollment.courseId);
    if (!roadmap) return [];
    return [{ roadmap, summary: summarize(sectionsFor(roadmap, trackFor(roadmap, snapshot)), marksFor(roadmap, snapshot)) }];
  });
}

export type Suggestion = { roadmap: Roadmap; reason: string };
const words = (value: string) => ` ${value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").replace(/\.(?=\s|$)/g, "").trim()} `;

/** Explainable suggestions from the learner's own headline and skills. */
export function suggestRoadmaps(profile: { headline: string; skills: string[] }, startedIds: Set<string>, limit = 3): Suggestion[] {
  const headline = words(profile.headline);
  return roadmaps
    .filter(roadmap => !startedIds.has(roadmap.id))
    .flatMap(roadmap => {
      const keywords = roadmap.keywords.map(words);
      const inHeadline = roadmap.keywords.find((_, index) => headline.includes(keywords[index]));
      const matched = profile.skills.filter(skill => keywords.includes(words(skill)));
      if (!inHeadline && !matched.length) return [];
      const score = (inHeadline ? 3 : 0) + matched.length + (roadmap.kind === "role" ? 0.5 : 0);
      const reason = inHeadline ? `Matches “${inHeadline}” in your headline` : `Builds on ${matched.slice(0, 2).join(" and ")}`;
      return [{ roadmap, reason, score }];
    })
    .sort((a, b) => b.score - a.score || a.roadmap.title.localeCompare(b.roadmap.title))
    .slice(0, limit)
    .map(({ roadmap, reason }) => ({ roadmap, reason }));
}
