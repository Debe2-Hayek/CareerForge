import { library, publishers } from "@/data/roadmaps/sources";
import type { LearningResource } from "@/lib/learning/schema";
import type { Roadmap, RoadmapArea, RoadmapProject, RoadmapSection, RoadmapTopic, RoadmapTopicKind } from "./schema";

// Compact roadmap text -> structured roadmap. One line per item keeps dozens of
// roadmaps readable, reviewable and easy to extend:
//
//   ## Section title | goal | checkpoint task | default resources
//   - Core topic | summary | resources        (+ good to know, ? optional)
//   - @shared-topic
//   * Project title | level | summary | requirement; requirement | skill, skill
//
// Resources are comma separated: a library key, "publisher:path", or
// "map:roadmap-id" for a deep-dive link. Any mistake throws while loading, so it
// fails tests and builds instead of reaching learners.

export type RoadmapMeta = {
  id: string;
  kind: "role" | "skill";
  title: string;
  area: RoadmapArea;
  tagline: string;
  keywords: string[];
  courseTopics?: string[];
  related: string[];
  roadmapSh?: string;
  version?: number;
};

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/c\+\+/g, "cpp")
    .replace(/c#/g, "csharp")
    .replace(/&/g, " and ")
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

const fields = (line: string) => line.split("|").map(part => part.trim());

type ParsedResources = { resources: LearningResource[]; deepDive: string | null };

export function parseResources(spec: string | undefined, title: string, where: string): ParsedResources {
  const resources: LearningResource[] = [];
  let deepDive: string | null = null;
  for (const token of (spec ?? "").split(", ").map(part => part.trim()).filter(Boolean)) {
    const known = library[token];
    if (known) { resources.push({ ...known, free: true, language: "en" }); continue; }
    const separator = token.indexOf(":");
    const prefix = token.slice(0, separator);
    const path = token.slice(separator + 1);
    if (separator > 0 && prefix === "map") { deepDive = path; continue; }
    const publisher = separator > 0 ? publishers[prefix] : undefined;
    if (!publisher) throw new Error(`${where}: unknown resource "${token}"`);
    const url = new URL(publisher.base + path);
    resources.push({ title, provider: publisher.name || url.hostname.replace(/^www\./, ""), url: url.href, type: publisher.type, free: true, language: "en" });
  }
  return { resources, deepDive };
}

type SharedTopic = Pick<RoadmapTopic, "id" | "title" | "summary" | "resources" | "deepDive">;

export function parseSharedTopics(source: string): Map<string, SharedTopic> {
  const topics = new Map<string, SharedTopic>();
  for (const line of source.split("\n").map(value => value.trim()).filter(Boolean)) {
    const match = /^([a-z0-9-]+) = (.+)$/.exec(line);
    if (!match) throw new Error(`Malformed shared topic: ${line}`);
    const [, id, rest] = match;
    const [title, summary, spec] = fields(rest);
    if (!summary || !spec) throw new Error(`Shared topic ${id} needs a summary and resources`);
    if (topics.has(id)) throw new Error(`Duplicate shared topic ${id}`);
    topics.set(id, { id, title, summary, ...parseResources(spec, title, `shared ${id}`) });
  }
  return topics;
}

const kinds: Record<string, RoadmapTopicKind> = { "-": "core", "+": "good", "?": "optional" };

export function parseRoadmap(meta: RoadmapMeta, body: string, shared: Map<string, SharedTopic>): Roadmap {
  const sections: RoadmapSection[] = [];
  const projects: RoadmapProject[] = [];
  let defaults: LearningResource[] = [];
  for (const line of body.split("\n").map(value => value.trim()).filter(Boolean)) {
    const where = `${meta.id}: ${line.slice(0, 60)}`;
    if (line.startsWith("## ")) {
      const [title, goal, checkpoint, spec] = fields(line.slice(3));
      if (!goal) throw new Error(`${where}: a section needs a goal`);
      defaults = parseResources(spec, title, where).resources;
      sections.push({ id: slugify(title), title, goal, checkpoint: checkpoint || null, topics: [] });
      continue;
    }
    if (line.startsWith("* ")) {
      const [title, level, summary, requirements, skills] = fields(line.slice(2));
      if (!requirements) throw new Error(`${where}: a project needs requirements`);
      projects.push({
        id: slugify(title), title, level: level as RoadmapProject["level"], summary,
        requirements: requirements.split("; ").map(part => part.trim()),
        stretch: [], skills: (skills ?? "").split(", ").map(part => part.trim()).filter(Boolean)
      });
      continue;
    }
    const kind = kinds[line[0]];
    const section = sections.at(-1);
    if (!kind || line[1] !== " " || !section) throw new Error(`${where}: unrecognised line`);
    const content = line.slice(2).trim();
    if (content.startsWith("@")) {
      const topic = shared.get(content.slice(1));
      if (!topic) throw new Error(`${where}: unknown shared topic`);
      section.topics.push({ ...topic, kind, shared: true, guide: null, deepDive: topic.deepDive === meta.id ? null : topic.deepDive });
      continue;
    }
    const [title, summary, spec] = fields(content);
    if (!summary) throw new Error(`${where}: a topic needs a summary`);
    const parsed = parseResources(spec, title, where);
    const resources = parsed.resources.length ? parsed.resources : defaults;
    if (!resources.length) throw new Error(`${where}: no resource and no section default`);
    section.topics.push({ id: slugify(title), title, summary, kind, resources, deepDive: parsed.deepDive, shared: false, guide: null });
  }
  return {
    id: meta.id, version: meta.version ?? 1, kind: meta.kind, title: meta.title, area: meta.area, tagline: meta.tagline, inDepth: false,
    keywords: meta.keywords, courseTopics: meta.courseTopics ?? [], related: meta.related, roadmapSh: meta.roadmapSh ?? null,
    tracks: [], defaultTrack: null, sections, projects
  };
}
