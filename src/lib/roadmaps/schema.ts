import { z } from "zod";
import { projectLevelSchema, resourceSchema, slugSchema } from "@/lib/learning/schema";

// One model for every roadmap on the Learning roadmap tab. Compact roadmaps are
// authored in src/data/roadmaps (see parse.ts); the two in-depth guided paths in
// src/data/learning are adapted to the same shape, so there is a single simple UI.
// All text is original CareerForge content; external material is linked only.

const text = (max: number) => z.string().trim().min(1).max(max);

export const areas = ["web", "programming", "data", "ai", "cloud", "security", "mobile", "design", "product", "cs", "games"] as const;
export type RoadmapArea = (typeof areas)[number];
export const areaLabels: Record<RoadmapArea, string> = {
  web: "Web", programming: "Programming", data: "Data", ai: "AI", cloud: "Cloud & DevOps", security: "Security",
  mobile: "Mobile", design: "Design", product: "Product & leadership", cs: "Computer science", games: "Games"
};

/** core = follow in order; good = worth knowing; optional = only if you need it. */
export const topicKindSchema = z.enum(["core", "good", "optional"]);
export type RoadmapTopicKind = z.infer<typeof topicKindSchema>;

const guideSchema = z.object({
  why: z.string(),
  objectives: z.array(z.string()),
  example: z.string().nullable(),
  exercises: z.array(z.string()),
  doneWhen: z.array(z.string())
}).strict();
export type RoadmapGuide = z.infer<typeof guideSchema>;

export const roadmapTopicSchema = z.object({
  id: slugSchema,
  title: text(80),
  summary: text(420),
  kind: topicKindSchema,
  resources: z.array(resourceSchema).min(1).max(4),
  /** Another roadmap that teaches this topic in depth. */
  deepDive: slugSchema.nullable(),
  /** Shared topics mean the same thing everywhere, so completing one counts in every roadmap that uses it. */
  shared: z.boolean(),
  guide: guideSchema.nullable()
}).strict();
export type RoadmapTopic = z.infer<typeof roadmapTopicSchema>;

export const roadmapSectionSchema = z.object({
  id: slugSchema,
  title: text(60),
  goal: text(220),
  /** A small task that shows the section has been understood. */
  checkpoint: text(260).nullable(),
  topics: z.array(roadmapTopicSchema).min(1).max(16)
}).strict();
export type RoadmapSection = z.infer<typeof roadmapSectionSchema>;

export const roadmapProjectSchema = z.object({
  id: slugSchema,
  title: text(70),
  level: projectLevelSchema,
  summary: text(260),
  requirements: z.array(text(200)).min(2).max(6),
  stretch: z.array(text(200)).max(4),
  skills: z.array(text(40)).max(8)
}).strict();
export type RoadmapProject = z.infer<typeof roadmapProjectSchema>;

export const roadmapSchema = z.object({
  id: slugSchema,
  version: z.number().int().positive(),
  kind: z.enum(["role", "skill"]),
  title: text(60),
  area: z.enum(areas),
  tagline: text(160),
  inDepth: z.boolean(),
  /** Words matched against a learner's own headline and skills to suggest a roadmap. */
  keywords: z.array(text(40)).max(12),
  /** Topics of the open course catalogue that belong to this roadmap. */
  courseTopics: z.array(text(60)).max(6),
  related: z.array(slugSchema).max(6),
  /** Page for the same subject on roadmap.sh. Linked only: its licence forbids copying content. */
  roadmapSh: slugSchema.nullable(),
  tracks: z.array(z.object({ id: slugSchema, title: text(60), sections: z.array(slugSchema).min(1) }).strict()).max(8),
  defaultTrack: slugSchema.nullable(),
  sections: z.array(roadmapSectionSchema).min(2).max(16),
  projects: z.array(roadmapProjectSchema).max(20)
}).strict().superRefine((roadmap, context) => {
  const issue = (message: string) => context.addIssue({ code: "custom", message: `${roadmap.id}: ${message}` });
  const unique = (name: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) { if (seen.has(id)) issue(`duplicate ${name} ${id}`); seen.add(id); }
  };
  unique("section", roadmap.sections.map(section => section.id));
  unique("topic", roadmap.sections.flatMap(section => section.topics.map(topic => topic.id)));
  unique("project", roadmap.projects.map(project => project.id));
  for (const section of roadmap.sections) {
    if (!section.topics.some(topic => topic.kind !== "optional") && roadmap.sections.length < 3) issue(`section ${section.id} has only optional topics`);
  }
  if (roadmap.related.includes(roadmap.id)) issue("is related to itself");
});
export type Roadmap = z.infer<typeof roadmapSchema>;
