import { z } from "zod";
import { pythonCourse } from "@/data/learning/python";
import { webCourse } from "@/data/learning/web";
import { courseSchema, type LearningCourse } from "./schema";

// Content is validated once at module load: an invalid prerequisite graph, a
// duplicate id or a paid resource in a required topic fails tests and builds
// instead of reaching learners.
export const courses: readonly LearningCourse[] = z.array(courseSchema).parse([pythonCourse, webCourse]);

const byId = new Map(courses.map(course => [course.id, course]));
if (byId.size !== courses.length) throw new Error("Duplicate learning course id");

export function getCourse(id: unknown): LearningCourse | undefined {
  return typeof id === "string" ? byId.get(id) : undefined;
}
