import assert from "node:assert/strict";
import { test } from "node:test";
import { productRoadmap } from "../src/lib/product-roadmap";
import { mergeRoadmapSnapshots, titleFromTopicId, topicsByTrack } from "./roadmap-sync-lib";

test("topic extraction is bounded to each configured canonical content directory", () => {
  const topics = topicsByTrack(productRoadmap, [
    { type: "blob", path: "roadmaps/full-stack/content/react@abc.md" },
    { type: "blob", path: "roadmaps/full-stack/content/restful-apis@def.md" },
    { type: "blob", path: "roadmaps/full-stack/content/nested/ignored.md" },
    { type: "blob", path: "roadmaps/unknown/content/not-imported.md" }
  ]);
  assert.deepEqual(topics["full-stack"], ["react", "restful-apis"]);
  assert.equal(titleFromTopicId("restful-apis"), "Restful APIs");
});

test("first sync establishes a baseline and later sync flags only new topics", () => {
  const base = structuredClone(productRoadmap);
  const first = mergeRoadmapSnapshots(base, {
    treeRevision: "upstream-one",
    committedAt: "2026-11-18T00:00:00.000Z",
    entries: [{ type: "blob", path: "roadmaps/full-stack/content/react@one.md" }]
  }, { revision: "1234567", committedAt: "2026-11-17T00:00:00.000Z", evidence: {} });
  assert.equal(first.nodes.some(node => node.id === "upstream-full-stack-react"), false);
  const second = mergeRoadmapSnapshots(first, {
    treeRevision: "upstream-two",
    committedAt: "2026-11-19T00:00:00.000Z",
    entries: [
      { type: "blob", path: "roadmaps/full-stack/content/react@two.md" },
      { type: "blob", path: "roadmaps/full-stack/content-observability@one.md" },
      { type: "blob", path: "roadmaps/full-stack/content/observability@one.md" }
    ]
  }, { revision: "7654321", committedAt: "2026-11-19T00:00:00.000Z", evidence: {} });
  const discovery = second.nodes.find(node => node.id === "upstream-full-stack-observability");
  assert.equal(discovery?.status, "upstream-new");
  assert.equal(discovery?.proof.metrics[0].includes("not an implemented"), true);
});
