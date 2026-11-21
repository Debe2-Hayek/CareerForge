import { z } from "zod";

// Course content is original CareerForge curriculum. External material is only
// ever linked, never reproduced: roadmap.sh's licence permits sharing links but
// not its text, so each topic cites official/free sources by URL.

export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60);
const text = (max: number) => z.string().trim().min(1).max(max);
const httpsUrl = z.url().refine(value => new URL(value).protocol === "https:", "Resources must use HTTPS");

export const resourceTypeSchema = z.enum(["docs", "interactive", "course", "video", "book", "exercises", "article"]);
export type ResourceType = z.infer<typeof resourceTypeSchema>;

export const resourceSchema = z.object({
  title: text(120),
  provider: text(60),
  url: httpsUrl,
  type: resourceTypeSchema,
  // Every resource in a required topic must be free; paid material may only
  // appear as an explicitly optional alternative.
  free: z.boolean(),
  language: z.literal("en")
}).strict();
export type LearningResource = z.infer<typeof resourceSchema>;

export const topicTierSchema = z.enum(["essential", "recommended", "optional"]);
export type TopicTier = z.infer<typeof topicTierSchema>;
export const topicLevelSchema = z.enum(["foundation", "core", "advanced"]);
export type TopicLevel = z.infer<typeof topicLevelSchema>;

export const topicSchema = z.object({
  id: slugSchema,
  phaseId: slugSchema,
  title: text(80),
  tier: topicTierSchema,
  level: topicLevelSchema,
  hours: z.number().min(0.5).max(40),
  summary: text(420),
  why: text(300),
  objectives: z.array(text(160)).min(2).max(5),
  prerequisites: z.array(slugSchema).max(4),
  example: z.object({ language: z.enum(["python", "bash", "sql", "text"]), code: text(900) }).strict().optional(),
  resources: z.array(resourceSchema).min(1).max(4),
  exercises: z.array(text(260)).min(1).max(4),
  miniProject: text(300).optional(),
  doneWhen: z.array(text(200)).min(2).max(4),
  // Profile/job skill names this topic builds evidence for (used by gap analysis).
  skills: z.array(text(40)).max(4).default([])
}).strict();
export type LearningTopic = z.infer<typeof topicSchema>;

export const phaseSchema = z.object({
  id: slugSchema,
  title: text(60),
  goal: text(220),
  // Core phases apply to everyone; branch phases only to goals that select the branch.
  branch: slugSchema.nullable(),
  career: z.boolean().default(false)
}).strict();
export type LearningPhase = z.infer<typeof phaseSchema>;

export const goalSchema = z.object({
  id: slugSchema,
  title: text(60),
  description: text(200),
  branches: z.array(slugSchema).max(3),
  // Whether portfolio/interview preparation topics count toward this goal.
  careerFocus: z.boolean(),
  careerTrack: slugSchema.nullable()
}).strict();
export type LearningGoal = z.infer<typeof goalSchema>;

export const projectLevelSchema = z.enum(["beginner", "intermediate", "advanced"]);
export const projectSchema = z.object({
  id: slugSchema,
  title: text(70),
  level: projectLevelSchema,
  branch: slugSchema.nullable(),
  objective: text(260),
  requires: z.array(slugSchema).min(1).max(8),
  stack: z.array(text(40)).min(1).max(6),
  requirements: z.array(text(200)).min(2).max(6),
  stretch: z.array(text(200)).max(4),
  milestones: z.array(text(160)).min(2).max(5),
  doneWhen: z.array(text(200)).min(2).max(4),
  portfolioValue: text(240),
  skills: z.array(text(40)).min(1).max(6)
}).strict();
export type LearningProject = z.infer<typeof projectSchema>;

export const categorySchema = z.enum(["programming", "web", "data", "ai", "devops", "security", "mobile", "design"]);
export type LearningCategory = z.infer<typeof categorySchema>;

export const courseSchema = z.object({
  id: slugSchema,
  version: z.number().int().positive(),
  title: text(60),
  tagline: text(140),
  summary: text(400),
  categories: z.array(categorySchema).min(1).max(3),
  difficulty: text(40),
  audience: text(200),
  outcomes: z.array(text(160)).min(2).max(6),
  reviewedAt: z.iso.date(),
  roadmapSh: z.object({ title: text(60), url: httpsUrl.refine(value => new URL(value).hostname === "roadmap.sh") }).strict().nullable(),
  goals: z.array(goalSchema).min(1).max(8),
  phases: z.array(phaseSchema).min(1).max(14),
  topics: z.array(topicSchema).min(1).max(80),
  projects: z.array(projectSchema).max(20)
}).strict().superRefine((course, context) => {
  const issue = (message: string) => context.addIssue({ code: "custom", message: `${course.id}: ${message}` });
  const phases = new Map(course.phases.map(phase => [phase.id, phase]));
  if (phases.size !== course.phases.length) issue("duplicate phase id");
  const branches = new Set(course.phases.flatMap(phase => phase.branch ? [phase.branch] : []));
  const order = new Map<string, number>();
  course.topics.forEach((topic, index) => {
    if (order.has(topic.id)) issue(`duplicate topic id ${topic.id}`);
    order.set(topic.id, index);
  });
  for (const goal of course.goals) {
    for (const branch of goal.branches) if (!branches.has(branch)) issue(`goal ${goal.id} selects unknown branch ${branch}`);
  }
  if (new Set(course.goals.map(goal => goal.id)).size !== course.goals.length) issue("duplicate goal id");
  for (const [index, topic] of course.topics.entries()) {
    const phase = phases.get(topic.phaseId);
    if (!phase) { issue(`topic ${topic.id} has unknown phase ${topic.phaseId}`); continue; }
    for (const prerequisite of topic.prerequisites) {
      const position = order.get(prerequisite);
      // Prerequisites must be declared earlier: this guarantees an acyclic,
      // already-topologically-sorted curriculum without a runtime sort.
      if (position === undefined) issue(`topic ${topic.id} needs unknown ${prerequisite}`);
      else if (position >= index) issue(`topic ${topic.id} needs later topic ${prerequisite}`);
      else {
        const required = course.topics[position];
        const requiredPhase = phases.get(required.phaseId);
        // A topic may depend on core material or its own branch, never another branch,
        // unless a goal selecting this branch also selects that branch.
        if (requiredPhase?.branch && requiredPhase.branch !== phase.branch) {
          const covered = course.goals.filter(goal => phase.branch && goal.branches.includes(phase.branch))
            .every(goal => goal.branches.includes(requiredPhase.branch as string));
          if (!covered) issue(`topic ${topic.id} depends on another branch's ${prerequisite}`);
        }
        if (required.tier === "optional" && topic.tier !== "optional") issue(`required topic ${topic.id} depends on optional ${prerequisite}`);
      }
    }
    if (topic.tier !== "optional" && topic.resources.some(resource => !resource.free)) issue(`required topic ${topic.id} lists a paid resource`);
    if (!topic.resources.some(resource => resource.free)) issue(`topic ${topic.id} has no free resource`);
  }
  if (new Set(course.projects.map(project => project.id)).size !== course.projects.length) issue("duplicate project id");
  for (const project of course.projects) {
    for (const requirement of project.requires) if (!order.has(requirement)) issue(`project ${project.id} needs unknown ${requirement}`);
    if (project.branch && !branches.has(project.branch)) issue(`project ${project.id} has unknown branch ${project.branch}`);
  }
});
export type LearningCourse = z.infer<typeof courseSchema>;

export const experienceLevelSchema = z.enum(["new", "some", "experienced"]);
export type ExperienceLevel = z.infer<typeof experienceLevelSchema>;
export const resourceFormatSchema = z.enum(["mixed", "reading", "video", "interactive"]);
export type ResourceFormat = z.infer<typeof resourceFormatSchema>;
export const topicStateSchema = z.enum(["in_progress", "completed", "known"]);
export type TopicState = z.infer<typeof topicStateSchema>;
export const projectStateSchema = z.enum(["building", "completed"]);
export type ProjectState = z.infer<typeof projectStateSchema>;
