import { z } from "zod";
import { buildRoles } from "@/data/roadmaps/roles-build";
import { dataRoles } from "@/data/roadmaps/roles-data";
import { operateRoles } from "@/data/roadmaps/roles-operate";
import { sharedTopics } from "@/data/roadmaps/shared";
import { languageSkills } from "@/data/roadmaps/skills-languages";
import { systemSkills } from "@/data/roadmaps/skills-systems";
import { courses } from "@/lib/learning/catalog";
import type { LearningCourse } from "@/lib/learning/schema";
import { parseRoadmap, parseSharedTopics } from "./parse";
import { roadmapSchema, type Roadmap, type RoadmapArea } from "./schema";

/** Goal id stored for roadmaps that have no specialisations. */
export const wholeRoadmap = "complete";

const guided: Record<string, { area: RoadmapArea; keywords: string[]; courseTopics: string[]; related: string[] }> = {
  python: { area: "programming", keywords: ["python", "django", "flask", "fastapi"], courseTopics: ["Python", "Django", "FastAPI", "Flask"], related: ["data-analyst", "backend", "machine-learning", "data-structures-algorithms"] },
  "web-development": { area: "web", keywords: ["web development", "html", "css", "javascript"], courseTopics: ["Web Development", "HTML and CSS", "JavaScript"], related: ["frontend", "javascript", "react", "nodejs"] }
};

/** The in-depth guided paths keep their rich lessons but share the simple roadmap shape. */
function fromGuidedCourse(course: LearningCourse): Roadmap {
  const extra = guided[course.id];
  if (!extra) throw new Error(`Guided course ${course.id} has no roadmap details`);
  return {
    id: course.id, version: course.version, kind: "skill", title: course.title, area: extra.area, tagline: course.tagline, inDepth: true,
    keywords: extra.keywords, courseTopics: extra.courseTopics, related: extra.related,
    roadmapSh: course.roadmapSh ? new URL(course.roadmapSh.url).pathname.slice(1) : null,
    tracks: course.goals.map(goal => ({
      id: goal.id,
      title: goal.title,
      sections: course.phases.filter(phase => phase.career ? goal.careerFocus : phase.branch === null || goal.branches.includes(phase.branch)).map(phase => phase.id)
    })),
    defaultTrack: course.goals[0].id,
    sections: course.phases.map(phase => ({
      id: phase.id,
      title: phase.title.replace(/^Specialisation:\s*/, "").replace(/^./, letter => letter.toUpperCase()),
      goal: phase.goal,
      checkpoint: null,
      topics: course.topics.filter(topic => topic.phaseId === phase.id).map(topic => ({
        id: topic.id, title: topic.title, summary: topic.summary, kind: topic.tier === "optional" ? "optional" as const : "core" as const,
        resources: topic.resources, deepDive: null, shared: false,
        guide: {
          why: topic.why, objectives: topic.objectives, example: topic.example?.code ?? null,
          exercises: topic.miniProject ? [...topic.exercises, `Mini-project: ${topic.miniProject}`] : topic.exercises,
          doneWhen: topic.doneWhen
        }
      }))
    })),
    projects: course.projects.map(project => ({
      id: project.id, title: project.title, level: project.level, summary: project.objective,
      requirements: project.requirements, stretch: project.stretch, skills: project.skills
    }))
  };
}

// Validated once while loading, so a malformed line, duplicate id or broken
// reference fails tests and builds instead of reaching learners.
const shared = parseSharedTopics(sharedTopics);
export const roadmaps: readonly Roadmap[] = z.array(roadmapSchema).parse([
  ...[...buildRoles, ...dataRoles, ...operateRoles, ...languageSkills, ...systemSkills].map(([meta, body]) => parseRoadmap(meta, body, shared)),
  // Guided course data is declared loosely typed; courses are already validated by the learning catalog.
  ...courses.map(fromGuidedCourse)
]);

const byId = new Map(roadmaps.map(roadmap => [roadmap.id, roadmap]));
if (byId.size !== roadmaps.length) throw new Error("Duplicate roadmap id");
for (const roadmap of roadmaps) {
  const references = [...roadmap.related, ...roadmap.sections.flatMap(section => section.topics.flatMap(topic => topic.deepDive ? [topic.deepDive] : []))];
  for (const id of references) if (!byId.has(id)) throw new Error(`${roadmap.id} refers to unknown roadmap ${id}`);
}

export const roleRoadmaps = roadmaps.filter(roadmap => roadmap.kind === "role");
export const skillRoadmaps = roadmaps.filter(roadmap => roadmap.kind === "skill");

export function getRoadmap(id: unknown): Roadmap | undefined {
  return typeof id === "string" ? byId.get(id) : undefined;
}

export const isRoadmapGoal = (roadmap: Roadmap, goalId: string) =>
  roadmap.tracks.length ? roadmap.tracks.some(track => track.id === goalId) : goalId === wholeRoadmap;

export const defaultGoal = (roadmap: Roadmap) => roadmap.defaultTrack ?? wholeRoadmap;

export const topicCount = (roadmap: Roadmap) => roadmap.sections.reduce((sum, section) => sum + section.topics.length, 0);
