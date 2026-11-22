import courseData from "@/data/open-catalog/courses.json";
import tutorialData from "@/data/open-catalog/tutorials.json";
import type { Roadmap, RoadmapArea } from "./schema";

// Openly licensed catalogues imported by scripts/import-open-catalog.mjs.
// Titles and authors come from third parties and are rendered as plain text.

export type OpenCourse = { topic: string; title: string; by: string; url: string };
export type OpenTutorial = { group: string; tech: string; title: string; url: string; source: string };

export const openCourses: readonly OpenCourse[] = courseData.items;
export const openTutorials: readonly OpenTutorial[] = tutorialData.items;
export const catalogImportedAt = courseData.importedAt;

export const catalogCredits = {
  courses: { name: "Free Programming Books", url: "https://github.com/EbookFoundation/free-programming-books", licence: "CC BY 4.0", licenceUrl: "https://creativecommons.org/licenses/by/4.0/" },
  byox: { name: "Build your own X", url: "https://github.com/codecrafters-io/build-your-own-x", licence: "CC0 1.0", licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/" },
  pbl: { name: "Project Based Learning", url: "https://github.com/practical-tutorials/project-based-learning", licence: "MIT", licenceUrl: "https://github.com/practical-tutorials/project-based-learning/blob/master/LICENSE.md" }
} as const;

const areaTopics: Partial<Record<RoadmapArea, string[]>> = {
  web: ["HTML and CSS", "Bootstrap", "JavaScript", "Angular", "Astro", "D3.js", "Electron", "Next.js", "NodeJS", "Nest.js", "React", "Redux", "Remix", "Svelte", "Three.js", "TypeScript", "Vue.js", "Webpack", "Web Development", "PHP", "WordPress", "Django", "FastAPI", "Flask", "Deno", "Vapor", "Cypress"],
  data: ["Data Science", "Databases", "NoSQL", "SQL", "Redis", "Elastic", "R", "Spark", "Jupyter", "Julia", "MATLAB"],
  ai: ["Artificial Intelligence", "Generative AI", "Machine Learning", "Deep Learning", "Soft Computing", "Cuda", "Robotics"],
  cloud: ["Cloud Computing", "AWS", "Azure", "GCP", "DevOps", "Ansible", "Chef", "Jenkins", "Docker", "Kubernetes", "Linux", "Networking", "Terraform", "Bash / Shell", "YAML"],
  security: ["Security", "Cryptography"],
  mobile: ["Android", "iOS", "Flutter", "Dart", "React Native", "Swift", "Kotlin"],
  design: ["UI/UX"],
  games: ["Game Development"],
  cs: ["Algorithms & Data Structures", "Compilers", "Computer Organization and Architecture", "Computer Science", "Graph Theory", "Operating Systems", "Theory", "System Design"],
  product: ["Software Engineering", "Markdown"]
};
const topicOrder = new Map(Object.values(areaTopics).flatMap(topics => topics.map((topic, index) => [topic, index] as const)));
const areaByTopic = new Map(Object.entries(areaTopics).flatMap(([area, topics]) => topics.map(topic => [topic, area as RoadmapArea] as const)));
export const courseArea = (topic: string): RoadmapArea => areaByTopic.get(topic) ?? "programming";

export const courseTopicList = [...new Set(openCourses.map(course => course.topic))].sort((a, b) => a.localeCompare(b));

const terms = (query: string) => query.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
const matches = (haystack: string, query: string[]) => query.every(term => haystack.toLowerCase().includes(term));

/** Takes one course per topic in turn, so a broad list starts with variety instead of fifty courses on one subject. */
function mix(courses: OpenCourse[]): OpenCourse[] {
  const pools = new Map<string, OpenCourse[]>();
  for (const course of courses) pools.set(course.topic, [...(pools.get(course.topic) ?? []), course]);
  const ordered = [...pools.entries()].sort(([a], [b]) => (topicOrder.get(a) ?? 99) - (topicOrder.get(b) ?? 99)).map(([, pool]) => pool);
  const result: OpenCourse[] = [];
  for (let index = 0; result.length < courses.length; index++) for (const pool of ordered) if (pool[index]) result.push(pool[index]);
  return result;
}

export function searchCourses({ query = "", area, topic }: { query?: string; area?: RoadmapArea; topic?: string }): OpenCourse[] {
  const wanted = terms(query);
  const found = openCourses.filter(course => (!topic || course.topic === topic) && (!area || courseArea(course.topic) === area) && matches(`${course.title} ${course.by} ${course.topic}`, wanted));
  return topic ? found : mix(found);
}

export function searchTutorials(query = ""): OpenTutorial[] {
  const wanted = terms(query);
  return openTutorials.filter(item => matches(`${item.title} ${item.tech} ${item.group}`, wanted));
}

/** A short, varied list: courses are taken from the roadmap's topics in turn. */
export function coursesFor(roadmap: Pick<Roadmap, "courseTopics">, limit = 6): OpenCourse[] {
  const pools = roadmap.courseTopics.map(topic => openCourses.filter(course => course.topic === topic));
  const result: OpenCourse[] = [];
  for (let index = 0; result.length < limit && pools.some(pool => index < pool.length); index++) {
    for (const pool of pools) if (pool[index] && result.length < limit) result.push(pool[index]);
  }
  return result;
}

export function hostOf(url: string) {
  const host = new URL(url).hostname.replace(/^(www|m)\./, "");
  return host === "youtu.be" ? "youtube.com" : host;
}
