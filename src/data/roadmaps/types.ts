import type { RoadmapMeta } from "@/lib/roadmaps/parse";

/** A roadmap's details and its compact text (format: src/lib/roadmaps/parse.ts). */
export type RoadmapSource = [meta: RoadmapMeta, body: string];
