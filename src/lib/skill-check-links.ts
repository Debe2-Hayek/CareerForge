// Server-side helpers that connect skill checks with the free roadmaps (the roadmap catalogue is large,
// so it stays on the server and pages pass plain links to the browser).
import { skillRoadmaps } from "./roadmaps/catalog";

const simplify = (value: string) => value.toLowerCase().replace(/\.js$/, "").replace(/[^a-z0-9+#]/g, "");

/** The check that proves what a skill roadmap teaches ("react" roadmap → the React check), or null. */
export function checkForRoadmap(roadmap: { id: string; title: string; kind: string }, checkable: readonly string[]): string | null {
  if (roadmap.kind !== "skill") return null;
  const keys = [simplify(roadmap.title), simplify(roadmap.id)];
  return checkable.find(skill => keys.includes(simplify(skill))) ?? null;
}

/** The free roadmap for a skill ("React" → /learning-roadmap/react), or null when there is none. */
export function learnHrefFor(skill: string): string | null {
  const key = simplify(skill);
  const roadmap = skillRoadmaps.find(item => simplify(item.title) === key || simplify(item.id) === key);
  return roadmap ? `/learning-roadmap/${roadmap.id}` : null;
}
