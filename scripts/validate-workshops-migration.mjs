// Applies the workshop-bookmarks migration inside a transaction that is ALWAYS
// rolled back (bookmarks and suggestions), then verifies ownership isolation, duplicate prevention, the
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

  // Suggestions: learners may add, suggest and withdraw, but never approve.
  await client.query("reset role");
  const second = await client.query("select to_regclass('public.workshop_suggestions') is not null as present");
  if (!second.rows[0].present) await client.query((await readFile(new URL("../supabase/migrations/202611230002_workshop_suggestions.sql", import.meta.url), "utf8")).replace(/\r\n/g, "\n"));
  const add = "insert into public.workshop_suggestions (user_id, workshop_id, record, status) values ($1, $2, $3, $4)";
  const one = "local-0123456789abcdef", record = JSON.stringify({ title: "Example" });
  const { rows: [guard] } = await client.query(`select (select relrowsecurity from pg_class where oid = 'public.workshop_suggestions'::regclass) as rls,
    not has_table_privilege('anon', 'public.workshop_suggestions', 'select') as anon_denied,
    not has_function_privilege('anon', 'public.careerforge_approved_workshops()', 'execute') as anon_function_denied,
    not has_column_privilege('authenticated', 'public.workshop_suggestions', 'record', 'update') as record_immutable,
    not has_column_privilege('authenticated', 'public.workshop_suggestions', 'review_note', 'update') as note_protected`);
  assert.deepEqual(guard, { rls: true, anon_denied: true, anon_function_denied: true, record_immutable: true, note_protected: true });
  await asUser(a);
  await rejects(add, [a, one, record, "approved"], "42501");
  await rejects(add, [b, one, record, "private"], "42501");
  await rejects(add, [a, "cs50p", record, "private"], "23514");
  await rejects(add, [a, one, JSON.stringify({ text: "x".repeat(5000) }), "private"], "23514");
  assert.equal((await client.query(add, [a, one, record, "private"])).rowCount, 1);
  await rejects(add, [a, one, record, "private"], "23505");
  await rejects("update public.workshop_suggestions set status = 'approved' where user_id = $1", [a], "42501");
  assert.equal((await client.query("update public.workshop_suggestions set status = 'pending' where user_id = $1", [a])).rowCount, 1);
  assert.equal((await client.query("select * from public.careerforge_approved_workshops()")).rows.filter(row => row.workshop_id === one).length, 0, "pending is invisible to others");
  await asUser(b);
  assert.equal((await client.query("select * from public.workshop_suggestions")).rowCount, 0);
  await client.query("reset role");
  const approved = await client.query("update public.workshop_suggestions set status = 'approved' where user_id = $1 returning reviewed_at", [a]);
  assert.ok(approved.rows[0].reviewed_at instanceof Date, "review time is server-set");
  await asUser(b);
  const visible = (await client.query("select * from public.careerforge_approved_workshops()")).rows.filter(row => row.workshop_id === one);
  assert.equal(visible.length, 1);
  assert.deepEqual(Object.keys(visible[0]).sort(), ["record", "reviewed_on", "workshop_id"], "the suggester is never returned");
  await asUser(a);
  await rejects("update public.workshop_suggestions set status = 'private' where user_id = $1", [a], "42501");
  assert.equal((await client.query("delete from public.workshop_suggestions where user_id = $1", [a])).rowCount, 1, "owners can always remove their own");

  await client.query("reset role");
  await client.query("delete from auth.users where id = $1", [a]);
  assert.equal((await client.query("select count(*)::int as n from public.workshop_bookmarks where user_id = $1", [a])).rows[0].n, 0, "deleting an account removes its bookmarks");
  console.log("PASS: workshop bookmarks isolation, anonymous denial, duplicates, id format, per-owner limit, server time and cascade; suggestions private by default, review only by operators, suggester never exposed (rolled back).");
} catch (error) {
  console.error("Workshop migration validation failed:", error.code ?? error.message);
  process.exitCode = 1;
} finally {
  await client.query("rollback").catch(() => {});
  await client.end().catch(() => {});
}
