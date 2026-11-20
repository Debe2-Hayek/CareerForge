import type { ProductRoadmap, ProductRoadmapNode } from "../src/lib/product-roadmap";

export type UpstreamEntry = { path: string; type: "blob" | "tree"; sha?: string };
export type UpstreamSnapshot = { treeRevision: string; committedAt: string; entries: UpstreamEntry[] };
export type CodebaseSnapshot = { revision: string; committedAt: string; evidence: Record<string, { revision: string; committedAt: string }> };

const topicPattern = /^([a-z0-9][a-z0-9-]*)(?:@[^/]+)?\.md$/;

export function titleFromTopicId(id: string) {
  const labels: Record<string, string> = { api: "API", apis: "APIs", css: "CSS", git: "Git", html: "HTML", jwt: "JWT", npm: "npm", sql: "SQL", ux: "UX" };
  return id.split("-").filter(Boolean).map(word => labels[word] ?? word[0].toUpperCase() + word.slice(1)).join(" ");
}

export function topicsByTrack(roadmap: ProductRoadmap, entries: UpstreamEntry[]) {
  return Object.fromEntries(roadmap.tracks.map(track => {
    const prefix = `${track.upstreamPath}/`;
    const topics = entries.flatMap(entry => {
      if (entry.type !== "blob" || !entry.path.startsWith(prefix)) return [];
      const remainder = entry.path.slice(prefix.length);
      if (remainder.includes("/")) return [];
      const match = topicPattern.exec(remainder);
      return match ? [match[1]] : [];
    });
    return [track.id, [...new Set(topics)].sort()];
  }));
}

function upstreamNode(track: ProductRoadmap["tracks"][number], topicId: string): ProductRoadmapNode {
  return {
    id: `upstream-${track.id}-${topicId}`,
    title: titleFromTopicId(topicId),
    category: track.title,
    trackId: track.id,
    status: "upstream-new",
    horizon: "later",
    summary: `roadmap.sh added ${titleFromTopicId(topicId)} to its ${track.title} source. CareerForge has not reviewed or scheduled it yet.`,
    uxImpactScore: 50,
    creativeHook: "A signal from the wider practice, waiting for product-context review.",
    linkedFiles: [],
    upstreamSourceUrl: track.sourceUrl,
    proof: { revision: null, verifiedAt: null, metrics: ["Upstream discovery only; not an implemented CareerForge feature"] }
  };
}

export function mergeRoadmapSnapshots(roadmap: ProductRoadmap, upstream: UpstreamSnapshot, codebase: CodebaseSnapshot): ProductRoadmap {
  const topics = topicsByTrack(roadmap, upstream.entries);
  const knownNodes = new Set(roadmap.nodes.map(node => node.id));
  const discoveries: ProductRoadmapNode[] = [];
  const tracks = roadmap.tracks.map(track => {
    const current = topics[track.id] ?? [];
    // An empty list is the first-run baseline. It must not turn the whole upstream
    // catalogue into hundreds of fake product commitments.
    if (track.upstreamTopicIds.length) {
      const previous = new Set(track.upstreamTopicIds);
      for (const topic of current) {
        const id = `upstream-${track.id}-${topic}`;
        if (!previous.has(topic) && !knownNodes.has(id)) discoveries.push(upstreamNode(track, topic));
      }
    }
    return { ...track, upstreamTopicIds: current };
  });
  const nodes = [...roadmap.nodes, ...discoveries].map(node => {
    const evidence = codebase.evidence[node.id];
    if (!evidence) return node;
    return { ...node, proof: { ...node.proof, revision: evidence.revision, verifiedAt: evidence.committedAt } };
  });
  const updatedAt = [roadmap.updatedAt, upstream.committedAt, codebase.committedAt].sort().at(-1) ?? roadmap.updatedAt;
  return {
    ...roadmap,
    updatedAt,
    codebase: { revision: codebase.revision, scannedAt: codebase.committedAt },
    upstream: { ...roadmap.upstream, sourceRevision: upstream.treeRevision, syncedAt: upstream.committedAt },
    tracks,
    nodes
  };
}
