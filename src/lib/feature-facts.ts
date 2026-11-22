import type { LearningSnapshot } from "@/lib/learning/api";
import { activeRoadmaps } from "@/lib/roadmaps/progress";
import { lifecycleOf } from "@/lib/workshops/lifecycle";
import type { WorkshopCatalog } from "@/lib/workshops/types";

// One short, true line per tool, taken from the learner's own records. Anything
// unknown is left out rather than guessed.

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

export type FactInput = {
  snapshot: LearningSnapshot | null;
  workshops: WorkshopCatalog | null;
  applications: number | null;
  passedChecks: string[] | null;
  skills: number;
  now: number;
};

export function featureFacts({ snapshot, workshops, applications, passedChecks, skills, now }: FactInput): Record<string, string> {
  const facts: Record<string, string> = {};
  const roadmap = activeRoadmaps(snapshot)[0];
  if (roadmap) facts["learning-roadmap"] = `${roadmap.roadmap.title}: ${roadmap.summary.percent}% done`;
  const states = (workshops?.workshops ?? []).map(workshop => lifecycleOf(workshop, now));
  const running = states.filter(state => state === "live").length, upcoming = states.filter(state => state === "upcoming").length;
  if (running) facts.workshops = `${plural(running, "session")} happening now`;
  else if (upcoming) facts.workshops = `${plural(upcoming, "live session")} coming up`;
  if (applications) facts.applications = `${plural(applications, "role")} saved`;
  if (passedChecks?.length) facts["skill-checks"] = `Passed: ${passedChecks.join(", ")}`;
  if (skills) facts.profile = `${plural(skills, "skill")} listed`;
  const built = Object.values(snapshot?.progress ?? {}).flatMap(progress => Object.values(progress.projects));
  const finished = built.filter(project => project.state === "completed").length, building = built.filter(project => project.state === "building").length;
  if (finished || building) facts.projects = [building ? `${building} in progress` : "", finished ? `${finished} built` : ""].filter(Boolean).join(", ");
  return facts;
}
