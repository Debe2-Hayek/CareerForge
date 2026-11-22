import type { ProjectProgress } from "@/lib/learning/api";
import type { ExperienceLevel, ResourceFormat, ResourceType } from "@/lib/learning/schema";
import type { Roadmap, RoadmapArea, RoadmapGuide, RoadmapLesson, RoadmapProject, RoadmapTopicKind } from "@/lib/roadmaps/schema";

// The slice of a roadmap the browser needs. Built on the server so the client
// bundle never contains the whole catalogue.

export type ViewResource = { title: string; provider: string; url: string; type: ResourceType };
export type ViewTopic = {
  id: string; title: string; summary: string; kind: RoadmapTopicKind;
  resources: ViewResource[];
  deepDive: { id: string; title: string } | null;
  /** Whole free courses on a topic that has its own roadmap. */
  courses: { title: string; by: string; url: string }[];
  lesson: RoadmapLesson | null;
  guide: RoadmapGuide | null;
};
export type ViewSection = { id: string; title: string; goal: string; checkpoint: string | null; topics: ViewTopic[] };
export type ViewRoadmap = {
  id: string; title: string; tagline: string; area: RoadmapArea;
  tracks: Roadmap["tracks"]; sections: ViewSection[]; projects: RoadmapProject[];
};
export type ViewSettings = { level: ExperienceLevel; weeklyHours: number; format: ResourceFormat };
export type ProjectStates = Record<string, ProjectProgress>;

type Lookup = { titleOf: (id: string) => string; coursesOf: (id: string) => ViewTopic["courses"] };

export function toViewRoadmap(roadmap: Roadmap, { titleOf, coursesOf }: Lookup): ViewRoadmap {
  return {
    id: roadmap.id, title: roadmap.title, tagline: roadmap.tagline, area: roadmap.area,
    tracks: roadmap.tracks, projects: roadmap.projects,
    sections: roadmap.sections.map(section => ({
      id: section.id, title: section.title, goal: section.goal, checkpoint: section.checkpoint,
      topics: section.topics.map(topic => ({
        id: topic.id, title: topic.title, summary: topic.summary, kind: topic.kind, lesson: topic.lesson, guide: topic.guide,
        resources: topic.resources.map(({ title, provider, url, type }) => ({ title, provider, url, type })),
        deepDive: topic.deepDive ? { id: topic.deepDive, title: titleOf(topic.deepDive) } : null,
        courses: topic.deepDive ? coursesOf(topic.deepDive) : []
      }))
    }))
  };
}
