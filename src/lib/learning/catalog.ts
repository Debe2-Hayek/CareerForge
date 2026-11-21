import { z } from "zod";
import { pythonCourse } from "@/data/learning/python";
import { webCourse } from "@/data/learning/web";
import { courseSchema, type LearningCategory, type LearningCourse, type LearningTopic } from "./schema";

// Content is validated once at module load: an invalid prerequisite graph, a
// duplicate id or a paid resource in a required topic fails tests and builds
// instead of reaching learners.
export const courses: readonly LearningCourse[] = z.array(courseSchema).parse([pythonCourse, webCourse]);

const byId = new Map(courses.map(course => [course.id, course]));
if (byId.size !== courses.length) throw new Error("Duplicate learning course id");

export function getCourse(id: unknown): LearningCourse | undefined {
  return typeof id === "string" ? byId.get(id) : undefined;
}

export function getTopic(course: LearningCourse, topicId: unknown): LearningTopic | undefined {
  return typeof topicId === "string" ? course.topics.find(topic => topic.id === topicId) : undefined;
}

export const categoryLabels: Record<LearningCategory, string> = {
  programming: "Programming",
  web: "Web development",
  data: "Data science",
  ai: "AI & machine learning",
  devops: "DevOps",
  security: "Cybersecurity",
  mobile: "Mobile",
  design: "Design"
};

export type CourseSummary = {
  id: string;
  title: string;
  tagline: string;
  summary: string;
  categories: LearningCategory[];
  difficulty: string;
  outcomes: string[];
  phaseCount: number;
  topicCount: number;
  projectCount: number;
  // Hours for the shortest goal's core plan, i.e. essential + recommended core topics.
  coreHours: number;
  goals: { id: string; title: string }[];
};

export function summarizeCourse(course: LearningCourse): CourseSummary {
  const corePhases = new Set(course.phases.filter(phase => !phase.branch && !phase.career).map(phase => phase.id));
  const coreHours = course.topics.filter(topic => corePhases.has(topic.phaseId) && topic.tier !== "optional").reduce((sum, topic) => sum + topic.hours, 0);
  return {
    id: course.id,
    title: course.title,
    tagline: course.tagline,
    summary: course.summary,
    categories: course.categories,
    difficulty: course.difficulty,
    outcomes: course.outcomes,
    phaseCount: course.phases.length,
    topicCount: course.topics.length,
    projectCount: course.projects.length,
    coreHours: Math.round(coreHours),
    goals: course.goals.map(goal => ({ id: goal.id, title: goal.title }))
  };
}
