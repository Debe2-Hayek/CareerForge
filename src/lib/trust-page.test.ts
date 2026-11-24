import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { confirmedFactsSchema, factCount, formatPeriod, languageLine, methodText } from "./trust-page";
import { trustPageHandlers, type TrustAccess } from "./trust-page-handlers";
import { TrustFacts } from "../components/trust-facts";
import { ProfileCV } from "../components/profile-cv";
import type { ClaimItem } from "./claims/model";

const facts = confirmedFactsSchema.parse({
  name: "Rana Haddad", headline: "Backend developer",
  education: [{ title: "B.E. Computer Engineering", organisation: "LAU", startDate: "2016-09-01", endDate: "2020-06-01", isCurrent: false, checkedAt: "2026-11-20T10:00:00Z" }],
  experience: [], languages: [{ language: "French", level: "B2", test: "delf_dalf", score: "DELF B2", testDate: "2019-06-15", checkedAt: "2026-11-21T10:00:00Z" }],
  skills: [{ skill: "SQL", method: "check", checkedAt: "2026-10-01T00:00:00Z" }, { skill: "<b>Docker</b>", method: "reviewed", checkedAt: null }],
  projects: [{ repository: "rana/api", checkedAt: "2026-11-22T00:00:00Z" }], updatedAt: "2026-11-24T00:00:00Z"
});

test("trust page data: counted, formatted, and each method described plainly", () => {
  assert.equal(factCount(facts), 5);
  assert.equal(formatPeriod(facts.education[0]), "Sep 2016 – Jun 2020");
  assert.equal(formatPeriod({ startDate: "2024-01-01", endDate: null, isCurrent: true }), "Jan 2024 – present");
  assert.equal(languageLine(facts.languages[0]), "B2 · DELF B2");
  assert.equal(methodText("check", "2026-10-01T00:00:00Z"), "Passed a timed CareerForge skill check · Oct 2026");
  assert.equal(methodText("reviewed", null, "score report"), "Proof reviewed by CareerForge (score report)");
  assert.equal(confirmedFactsSchema.parse({ name: "X", headline: null }).skills.length, 0, "missing groups are empty");
});

test("trust facts render as text only, and an empty page says nothing is checked yet", () => {
  const html = renderToStaticMarkup(createElement(TrustFacts, { facts }));
  for (const text of ["B.E. Computer Engineering", "LAU · Sep 2016 – Jun 2020", "Proof reviewed by CareerForge (diploma or certificate) · Nov 2026", "Passed a timed CareerForge interview about this code", "&lt;b&gt;Docker"]) assert.ok(html.includes(text), text);
  assert.equal(html.includes("<b>Docker"), false);
  const empty = renderToStaticMarkup(createElement(TrustFacts, { facts: confirmedFactsSchema.parse({ name: "X", headline: null }) }));
  assert.match(empty, /Nothing has been checked yet/);
});

const ORIGIN = "http://localhost:3000";
const post = (body: unknown, origin = ORIGIN) => new Request(`${ORIGIN}/api/v1/trust-page`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("trust page switch: origin, session and input checked; on, new link and off pass through", async () => {
  const calls: [boolean, boolean][] = [];
  const access: TrustAccess = { userId: "u1", async set(enabled, newLink) { calls.push([enabled, newLink]); return { slug: enabled ? "8b0c1f4e-7d55-4c55-9a51-0b9a1d1f2c3e" : null, enabled }; } };
  const { POST } = trustPageHandlers(async () => access, () => 0);
  assert.equal((await POST(post({ enabled: true }, "https://evil.example"))).status, 403);
  assert.equal((await trustPageHandlers(async () => null, () => 0).POST(post({ enabled: true }))).status, 401);
  assert.equal((await POST(post({ enabled: "yes" }))).status, 400);
  assert.equal((await POST(post({ enabled: true, extra: 1 }))).status, 400);
  assert.equal((await POST(post({ enabled: true }))).status, 200);
  assert.equal((await POST(post({ enabled: true, newLink: true }))).status, 200);
  assert.equal((await POST(post({ enabled: false }))).status, 200);
  assert.deepEqual(calls, [[true, false], [true, true], [false, false]]);
});

const item = (key: string, kind: ClaimItem["kind"], status: ClaimItem["status"], title = "x", detail = ""): ClaimItem =>
  ({ key, kind, recordId: key.split(":")[1], skill: null, title, detail, status, note: null, date: null, method: null, evidenceCount: 1, linkCount: 0, checkAvailable: false });

test("CV marks only reviewed entries, lists languages, and prints the checked-profile link", () => {
  const profile = { name: "Rana", headline: "", location: "", bio: "", education: "", project: "", skills: [], targetRole: "" } as unknown as Parameters<typeof ProfileCV>[0]["profile"];
  const history = {
    education: [{ id: "e1", revision: "r", createdAt: "", updatedAt: "", evidenceStatus: "self_reported" as const, institution: "LAU", degree: "B.E.", startDate: "2016-09-01", endDate: "2020-06-01", isCurrent: false, gpa: null, gpaScale: null }],
    experience: [{ id: "x1", revision: "r", createdAt: "", updatedAt: "", evidenceStatus: "self_reported" as const, company: "Areeba", role: "Intern", description: "", startDate: "2024-06-01", endDate: "2024-08-01", isCurrent: false }]
  };
  const claims = [item("degree:e1", "degree", "reviewed"), item("employment:x1", "employment", "evidence_submitted"),
    item("language:l1", "language", "reviewed", "French", "B2 · Upper intermediate · DELF B2"), item("language:l2", "language", "self_declared", "<i>Arabic</i>", "Native")];
  const html = renderToStaticMarkup(createElement(ProfileCV, { profile, history, claims, trustUrl: "https://careerforge-phi.vercel.app/v/8b0c1f4e-7d55-4c55-9a51-0b9a1d1f2c3e" }));
  assert.equal((html.match(/Proof reviewed by CareerForge/g) ?? []).length, 1, "only the reviewed degree is marked");
  assert.match(html, /Entries marked ✓ had their proof reviewed/);
  assert.match(html, /Self-reported; not independently verified/, "work experience has no reviewed entry");
  assert.match(html, /French<\/strong> — B2 · Upper intermediate · DELF B2<span class="cv-check-inline"> ✓ reviewed/);
  assert.ok(html.includes("&lt;i&gt;Arabic"));
  assert.match(html, /careerforge-phi\.vercel\.app\/v\/8b0c1f4e/);
  assert.equal(renderToStaticMarkup(createElement(ProfileCV, { profile, history })).includes("cv-trust"), false, "no link unless shared");
});
