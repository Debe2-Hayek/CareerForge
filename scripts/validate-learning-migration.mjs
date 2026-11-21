// Applies the learning-progress migration inside a transaction that is ALWAYS
// rolled back, then verifies ownership isolation, duplicate prevention,
// constraints and server-controlled timestamps. Nothing is persisted.
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
  try {
    await assert.rejects(client.query(sql, params), error => error.code === code, `expected ${code}: ${sql}`);
  } finally { await client.query("rollback to savepoint attempt"); }
}
async function asUser(id) {
  await client.query("reset role");
  await client.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)", [id, JSON.stringify({ sub: id, role: "authenticated" })]);
  await client.query("set local role authenticated");
}
const enroll = "insert into public.learning_enrollments (user_id, course_id, goal_id, experience_level, weekly_hours, resource_format, content_version) values ($1, 'python', 'backend', 'new', 6, 'mixed', 1)";
const progress = "insert into public.learning_progress (user_id, course_id, item_kind, item_id, state, evidence_url, content_version) values ($1, 'python', $2, $3, $4, $5, 1)";

try {
  await client.connect();
  await client.query("begin");
  const applied = await client.query("select to_regclass('public.learning_progress') is not null as present");
  if (!applied.rows[0].present) {
    await client.query((await readFile(new URL("../supabase/migrations/202611210001_learning_progress.sql", import.meta.url), "utf8")).replace(/\r\n/g, "\n"));
  }
  await client.query("insert into auth.users (id, email) values ($1, $2), ($3, $4)", [a, `${a}@careerforge.invalid`, b, `${b}@careerforge.invalid`]);

  const { rows: [security] } = await client.query(`select
    (select relrowsecurity from pg_class where oid = 'public.learning_enrollments'::regclass) as enrollments_rls,
    (select relrowsecurity from pg_class where oid = 'public.learning_progress'::regclass) as progress_rls,
    not has_table_privilege('anon', 'public.learning_progress', 'select') as anon_denied,
    not has_column_privilege('authenticated', 'public.learning_progress', 'completed_at', 'update') as completion_time_protected,
    not has_column_privilege('authenticated', 'public.learning_enrollments', 'last_active_at', 'update') as activity_protected,
    not has_column_privilege('authenticated', 'public.learning_enrollments', 'user_id', 'update') as owner_immutable`);
  assert.deepEqual(security, { enrollments_rls: true, progress_rls: true, anon_denied: true, completion_time_protected: true, activity_protected: true, owner_immutable: true });

  await asUser(a);
  await rejects(enroll, [b], "42501");
  await rejects(progress, [a, "topic", "functions", "completed", null], "23503");
  assert.equal((await client.query(enroll, [a])).rowCount, 1);
  await rejects(enroll, [a], "23505");
  const before = (await client.query("select started_at, last_active_at from public.learning_enrollments where user_id = $1", [a])).rows[0];

  assert.equal((await client.query(progress, [a, "topic", "functions", "in_progress", null])).rowCount, 1);
  await rejects(progress, [a, "topic", "functions", "completed", null], "23505");
  const upsert = `${progress} on conflict (user_id, course_id, item_kind, item_id) do update set state = excluded.state, evidence_url = excluded.evidence_url returning completed_at`;
  const completed = await client.query(upsert, [a, "topic", "functions", "completed", null]);
  assert.ok(completed.rows[0].completed_at instanceof Date, "completion time is server-set");
  assert.equal((await client.query("select count(*)::int as n from public.learning_progress where user_id = $1", [a])).rows[0].n, 1, "upsert must not duplicate");
  const reopened = await client.query("update public.learning_progress set state = 'in_progress' where user_id = $1 and item_id = 'functions' returning completed_at", [a]);
  assert.equal(reopened.rows[0].completed_at, null);
  await rejects("update public.learning_progress set completed_at = now() - interval '1 year' where user_id = $1", [a], "42501");
  await rejects("update public.learning_enrollments set started_at = now() - interval '1 year' where user_id = $1", [a], "42501");

  await rejects(progress, [a, "topic", "loops", "building", null], "23514");
  await rejects(progress, [a, "topic", "loops", "completed", "https://github.com/x/y"], "23514");
  await rejects(progress, [a, "project", "calculator", "known", null], "23514");
  await rejects(progress, [a, "project", "calculator", "completed", "http://insecure.example"], "23514");
  await rejects(progress, [a, "topic", "Bad Id!", "completed", null], "23514");
  assert.equal((await client.query(progress, [a, "project", "calculator", "completed", "https://github.com/example/calculator"])).rowCount, 1);

  const after = (await client.query("select started_at, last_active_at from public.learning_enrollments where user_id = $1", [a])).rows[0];
  assert.equal(after.started_at.getTime(), before.started_at.getTime(), "enrolment start never changes");
  assert.ok(after.last_active_at >= before.last_active_at, "progress advances activity time");
  assert.equal((await client.query("update public.learning_enrollments set goal_id = 'data' where user_id = $1", [a])).rowCount, 1);
  assert.equal((await client.query("select count(*)::int as n from public.learning_progress where user_id = $1", [a])).rows[0].n, 2, "changing goal keeps progress");

  await asUser(b);
  assert.equal((await client.query("select * from public.learning_enrollments")).rowCount, 0);
  assert.equal((await client.query("select * from public.learning_progress")).rowCount, 0);
  assert.equal((await client.query("update public.learning_progress set state = 'known' where user_id = $1", [a])).rowCount, 0);
  assert.equal((await client.query("delete from public.learning_enrollments where user_id = $1", [a])).rowCount, 0);
  await rejects(progress, [a, "topic", "loops", "completed", null], "42501");

  await client.query("reset role");
  await client.query("set local role anon");
  await rejects("select * from public.learning_progress", [], "42501");

  await asUser(a);
  assert.equal((await client.query("delete from public.learning_enrollments where user_id = $1", [a])).rowCount, 1);
  assert.equal((await client.query("select count(*)::int as n from public.learning_progress")).rows[0].n, 0, "removing an enrolment cascades its progress");
  console.log("PASS: learning RLS isolation, anonymous denial, duplicate prevention, state/evidence constraints, server timestamps, goal changes keep progress, cascade");
} catch (error) {
  console.error("FAIL:", error.message ?? error);
  process.exitCode = 1;
} finally {
  await client.query("rollback").catch(() => {});
  await client.end().catch(() => {});
}
