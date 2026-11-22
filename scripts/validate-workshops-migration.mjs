// Applies the workshop-bookmarks migration inside a transaction that is ALWAYS
// rolled back, then verifies ownership isolation, duplicate prevention, the
// per-owner limit, id format and cascade. Nothing is persisted.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import nextEnv from "@next/env";
import { Client } from "pg";
import { resolveAdminDatabaseUrl } from "./database-url.mjs";

nextEnv.loadEnvConfig(process.cwd());
const client = new Client({ connectionString: resolveAdminDatabaseUrl(), connectionTimeoutMillis: 15000, statement_timeout: 30000 });
const a = randomUUID(), b = randomUUID();

async function rejects(sql, params, code) {
  await client.query("savepoint attempt");
  try { await assert.rejects(client.query(sql, params), error => error.code === code, `expected ${code}: ${sql}`); }
  finally { await client.query("rollback to savepoint attempt"); }
}
async function asUser(id) {
  await client.query("reset role");
  await client.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)", [id, JSON.stringify({ sub: id, role: "authenticated" })]);
  await client.query("set local role authenticated");
}
const save = "insert into public.workshop_bookmarks (user_id, workshop_id) values ($1, $2)";

try {
  await client.connect();
  await client.query("begin");
  const applied = await client.query("select to_regclass('public.workshop_bookmarks') is not null as present");
  if (!applied.rows[0].present) {
    await client.query((await readFile(new URL("../supabase/migrations/202611230001_workshop_bookmarks.sql", import.meta.url), "utf8")).replace(/\r\n/g, "\n"));
  }
  await client.query("insert into auth.users (id, email) values ($1, $2), ($3, $4)", [a, `${a}@careerforge.invalid`, b, `${b}@careerforge.invalid`]);

  const { rows: [security] } = await client.query(`select
    (select relrowsecurity from pg_class where oid = 'public.workshop_bookmarks'::regclass) as rls,
    not has_table_privilege('anon', 'public.workshop_bookmarks', 'select') as anon_denied,
    not has_table_privilege('authenticated', 'public.workshop_bookmarks', 'update') as no_updates,
    not has_column_privilege('authenticated', 'public.workshop_bookmarks', 'created_at', 'insert') as time_protected`);
  assert.deepEqual(security, { rls: true, anon_denied: true, no_updates: true, time_protected: true });

  await asUser(a);
  assert.equal((await client.query(save, [a, "cs50p"])).rowCount, 1);
  await rejects(save, [a, "cs50p"], "23505");
  await rejects(save, [b, "cs50p"], "42501");
  await rejects(save, [a, "../../etc"], "23514");
  await rejects(save, [a, "x".repeat(81)], "23514");

  await asUser(b);
  assert.equal((await client.query("select * from public.workshop_bookmarks")).rowCount, 0, "other owners' bookmarks are invisible");
  assert.equal((await client.query("delete from public.workshop_bookmarks where user_id = $1", [a])).rowCount, 0);

  await asUser(a);
  await client.query("insert into public.workshop_bookmarks (user_id, workshop_id) select $1, 'fill-' || n from generate_series(1, 299) n", [a]);
  await rejects(save, [a, "one-too-many"], "23514");
  assert.equal((await client.query("delete from public.workshop_bookmarks where user_id = $1 and workshop_id = 'cs50p'", [a])).rowCount, 1);

  await client.query("reset role");
  await client.query("delete from auth.users where id = $1", [a]);
  assert.equal((await client.query("select count(*)::int as n from public.workshop_bookmarks where user_id = $1", [a])).rows[0].n, 0, "deleting an account removes its bookmarks");
  console.log("PASS: workshop bookmarks isolation, anonymous denial, duplicates, id format, per-owner limit, server time and cascade (rolled back).");
} catch (error) {
  console.error("Workshop migration validation failed:", error.code ?? error.message);
  process.exitCode = 1;
} finally {
  await client.query("rollback").catch(() => {});
  await client.end().catch(() => {});
}
