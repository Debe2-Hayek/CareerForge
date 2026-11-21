import nextEnv from "@next/env";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { resolveAdminDatabaseUrl } from "./database-url.mjs";

nextEnv.loadEnvConfig(process.cwd());

const client = new Client({
  connectionString: resolveAdminDatabaseUrl(),
  connectionTimeoutMillis: 15_000,
  statement_timeout: 30_000
});

let transactionOpen = false;

try {
  await client.connect();
  await client.query("begin");
  transactionOpen = true;

  const migration = await readFile(
    new URL("../supabase/migrations/202611200001_product_evolution.sql", import.meta.url),
    "utf8"
  );
  await client.query(migration);

  const { rows: [objects] } = await client.query(`
    select
      to_regclass('public.roadmap_feedback') is not null as feedback_table,
      to_regclass('public.diagnostic_snapshots') is not null as diagnostics_table,
      to_regclass('public.roadmap_feedback_one_upvote_per_owner') is not null as upvote_guard,
      to_regclass('public.roadmap_feedback_one_friction_per_owner_node_day') is not null as friction_guard,
      to_regprocedure('public.record_roadmap_feedback(text,text,text)') is not null as feedback_recorder,
      to_regprocedure('public.record_diagnostic_snapshot(text,text,text,text,integer)') is not null as recorder,
      to_regprocedure('public.roadmap_feedback_counts()') is not null as feedback_summary,
      to_regprocedure('public.diagnostic_signal_summary()') is not null as diagnostic_summary,
      not has_table_privilege('authenticated', 'public.roadmap_feedback', 'insert') as direct_feedback_insert_revoked,
      has_function_privilege('authenticated', 'public.record_roadmap_feedback(text,text,text)', 'execute') as owner_feedback_rpc,
      not has_function_privilege('anon', 'public.record_roadmap_feedback(text,text,text)', 'execute') as anonymous_feedback_rpc_revoked
  `);
  const { rows: policies } = await client.query(`
    select tablename, count(*)::integer as policy_count
    from pg_policies
    where schemaname = 'public'
      and tablename in ('roadmap_feedback', 'diagnostic_snapshots')
    group by tablename
  `);
  const policyCounts = new Map(policies.map(row => [row.tablename, row.policy_count]));

  if (
    !Object.values(objects).every(Boolean)
    || policyCounts.get("roadmap_feedback") !== 2
    || policyCounts.get("diagnostic_snapshots") !== 2
  ) {
    throw new Error("The migration did not create its complete RLS and function contract.");
  }

  await client.query("rollback");
  transactionOpen = false;
  console.log("Product evolution migration validated; transaction rolled back with no persisted schema changes.");
} catch (error) {
  if (transactionOpen) await client.query("rollback").catch(() => {});
  const safeReason = error instanceof Error && error.message.startsWith("The migration")
    ? error.message
    : (error && typeof error === "object" && "code" in error ? String(error.code) : "VALIDATION_FAILED");
  console.error("Product evolution migration validation failed:", safeReason);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
