import assert from "node:assert/strict";
import { test } from "node:test";
import { getCourse } from "./catalog";
import { guidedLinksFor, pythonTopics, webTopics } from "./career-links";

test("every career-step link points at a topic that exists in its guided path", () => {
  for (const [course, topics] of [["python", pythonTopics], ["web-development", webTopics]] as const) {
    const ids = new Set(getCourse(course)!.topics.map(topic => topic.id));
    for (const [step, topic] of Object.entries(topics)) assert.ok(ids.has(topic), `${course}: ${step} -> ${topic}`);
  }
});

test("career tracks link web steps to the web path and shared steps to the track's path", () => {
  const frontend = guidedLinksFor("frontend");
  assert.match(frontend.react.href, /^\/learning-roadmap\/web-development\?goal=frontend&.*topic=react-components$/);
  assert.match(frontend.git.href, /web-development/);
  const data = guidedLinksFor("data-analyst");
  assert.match(data.sql.href, /^\/learning-roadmap\/python\?goal=data&/);
  assert.match(data.css.href, /web-development\?goal=foundations/, "web-only steps use the web path even for data tracks");
  assert.match(guidedLinksFor(undefined).javascript.label, /JavaScript & Web/);
});
