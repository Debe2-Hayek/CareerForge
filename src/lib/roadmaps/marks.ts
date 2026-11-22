import type { TopicState } from "@/lib/learning/schema";

// Pure progress maths used by both server pages and the interactive roadmap.
// Kept free of catalogue imports so the browser never downloads every roadmap.

export type TopicMark = {
  state: TopicState;
  /** Title of the other roadmap where a shared topic was completed; null when marked here. */
  via: string | null;
};
export type TopicMarks = Record<string, TopicMark>;

/** "Done" means the learner marked a topic completed or already known. */
export const isDone = (mark: TopicMark | undefined) => mark?.state === "completed" || mark?.state === "known";

type Track = { id: string; sections: string[] };
export function sectionsFor<S extends { id: string }>(roadmap: { sections: readonly S[]; tracks: readonly Track[] }, trackId: string | null): S[] {
  const track = roadmap.tracks.find(item => item.id === trackId);
  return track ? roadmap.sections.filter(section => track.sections.includes(section.id)) : [...roadmap.sections];
}

type Countable = { topics: readonly { id: string; kind: string; title: string }[] };
export type ProgressSummary = { total: number; done: number; percent: number; nextId: string | null; nextTitle: string | null };

/** Only core topics count: extras never hold a learner back or inflate the figure. */
export function summarize(sections: readonly Countable[], marks: TopicMarks): ProgressSummary {
  const core = sections.flatMap(section => section.topics).filter(topic => topic.kind === "core");
  const done = core.filter(topic => isDone(marks[topic.id])).length;
  const next = core.find(topic => marks[topic.id]?.state === "in_progress") ?? core.find(topic => !isDone(marks[topic.id]));
  return { total: core.length, done, percent: core.length ? Math.floor(done / core.length * 100) : 0, nextId: next?.id ?? null, nextTitle: next?.title ?? null };
}
