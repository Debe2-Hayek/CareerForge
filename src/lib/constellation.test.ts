import { test } from "node:test";
import assert from "node:assert/strict";
import { sky, shortLabel, SLOTS } from "./constellation";

const item = (kind: "degree" | "employment" | "skill" | "language", title: string, status: string) => ({ kind, title, status }) as Parameters<typeof sky>[0][number];

test("an empty profile shows only empty places to fill", () => {
  const result = sky([], 0);
  assert.equal(result.stars.length, 3);
  assert.ok(result.stars.every(star => star.state === "empty" && star.short === ""));
  assert.deepEqual([result.checked, result.pending, result.stated], [0, 0, 0]);
});

test("checked facts come first, then facts in review, then stated ones", () => {
  const result = sky([item("skill", "SQL", "unverified"), item("degree", "BSc Computing", "evidence_submitted"), item("employment", "Acme", "reviewed"), item("language", "French", "verified")], 55);
  assert.deepEqual(result.stars.map(star => star.state), ["checked", "checked", "pending", "stated", "empty", "empty", "empty"]);
  assert.deepEqual([result.checked, result.pending, result.stated, result.percent], [2, 1, 1, 55]);
  assert.equal(result.stars[2].label, "Degree: BSc Computing");
});

test("stars spread across the sky and stay on the canvas", () => {
  const result = sky([item("skill", "A", "unverified"), item("skill", "B", "unverified")], 10);
  assert.deepEqual([result.stars[0].x, result.stars[0].y], SLOTS[0]);
  assert.deepEqual([result.stars.at(-1)!.x, result.stars.at(-1)!.y], SLOTS.at(-1));
  const places = new Set(result.stars.map(star => `${star.x},${star.y}`));
  assert.equal(places.size, result.stars.length);
});

test("a long profile is capped so the sky never overflows", () => {
  const many = Array.from({ length: 30 }, (_, index) => item("skill", `Skill ${index}`, "unverified"));
  const result = sky(many, 250);
  assert.ok(result.stars.length <= SLOTS.length);
  assert.equal(result.stated, 30);
  assert.equal(result.percent, 100);
});

test("labels are short", () => {
  assert.equal(shortLabel("Skill: Docker"), "Docker");
  assert.equal(shortLabel("Degree: B.E. Computer Engineering"), "B.E. Computer E…");
  assert.equal(shortLabel("Work: A: B"), "A: B");
});
