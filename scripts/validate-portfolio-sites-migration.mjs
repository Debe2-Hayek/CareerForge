// Applies the portfolio-sites migration (if not yet applied) inside a
// transaction that is ALWAYS rolled back, then verifies ownership isolation,
// optimistic concurrency, server-derived snapshots, unique addresses,
// unpublishing and anonymous public reads. Nothing is persisted.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import nextEnv from "@next/env";
import { Client } from "pg";
import { resolveAdminDatabaseUrl } from "./database-url.mjs";

nextEnv.loadEnvConfig(process.cwd());
const client = new Client({ connectionString: resolveAdminDatabaseUrl(), connectionTimeoutMillis: 15000, statement_timeout: 30000 });
const a = randomUUID(), b = randomUUID();
const draft = (name, notes = "private notes") => JSON.stringify({ notes, data: { name }, theme: "indigo", mode: "dark", cvPhoto: true, cvStyle: "bullet" });

async function rejects(sql, params, code) {
  await client.query("savepoint attempt");
  try { await assert.rejects(client.query(sql, params), error => error.code === code, `expected ${code}: ${sql}`); }
  finally { await client.query("rollback to savepoint attempt"); }
}
async function as(role, id) {
  await client.query("reset role");
  if (id) await client.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)", [id, JSON.stringify({ sub: id, role })]);
  await client.query(`set local role ${role}`);
}
const call = async (sql, params = []) => (await client.query(sql, params)).rows[0].result;

try {
  await client.connect();
  await client.query("begin");
  if (!(await client.query("select to_regclass('public.portfolio_sites') is not null as present")).rows[0].present) {
    await client.query((await readFile(new URL("../supabase/migrations/202611220001_portfolio_sites.sql", import.meta.url), "utf8")).replace(/\r\n/g, "\n"));
  }
  await client.query("insert into auth.users (id, email) values ($1, $2), ($3, $4)", [a, `${a}@careerforge.invalid`, b, `${b}@careerforge.invalid`]);
  const slugA = `test-${a.slice(0, 8)}`;

  await as("authenticated", a);
  await rejects("insert into public.portfolio_sites (user_id, draft) values ($1, '{}')", [a], "42501");
  assert.equal((await call("select public.get_portfolio_site() as result")).draft, null);
  assert.deepEqual(await call("select public.save_portfolio_site($1::jsonb, $2) as result", [draft("Owner A"), randomUUID()]), { conflict: true }, "first save must not claim a revision");
  const first = await call("select public.save_portfolio_site($1::jsonb, null) as result", [draft("Owner A")]);
  assert.equal(first.draft.data.name, "Owner A");
  assert.deepEqual(await call("select public.save_portfolio_site($1::jsonb, null) as result", [draft("Stale")]), { conflict: true });
  const second = await call("select public.save_portfolio_site($1::jsonb, $2) as result", [draft("Owner A v2"), first.revision]);
  assert.notEqual(second.revision, first.revision);
  await rejects("select public.save_portfolio_site('[]'::jsonb, $1)", [second.revision], "22023");

  assert.deepEqual(await call("select public.publish_portfolio_site($1, $2) as result", [slugA, first.revision]), { conflict: true }, "publishing needs the current revision");
  await rejects("select public.publish_portfolio_site('Bad Slug!', $1)", [second.revision], "22023");
  const published = await call("select public.publish_portfolio_site($1, $2) as result", [slugA, second.revision]);
  assert.equal(published.isPublic, true);
  assert.equal(published.slug, slugA);
  assert.equal(published.hasUnpublishedChanges, false);
  const changed = await call("select public.save_portfolio_site($1::jsonb, $2) as result", [draft("Owner A v3"), second.revision]);
  assert.equal(changed.hasUnpublishedChanges, true, "edits after publishing are flagged");

  await as("anon");
  const site = await call("select public.get_public_portfolio_site($1) as result", [slugA.toUpperCase()]);
  assert.equal(site.site.data.name, "Owner A v2", "public sees the published snapshot, not later drafts");
  assert.equal(site.site.notes, undefined, "private notes are never published");
  assert.equal(site.site.cvStyle, undefined);
  await rejects("select * from public.portfolio_sites", [], "42501");
  await rejects("select public.get_portfolio_site()", [], "42501");

  await as("authenticated", b);
  assert.equal((await client.query("select * from public.portfolio_sites")).rowCount, 0, "owners cannot see each other");
  assert.equal((await call("select public.get_portfolio_site() as result")).draft, null);
  const bSave = await call("select public.save_portfolio_site($1::jsonb, null) as result", [draft("Owner B")]);
  assert.deepEqual(await call("select public.publish_portfolio_site($1, $2) as result", [slugA, bSave.revision]), { slugTaken: true }, "addresses are unique");
  await rejects("update public.portfolio_sites set is_public = true", [], "42501");

  await as("authenticated", a);
  const off = await call("select public.unpublish_portfolio_site() as result");
  assert.equal(off.isPublic, false);
  assert.equal(off.slug, slugA, "the address stays reserved for its owner");
  await as("anon");
  assert.equal(await call("select public.get_public_portfolio_site($1) as result", [slugA]), null, "unpublished sites disappear");

  await client.query("reset role");
  await client.query("delete from auth.users where id = $1", [a]);
  assert.equal((await client.query("select count(*)::int as n from public.portfolio_sites where user_id = $1", [a])).rows[0].n, 0, "account deletion cascades");
  console.log("PASS: portfolio sites owner isolation, no direct writes, optimistic revisions, server-derived snapshots without private notes, unique addresses, publish/update flag/unpublish, anonymous public reads and cascade");
} catch (error) {
  console.error("FAIL:", error.message ?? error);
  process.exitCode = 1;
} finally {
  await client.query("rollback").catch(() => {});
  await client.end().catch(() => {});
}
