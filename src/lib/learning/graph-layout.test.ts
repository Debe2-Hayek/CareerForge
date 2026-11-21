import assert from "node:assert/strict";
import { test } from "node:test";
import { courses, getCourse } from "./catalog";
import { ancestorsOf, descendantsOf, layoutRoadmap } from "./graph-layout";

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const course of courses) {
  test(`${course.id}: every topic is placed once, nothing overlaps and positions are stable`, () => {
    const layout = layoutRoadmap(course);
    const topicNodes = layout.nodes.filter(node => node.kind === "topic");
    assert.equal(topicNodes.length, course.topics.length);
    assert.equal(new Set(layout.nodes.map(node => node.id)).size, layout.nodes.length, "node ids are unique");
    for (let i = 0; i < layout.nodes.length; i++) for (let j = i + 1; j < layout.nodes.length; j++) {
      assert.equal(overlaps(layout.nodes[i], layout.nodes[j]), false, `${layout.nodes[i].id} overlaps ${layout.nodes[j].id}`);
    }
    assert.deepEqual(layoutRoadmap(course), layout, "layout is deterministic");
  });

  test(`${course.id}: every node hangs off the title through spine and member edges`, () => {
    const layout = layoutRoadmap(course);
    const ids = new Set(layout.nodes.map(node => node.id));
    for (const edge of layout.edges) assert.ok(ids.has(edge.source) && ids.has(edge.target), edge.id);
    const next = new Map<string, string[]>();
    for (const edge of layout.edges.filter(edge => edge.kind !== "prerequisite")) next.set(edge.source, [...(next.get(edge.source) ?? []), edge.target]);
    const seen = new Set(["title"]);
    const queue = ["title"];
    while (queue.length) for (const target of next.get(queue.shift() as string) ?? []) if (!seen.has(target)) { seen.add(target); queue.push(target); }
    assert.equal(seen.size, layout.nodes.length, `unreachable: ${[...ids].filter(id => !seen.has(id)).join(", ")}`);
    const memberEdges = layout.edges.filter(edge => edge.kind === "member");
    for (const edge of memberEdges) {
      const topic = course.topics.find(item => item.id === edge.target)!;
      assert.equal(edge.source, `phase:${topic.phaseId}`, `${topic.id} hangs off its own phase`);
    }
    const prerequisiteCount = course.topics.reduce((sum, topic) => sum + topic.prerequisites.length, 0);
    assert.equal(layout.edges.filter(edge => edge.kind === "prerequisite").length, prerequisiteCount);
  });
}

test("specialisations fork side by side and rejoin at the career phase", () => {
  const python = getCourse("python")!;
  const layout = layoutRoadmap(python);
  const branchPhases = layout.nodes.filter(node => node.kind === "phase" && node.branch);
  assert.equal(branchPhases.length, 4);
  assert.equal(new Set(branchPhases.map(node => node.y)).size, 1, "branch heads share one row");
  assert.equal(layout.edges.filter(edge => edge.target === "phase:career").length, 4, "every branch rejoins the career phase");
  const spineX = layout.nodes.filter(node => node.kind === "phase" && !node.branch).map(node => node.x + node.width / 2);
  assert.ok(spineX.every(x => x === 0), "core phases sit on one vertical spine");
});

test("prerequisite chains are transitive in both directions", () => {
  const python = getCourse("python")!;
  const before = ancestorsOf(python, "decorators");
  assert.ok(before.has("lambdas-closures") && before.has("functions") && before.has("python-setup"));
  assert.equal(before.has("decorators"), false);
  const after = descendantsOf(python, "functions");
  assert.ok(after.has("decorators") && after.has("fastapi"));
  assert.equal(after.has("how-programs-work"), false);
});
