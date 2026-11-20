import { z } from "zod";
import roadmapDocument from "@/data/roadmap.json";

export const roadmapStatusSchema = z.enum(["done", "in-progress", "planned", "upstream-new"]);
export const roadmapHorizonSchema = z.enum(["now", "next", "later"]);

const proofSchema = z.object({
  revision: z.string().min(7).max(40).nullable(),
  verifiedAt: z.iso.datetime({ offset: true }).nullable(),
  metrics: z.array(z.string().min(1).max(160)).max(12)
}).strict();

export const roadmapNodeSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(100),
  category: z.string().min(1).max(80),
  trackId: z.string().regex(/^[a-z0-9-]+$/),
  status: roadmapStatusSchema,
  horizon: roadmapHorizonSchema,
  acceptsFeedback: z.boolean(),
  summary: z.string().min(1).max(320),
  // Compatibility aliases keep the original UI contract while exposing the
  // cost-first schema names requested for external roadmap tooling.
  uxRationale: z.string().min(1).max(320),
  uxImpactScore: z.number().int().min(0).max(100),
  creativeHook: z.string().min(1).max(240),
  linkedFiles: z.array(z.string().min(1).max(220)).max(24),
  upstreamUrl: z.url().startsWith("https://roadmap.sh/"),
  upstreamSourceUrl: z.url().startsWith("https://roadmap.sh/"),
  proof: proofSchema
}).strict();

const roadmapTrackSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(80),
  description: z.string().min(1).max(240),
  upstreamPath: z.string().regex(/^roadmaps\/[a-z0-9-]+\/content$/),
  sourceUrl: z.url().startsWith("https://roadmap.sh/"),
  upstreamTopicIds: z.array(z.string().regex(/^[a-z0-9-]+$/))
}).strict();

const selfHealedEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(100),
  signal: z.string().min(1).max(240),
  resolution: z.string().min(1).max(320),
  detectedAt: z.iso.datetime({ offset: true }),
  resolvedAt: z.iso.datetime({ offset: true }),
  linkedFiles: z.array(z.string().min(1).max(220)).max(24),
  revision: z.string().min(7).max(40)
}).strict();

export const productRoadmapSchema = z.object({
  $schema: z.string().optional(),
  version: z.literal(1),
  updatedAt: z.iso.datetime({ offset: true }),
  codebase: z.object({
    revision: z.string().regex(/^[0-9a-f]{7,40}$/),
    scannedAt: z.iso.datetime({ offset: true })
  }).strict(),
  upstream: z.object({
    repository: z.literal("nilbuild/developer-roadmap"),
    ref: z.string().min(1),
    sourceRevision: z.string(),
    syncedAt: z.iso.datetime({ offset: true }).nullable()
  }).strict(),
  tracks: z.array(roadmapTrackSchema).min(1),
  nodes: z.array(roadmapNodeSchema).min(1),
  selfHealedLog: z.array(selfHealedEntrySchema)
}).strict().superRefine((roadmap, context) => {
  const trackIds = new Set(roadmap.tracks.map(track => track.id));
  const nodeIds = new Set<string>();
  for (const node of roadmap.nodes) {
    if (!trackIds.has(node.trackId)) context.addIssue({ code: "custom", path: ["nodes", node.id, "trackId"], message: "Node references an unknown track" });
    if (nodeIds.has(node.id)) context.addIssue({ code: "custom", path: ["nodes", node.id], message: "Node ids must be unique" });
    nodeIds.add(node.id);
  }
});

export type ProductRoadmap = z.infer<typeof productRoadmapSchema>;
export type ProductRoadmapNode = z.infer<typeof roadmapNodeSchema>;
export type RoadmapStatus = z.infer<typeof roadmapStatusSchema>;
export type RoadmapHorizon = z.infer<typeof roadmapHorizonSchema>;
export type ProductRoadmapView = Pick<ProductRoadmap, "updatedAt" | "upstream" | "nodes" | "selfHealedLog"> & {
  tracks: Array<Omit<ProductRoadmap["tracks"][number], "upstreamTopicIds">>;
};

export const productRoadmap: ProductRoadmap = productRoadmapSchema.parse(roadmapDocument);

export function toProductRoadmapView(roadmap: ProductRoadmap): ProductRoadmapView {
  return {
    updatedAt: roadmap.updatedAt,
    upstream: roadmap.upstream,
    tracks: roadmap.tracks.map(({ upstreamTopicIds: _upstreamTopicIds, ...track }) => track),
    nodes: roadmap.nodes,
    selfHealedLog: roadmap.selfHealedLog
  };
}

export function roadmapStats(roadmap: ProductRoadmap) {
  const counts: Record<RoadmapStatus, number> = { done: 0, "in-progress": 0, planned: 0, "upstream-new": 0 };
  for (const node of roadmap.nodes) counts[node.status] += 1;
  return {
    ...counts,
    total: roadmap.nodes.length,
    completion: Math.round((counts.done / roadmap.nodes.length) * 100)
  };
}
