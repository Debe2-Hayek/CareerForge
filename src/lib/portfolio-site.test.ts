import assert from "node:assert/strict";
import { test } from "node:test";
import { builderStateSchema, publishedStateSchema, siteSlugSchema, siteWriteSchema, suggestSlug, toPublishedState } from "./portfolio-site";
import { portfolioSiteHandlers, type PortfolioSiteAccess } from "./portfolio-site-handlers";

const state = builderStateSchema.parse({ notes: "private rough notes", data: { name: "Sara Khoury", skills: ["React"] } });
const status = { draft: state, revision: "f6d04d98-8104-4ea6-8cfa-c488c9af2197", slug: null, isPublic: false, publishedAt: null, hasUnpublishedChanges: false };
const request = (body: unknown, origin = "http://localhost:3000") =>
  new Request("http://localhost:3000/api/v1/portfolio-site", { method: "PUT", headers: { Origin: origin }, body: JSON.stringify(body) });

test("builder state keeps every edited field, strips unknown keys and fills defaults", () => {
  const parsed = builderStateSchema.parse({
    data: { name: "A", activities: [{ company: "Club", title: "Lead", bullets: ["Ran events"] }], education: [{ school: "MU", location: "Beirut", details: "GPA 3.8" }], interests: "Chess", injected: "<script>" },
    extra: true
  });
  assert.equal(parsed.data.activities[0].company, "Club");
  assert.equal(parsed.data.education[0].details, "GPA 3.8");
  assert.equal(parsed.data.interests, "Chess");
  assert.equal("injected" in parsed.data, false);
  assert.equal("extra" in parsed, false);
  assert.equal(parsed.theme, "indigo");
  assert.equal(parsed.cvStyle, "bullet");
});

test("only safe raster data-URL photos and hex colours are accepted", () => {
  for (const photo of ["data:image/png;base64,iVBORw0KGgo=", "data:image/jpeg;base64,/9j/4AAQ"]) {
    assert.equal(builderStateSchema.safeParse({ data: {}, photo }).success, true, photo);
  }
  for (const photo of ["data:image/svg+xml;base64,PHN2Zz4=", "https://evil.example/a.png", "javascript:alert(1)", `data:image/png;base64,${"A".repeat(500_000)}`]) {
    assert.equal(builderStateSchema.safeParse({ data: {}, photo }).success, false, photo.slice(0, 40));
  }
  assert.equal(builderStateSchema.safeParse({ data: {}, custom: "#ff00aa" }).success, true);
  for (const custom of ["red; background:url(x)", "#fff", "expression(alert(1))"]) {
    assert.equal(builderStateSchema.safeParse({ data: {}, custom }).success, false, custom);
  }
});

test("published sites never include private notes or CV-only preferences", () => {
  const published = toPublishedState(state);
  assert.equal("notes" in published, false);
  assert.equal("cvStyle" in published, false);
  assert.equal(publishedStateSchema.parse(published).data.name, "Sara Khoury");
});

test("web addresses are lower-case words, 3-40 characters, not reserved", () => {
  for (const ok of ["sara-khoury", "dev42", "a-b-c"]) assert.equal(siteSlugSchema.safeParse(ok).success, true, ok);
  for (const bad of ["ab", "-sara", "sara--k", "sara_k", "sara khoury", "admin", "api", "a".repeat(41)]) {
    assert.equal(siteSlugSchema.safeParse(bad).success, false, bad);
  }
  assert.equal(siteSlugSchema.parse("Sara-Khoury"), "sara-khoury");
  assert.equal(suggestSlug("Sára Khoury!"), "sara-khoury");
  assert.equal(suggestSlug("Ab"), "");
  assert.equal(siteWriteSchema.safeParse({ action: "publish", slug: "sara", revision: "nope" }).success, false);
});

function access(overrides: Partial<PortfolioSiteAccess> = {}) {
  const calls: string[] = [];
  const value: PortfolioSiteAccess = {
    userId: "owner",
    read: async () => status,
    save: async () => { calls.push("save"); return status; },
    publish: async () => { calls.push("publish"); return { ...status, slug: "sara", isPublic: true, publishedAt: "2026-11-21T10:00:00Z" }; },
    unpublish: async () => { calls.push("unpublish"); return status; },
    ...overrides
  };
  return { value, calls };
}

test("site API blocks foreign origins and anonymous users before any work", async () => {
  let authorizations = 0;
  const handlers = portfolioSiteHandlers(async () => { authorizations++; return null; });
  assert.equal((await handlers.PUT(request({ action: "unpublish" }, "https://evil.example"))).status, 403);
  assert.equal(authorizations, 0);
  assert.equal((await handlers.PUT(request({ action: "unpublish" }))).status, 401);
  assert.equal((await handlers.GET()).status, 401);
});

test("site API validates, rate-limits and maps conflicts and taken addresses", async () => {
  const { value, calls } = access();
  const handlers = portfolioSiteHandlers(async () => value, () => 0);
  assert.equal((await handlers.PUT(request({ action: "publish", slug: "admin", revision: status.revision }))).status, 400);
  assert.match((await (await handlers.PUT(request({ action: "publish", slug: "x", revision: status.revision }))).json()).error.message, /Web address/);
  assert.equal((await handlers.PUT(request({ action: "save", state: { data: {}, photo: "javascript:x" }, revision: null }))).status, 400);
  assert.equal(calls.length, 0);
  assert.equal((await handlers.PUT(request({ action: "save", state, revision: null }))).status, 200);
  assert.equal((await handlers.PUT(request({ action: "publish", slug: "sara", revision: status.revision }))).status, 200);
  assert.deepEqual(calls, ["save", "publish"]);
  const limited = await portfolioSiteHandlers(async () => value, () => 9).PUT(request({ action: "unpublish" }));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "9");
  const conflict = portfolioSiteHandlers(async () => access({ save: async () => ({ conflict: true }) }).value, () => 0);
  assert.equal((await conflict.PUT(request({ action: "save", state, revision: null }))).status, 409);
  const taken = portfolioSiteHandlers(async () => access({ publish: async () => ({ slugTaken: true }) }).value, () => 0);
  assert.equal((await (await taken.PUT(request({ action: "publish", slug: "sara", revision: status.revision }))).json()).error.code, "SLUG_TAKEN");
});

test("site API hides internal failures and malformed stored state", async () => {
  const broken = portfolioSiteHandlers(async () => access({ read: async () => { throw new Error("relation secret does not exist"); } }).value);
  const response = await broken.GET();
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes("secret"), false);
  assert.equal((await portfolioSiteHandlers(async () => access({ read: async () => ({ unexpected: true }) }).value).GET()).status, 503);
  assert.equal((await portfolioSiteHandlers(async () => access().value).GET()).headers.get("cache-control"), "no-store");
});
