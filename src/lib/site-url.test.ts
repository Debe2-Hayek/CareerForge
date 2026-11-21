import assert from "node:assert/strict";
import { test } from "node:test";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { DEFAULT_SITE_ORIGIN, resolveSiteOrigin, siteUrl } from "./site-url";

test("SEO URLs use one HTTPS production origin", () => {
  assert.equal(resolveSiteOrigin(), DEFAULT_SITE_ORIGIN);
  assert.equal(resolveSiteOrigin("https://careerforge.example.com"), "https://careerforge.example.com");
  for (const invalid of ["http://careerforge.example.com", "https://careerforge.example.com/path", "not-a-url"]) {
    assert.equal(resolveSiteOrigin(invalid), DEFAULT_SITE_ORIGIN);
  }
  assert.equal(siteUrl("/sitemap.xml"), `${DEFAULT_SITE_ORIGIN}/sitemap.xml`);
});

test("robots permits pages to expose noindex while excluding service endpoints", () => {
  const policy = robots();
  const rules = Array.isArray(policy.rules) ? policy.rules[0] : policy.rules;
  assert.equal(rules.allow, "/");
  assert.deepEqual(rules.disallow, ["/api/", "/auth/"]);
  assert.equal(policy.sitemap, `${DEFAULT_SITE_ORIGIN}/sitemap.xml`);
});

test("sitemap contains only the canonical indexable public route", () => {
  assert.deepEqual(sitemap().map(entry => entry.url), [DEFAULT_SITE_ORIGIN]);
});
