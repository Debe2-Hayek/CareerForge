import { getRoadmap } from "./catalog";
import { coursesFor, hostOf } from "./open-catalog";

/** Server-side details a roadmap view needs about the other roadmaps it links to. */
export const roadmapLookup = {
  titleOf: (id: string) => getRoadmap(id)?.title ?? id,
  coursesOf(id: string) {
    const topics = getRoadmap(id)?.courseTopics.slice(0, 1) ?? [];
    return coursesFor({ courseTopics: topics }, 2).map(course => ({ title: course.title, by: course.by || hostOf(course.url), url: course.url }));
  }
};
