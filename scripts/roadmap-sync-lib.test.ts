import assert from "node:assert/strict";
import { test } from "node:test";
import { productRoadmap } from "../src/lib/product-roadmap";
import {
  cachedUpstreamSnapshot,
  completionEvidenceByNode,
  mergeRoadmapSnapshots,
  titleFromTopicId,
  topicsByTrack
} from "./roadmap-sync-lib";

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
  assert.equal(discovery?.acceptsFeedback, false);
  assert.equal(discovery?.upstreamUrl, "https://roadmap.sh/full-stack");
  assert.ok(discovery?.uxRationale);
  assert.equal(discovery?.proof.metrics[0].includes("not an implemented"), true);
});

test("the embedded topic cache reproduces the last known-good snapshot", () => {
  const cached = cachedUpstreamSnapshot(productRoadmap);
  const topics = topicsByTrack(productRoadmap, cached.entries);
  for (const track of productRoadmap.tracks) {
    assert.deepEqual(topics[track.id], [...track.upstreamTopicIds].sort());
  }
  assert.equal(cached.treeRevision, productRoadmap.upstream.sourceRevision);
  assert.equal(cached.committedAt, productRoadmap.upstream.syncedAt);
});

test("linked files never complete a node without an explicit matching commit marker", () => {
  const node = productRoadmap.nodes.find(candidate => candidate.id === "live-job-source");
  assert.ok(node);
  const commit = {
    revision: "abcdef0123456789abcdef0123456789abcdef01",
    committedAt: "2026-11-20T10:00:00.000Z",
    subject: "Implement a source adapter",
    changedFiles: [...node.linkedFiles]
  };
  assert.deepEqual(completionEvidenceByNode(productRoadmap, [commit], node.linkedFiles), {});
  assert.deepEqual(completionEvidenceByNode(productRoadmap, [{
    ...commit,
    subject: "Finish source adapter [roadmap:live-job-source]"
  }], []), {});
});

test("an explicit marker plus complete linked-file evidence safely marks a node done", () => {
  const base = structuredClone(productRoadmap);
  const node = base.nodes.find(candidate => candidate.id === "live-job-source");
  assert.ok(node);
  const commit = {
    revision: "abcdef0123456789abcdef0123456789abcdef01",
    committedAt: "2026-11-20T10:00:00.000Z",
    subject: "Finish source adapter [roadmap:live-job-source]",
    changedFiles: [...node.linkedFiles]
  };
  const evidence = completionEvidenceByNode(base, [commit], node.linkedFiles);
  const merged = mergeRoadmapSnapshots(base, cachedUpstreamSnapshot(base), {
    revision: commit.revision,
    committedAt: commit.committedAt,
    evidence
  });
  const completed = merged.nodes.find(candidate => candidate.id === node.id);
  assert.equal(completed?.status, "done");
  assert.equal(completed?.proof.revision, commit.revision);
  assert.equal(completed?.proof.verifiedAt, commit.committedAt);
  assert.ok(completed?.proof.metrics.some(metric => metric.includes("explicit roadmap commit marker")));
});
