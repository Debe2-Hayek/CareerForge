import assert from "node:assert/strict";
import test from "node:test";
import { assertExpectedSupabaseProject, resolveAdminDatabaseUrl } from "./database-url.mjs";

test("database administration prefers DIRECT_URL over a pooled or stale DATABASE_URL", () => {
  assert.equal(resolveAdminDatabaseUrl({ DIRECT_URL: "postgresql://direct", DATABASE_URL: "postgresql://pooled" }), "postgresql://direct");
  assert.equal(resolveAdminDatabaseUrl({ DATABASE_URL: "postgresql://fallback" }), "postgresql://fallback");
  assert.throws(() => resolveAdminDatabaseUrl({}), /MISSING_DATABASE_URL/);
});

test("an expected Supabase project accepts direct and pooler URLs and rejects another project", () => {
  const project = "abcdefghijklmnopqrst";
  assert.doesNotThrow(() => assertExpectedSupabaseProject(`postgresql://postgres@db.${project}.supabase.co:5432/postgres`, project));
  assert.doesNotThrow(() => assertExpectedSupabaseProject(`postgresql://postgres.${project}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`, project));
  assert.throws(
    () => resolveAdminDatabaseUrl({ DIRECT_URL: "postgresql://postgres@db.zyxwvutsrqponmlkjihg.supabase.co/postgres", EXPECTED_SUPABASE_PROJECT_REF: project }),
    /DATABASE_PROJECT_MISMATCH/
  );
});
