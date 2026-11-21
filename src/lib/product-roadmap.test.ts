import assert from "node:assert/strict";
import { test } from "node:test";
import { productRoadmap, productRoadmapSchema, roadmapStats } from "./product-roadmap";

test("product roadmap is valid, internally linked and honestly statused", () => {
  assert.equal(productRoadmapSchema.safeParse(productRoadmap).success, true);
  const ids = productRoadmap.nodes.map(node => node.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(productRoadmap.nodes.some(node => node.status === "done"));
  assert.ok(productRoadmap.nodes.some(node => node.status === "planned"));
  assert.ok(productRoadmap.nodes.filter(node => node.status === "done").every(node => node.linkedFiles.length > 0 && node.proof.revision));
  assert.ok(productRoadmap.nodes.every(node => node.uxRationale && node.upstreamUrl === node.upstreamSourceUrl));
  assert.ok(productRoadmap.nodes.every(node => node.acceptsFeedback === (node.status !== "upstream-new")));
});

test("roadmap stats count every status without inflating completion", () => {
  const stats = roadmapStats(productRoadmap);
  assert.equal(stats.total, Object.values(productRoadmap.nodes).length);
  assert.equal(stats.total, stats.done + stats["in-progress"] + stats.planned + stats["upstream-new"]);
  assert.equal(stats.completion, Math.round((stats.done / stats.total) * 100));
});
