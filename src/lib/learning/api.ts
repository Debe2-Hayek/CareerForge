import { z } from "zod";
import { getCourse } from "./catalog";
import {
  experienceLevelSchema, projectStateSchema, resourceFormatSchema, slugSchema, topicStateSchema,
  type ExperienceLevel, type ProjectState, type ResourceFormat, type TopicState
} from "./schema";
import type { LearningProgress, LearningSettings } from "./plan";

// Wire formats shared by the API handlers, the server data access and the client.

export const enrollmentInputSchema = z.object({
  courseId: slugSchema,
  goalId: slugSchema,
  level: experienceLevelSchema,
  weeklyHours: z.number().int().min(1).max(40),
  format: resourceFormatSchema
}).strict();
export type EnrollmentInput = z.infer<typeof enrollmentInputSchema>;

const evidenceUrlSchema = z.string().trim().max(300).url().refine(value => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
}, "Use a public https:// link");

export const progressInputSchema = z.discriminatedUnion("kind", [
  z.object({ courseId: slugSchema, kind: z.literal("topic"), itemId: slugSchema, state: topicStateSchema.nullable() }).strict(),
  z.object({ courseId: slugSchema, kind: z.literal("project"), itemId: slugSchema, state: projectStateSchema.nullable(), evidenceUrl: evidenceUrlSchema.nullable().optional() }).strict()
]);
export type ProgressInput = z.infer<typeof progressInputSchema>;

/** Rejects ids that are well-formed but not part of the current curriculum. */
export function validateAgainstCatalog(input: EnrollmentInput | ProgressInput): string | null {
  const course = getCourse(input.courseId);
  if (!course) return "Unknown learning path.";
  if ("goalId" in input) return course.goals.some(goal => goal.id === input.goalId) ? null : "Unknown learning goal.";
  const exists = input.kind === "topic"
    ? course.topics.some(topic => topic.id === input.itemId)
    : course.projects.some(project => project.id === input.itemId);
  return exists ? null : `Unknown ${input.kind}.`;
}

export type Enrollment = LearningSettings & {
  courseId: string;
  contentVersion: number;
  startedAt: string;
  lastActiveAt: string;
};

export type LearningSnapshot = {
  enrollments: Enrollment[];
  progress: Record<string, LearningProgress>;
};

const enrollmentRowSchema = z.object({
  course_id: z.string(),
  goal_id: z.string(),
  experience_level: experienceLevelSchema,
  weekly_hours: z.number().int(),
  resource_format: resourceFormatSchema,
  content_version: z.number().int(),
  started_at: z.string(),
  last_active_at: z.string()
});
const progressRowSchema = z.object({
  course_id: z.string(),
  item_kind: z.enum(["topic", "project"]),
  item_id: z.string(),
  state: z.string(),
  evidence_url: z.string().nullable()
});

export function toSnapshot(enrollmentRows: unknown[], progressRows: unknown[]): LearningSnapshot {
  const enrollments = z.array(enrollmentRowSchema).parse(enrollmentRows).map((row): Enrollment => ({
    courseId: row.course_id,
    goalId: row.goal_id,
    level: row.experience_level as ExperienceLevel,
    weeklyHours: row.weekly_hours,
    format: row.resource_format as ResourceFormat,
    contentVersion: row.content_version,
    startedAt: row.started_at,
    lastActiveAt: row.last_active_at
  }));
  const progress: Record<string, LearningProgress> = {};
  for (const row of z.array(progressRowSchema).parse(progressRows)) {
    const entry = progress[row.course_id] ??= { topics: {}, projects: {} };
    if (row.item_kind === "topic") {
      const state = topicStateSchema.safeParse(row.state);
      if (state.success) entry.topics[row.item_id] = state.data as TopicState;
    } else {
      const state = projectStateSchema.safeParse(row.state);
      if (state.success) entry.projects[row.item_id] = { state: state.data as ProjectState, evidenceUrl: row.evidence_url };
    }
  }
  return { enrollments, progress };
}
