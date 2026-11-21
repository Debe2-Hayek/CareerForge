import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import { Client } from "pg";
import { resolveAdminDatabaseUrl } from "./database-url.mjs";

if (!process.argv.includes("--development-rollback") || process.env.NODE_ENV === "production") {
  throw new Error("Run only against a development database with --development-rollback.");
}

nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const client = new Client({ connectionString: resolveAdminDatabaseUrl(), connectionTimeoutMillis: 15_000, statement_timeout: 20_000 });
const owners = [randomUUID(), randomUUID(), randomUUID()];
let transactionOpen = false;

async function asRole(role, ownerId = null) {
  await client.query("reset role");
  await client.query(
    "select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claims',$2,true)",
    [ownerId ?? "", JSON.stringify(ownerId ? { sub: ownerId, role } : { role })]
  );
  await client.query(`set local role ${role}`);
}

async function denied(sql, params = [], code = "42501") {
  await client.query("savepoint expected_denial");
  try {
    await assert.rejects(client.query(sql, params), error => error.code === code);
  } finally {
    await client.query("rollback to savepoint expected_denial");
  }
}

try {
  await client.connect();
  await client.query("begin");
  transactionOpen = true;

  const contract = (await client.query(`
    select
      to_regclass('public.roadmap_feedback') is not null as feedback_table,
      to_regclass('public.diagnostic_snapshots') is not null as diagnostics_table,
      to_regprocedure('public.record_roadmap_feedback(text,text,text)') is not null as feedback_rpc,
      to_regprocedure('public.record_diagnostic_snapshot(text,text,text,text,integer)') is not null as diagnostic_rpc
  `)).rows[0];
  assert.ok(Object.values(contract).every(Boolean), "Apply the product evolution migration before this test.");

  for (const owner of owners) {
    await client.query("insert into auth.users(id,email) values($1,$2)", [owner, `${owner}@careerforge.invalid`]);
  }

  await asRole("authenticated", owners[0]);
  await denied(
    "insert into public.roadmap_feedback(user_id,node_id,kind) values($1,'live-job-source','upvote')",
    [owners[0]]
  );
  await client.query("select public.record_roadmap_feedback($1,$2,$3)", ["live-job-source", "upvote", null]);
  await client.query("select public.record_roadmap_feedback($1,$2,$3)", ["live-job-source", "upvote", null]);
  await client.query("select public.record_roadmap_feedback($1,$2,$3)", ["live-job-source", "friction", "  Source freshness is hard to find.  "]);
  await client.query("select public.record_roadmap_feedback($1,$2,$3)", ["live-job-source", "friction", "Source attribution is hard to find."]);
  await denied(
    "select public.record_roadmap_feedback($1,$2,$3)",
    ["invented-node", "upvote", null],
    "22023"
  );
  const ownerFeedback = await client.query("select kind,summary from public.roadmap_feedback order by kind");
  assert.equal(ownerFeedback.rowCount, 2);
  assert.equal(ownerFeedback.rows.find(row => row.kind === "friction").summary, "Source attribution is hard to find.");

  await asRole("authenticated", owners[1]);
  assert.equal((await client.query("select id from public.roadmap_feedback")).rowCount, 0);
  await client.query("select public.record_roadmap_feedback($1,$2,$3)", ["live-job-source", "upvote", null]);
  assert.equal((await client.query("select id from public.roadmap_feedback")).rowCount, 1);

  for (const owner of owners) {
    await asRole("authenticated", owner);
    await client.query(
      "select public.record_diagnostic_snapshot($1,$2,$3,$4,$5)",
      ["a1b2c3d4", "not-found", "/missing-example", "404 dead end", null]
    );
    assert.equal((await client.query("select id from public.diagnostic_snapshots")).rowCount, 1);
  }

  await asRole("anon");
  await denied("select public.record_roadmap_feedback($1,$2,$3)", ["live-job-source", "upvote", null]);
  const publicSummary = await client.query(
    "select occurrences,affected_users from public.diagnostic_signal_summary() where fingerprint=$1",
    ["a1b2c3d4"]
  );
  assert.equal(publicSummary.rowCount, 1);
  assert.equal(Number(publicSummary.rows[0].occurrences), 3);
  assert.equal(Number(publicSummary.rows[0].affected_users), 3);

  await client.query("rollback");
  transactionOpen = false;
  console.log("PASS: feedback RPC validation/idempotency, owner isolation, direct-write denial, anonymous denial and 3-owner diagnostic aggregation");
} catch (error) {
  console.error("Product signal database verification failed:", error?.code ?? error?.name ?? "TEST_FAILED");
  process.exitCode = 1;
} finally {
  if (transactionOpen) await client.query("rollback").catch(() => {});
  await client.end().catch(() => {});
  console.log("Test transaction rolled back; no product-signal fixtures retained.");
}
