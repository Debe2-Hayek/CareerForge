import { test } from "node:test";
import assert from "node:assert/strict";
import { publicPortfolioGuard } from "./portfolio-public-guard";
const slug = "f6d04d98-8104-4ea6-8cfa-c488c9af2197";
test("public guard returns identical uncached 404s for private/unknown/malformed paths", async () => {
  const privatePage = await publicPortfolioGuard(`/p/${slug}`, async () => false);
  const malformed = await publicPortfolioGuard("/p/not-a-slug", async () => { throw new Error("must not read"); });
  assert.equal(privatePage?.status, 404);
  assert.equal(malformed?.status, 404);
  assert.equal(await privatePage?.text(), await malformed?.text());
  assert.equal(privatePage?.headers.get("cache-control"), "private, no-store");
});
test("public guard permits only published snapshots, fails closed and skips other routes", async () => {
  assert.equal(await publicPortfolioGuard(`/p/${slug}`, async () => true), null);
  assert.equal((await publicPortfolioGuard(`/p/${slug}`, async () => { throw new Error("secret"); }))?.status, 503);
  assert.equal(await publicPortfolioGuard("/portfolio", async () => { throw new Error("must not read"); }), null);
});
test("website guard 404s unknown, unpublished and malformed /u addresses identically and fails closed", async () => {
  const { publicSiteGuard } = await import("./portfolio-public-guard");
  const unpublished = await publicSiteGuard("/u/sara-khoury", async () => false);
  const malformed = await publicSiteGuard("/u/Not_A Slug", async () => { throw new Error("must not read"); });
  const tooShort = await publicSiteGuard("/u/ab", async () => { throw new Error("must not read"); });
  assert.equal(unpublished?.status, 404);
  assert.equal(malformed?.status, 404);
  assert.equal(tooShort?.status, 404);
  assert.equal(await unpublished?.text(), await malformed?.text());
  assert.equal(unpublished?.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.equal(await publicSiteGuard("/u/sara-khoury", async () => true), null);
  assert.equal((await publicSiteGuard("/u/sara-khoury", async () => { throw new Error("secret"); }))?.status, 503);
  assert.equal(await publicSiteGuard("/documents", async () => { throw new Error("must not read"); }), null);
});
