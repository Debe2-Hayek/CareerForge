import { test } from "node:test";
import assert from "node:assert/strict";
import { journey } from "./journey";
import { profileStrength } from "./profile-strength";
import type { AccountProfile } from "./account/schemas";

const empty = { name: "", headline: "", location: "", bio: "", education: "", project: "", skills: [] } as unknown as AccountProfile;
const full = { ...empty, name: "Rana Haddad", headline: "Backend developer", bio: "I build APIs and enjoy databases and clean code.", skills: ["SQL", "Python", "Docker"], project: "Orders API" } as AccountProfile;
const steps = (profile: AccountProfile, education = 1) => profileStrength(profile, { education, experience: 0, claims: null }).steps;
const base = { proofSent: 0, confirmed: 0, learningPaths: 0, applied: 0, tracked: 0 };

test("a new account starts on step 1 with the first missing profile detail as the action", () => {
  const path = journey({ ...base, strength: steps(empty, 0) });
  assert.deepEqual(path.steps.map(step => step.state), ["now", "next", "next", "next"]);
  assert.equal(path.done, 0);
  assert.equal(path.action.title, "Introduce yourself");
  assert.equal(path.action.href, "/account#account-name", "profile anchors open the profile page");
});

test("the steps follow what the account really has, and the action always points at the first open step", () => {
  const prove = journey({ ...base, strength: steps(full) });
  assert.deepEqual(prove.steps.map(step => step.state), ["done", "now", "next", "next"]);
  assert.equal(prove.action.href, "/account/verification");
  assert.match(prove.action.title, /first proof/);
  const waiting = journey({ ...base, strength: steps(full), proofSent: 1 });
  assert.equal(waiting.action.href, "/skill-checks", "while proof waits for review, a skill check helps");
  const direction = journey({ ...base, strength: steps(full), confirmed: 1 });
  assert.equal(direction.current, 2);
  assert.equal(direction.action.href, "/career-analysis");
  const apply = journey({ ...base, strength: steps(full), confirmed: 1, learningPaths: 1 });
  assert.equal(apply.action.href, "/jobs");
  assert.equal(journey({ ...base, strength: steps(full), confirmed: 1, learningPaths: 1, tracked: 2 }).action.href, "/cv-analysis");
  const all = journey({ ...base, strength: steps(full), confirmed: 1, learningPaths: 1, tracked: 2, applied: 1 });
  assert.equal(all.done, 4);
  assert.equal(all.steps.some(step => step.state === "now"), false);
  assert.match(all.action.title, /checked profile/);
});

test("later steps can be done before earlier ones; the current step is the first one still open", () => {
  const path = journey({ ...base, strength: steps(empty, 0), applied: 1, learningPaths: 1 });
  assert.deepEqual(path.steps.map(step => step.state), ["now", "next", "done", "done"]);
  assert.equal(path.current, 0);
  assert.equal(journey({ ...base, strength: null }).action.href, "/account", "unknown profile data never claims a step is done");
});
