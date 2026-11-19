// Imports live listings from the configured permitted sources into the
// database named by DATABASE_URL (server-side administration credentials).
// Usage: npm run jobs:ingest              (fetch + write)
//        npm run jobs:ingest -- --dry-run (fetch + validate only, no writes)
import { loadEnvConfig } from "@next/env";
import pg from "pg";
import { collectLiveJobs, writeLiveJobs } from "../src/lib/jobs/ingest";

async function main() {
  loadEnvConfig(process.cwd());
  const dryRun = process.argv.includes("--dry-run");
  const key = process.env.HIMALAYAS_API_KEY?.trim() || undefined;
  if (!key) console.warn("HIMALAYAS_API_KEY is not set; using Himalayas' lower anonymous limits.");

  const results = await collectLiveJobs({ himalayasKey: key });
  for (const result of results) {
    const regions = result.jobs.reduce<Record<string, number>>((counts, job) => ({ ...counts, [job.region]: (counts[job.region] ?? 0) + 1 }), {});
    console.log(`${result.ok ? "fetched" : "FAILED "} ${result.label}: ${result.jobs.length} jobs, ${result.skipped} skipped ${JSON.stringify(regions)}${result.error ? ` — ${result.error}` : ""}`);
  }
  if (results.every(result => !result.ok)) process.exitCode = 1;
  if (dryRun) { console.log("Dry run: nothing written."); return; }

  const connectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
  if (!connectionString) { console.error("DATABASE_URL is required to write listings."); process.exitCode = 1; return; }
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 15_000, statement_timeout: 60_000 });
  try {
    await client.connect();
    const summaries = await writeLiveJobs(client, results, new Date());
    for (const summary of summaries) console.log(`stored  ${summary.label}: ${summary.upserted} upserted, ${summary.closed} closed${summary.error ? ` — ${summary.error}` : ""}`);
    const counts = await client.query("select source, region, count(*)::int as n from public.job_postings where source <> 'fictional' and is_active group by 1,2 order by 1,2");
    console.log("Active live listings:", counts.rows.map(row => `${row.source}/${row.region}=${row.n}`).join(", ") || "none");
  } catch (error) {
    console.error("Ingestion write failed:", error instanceof Error && "code" in error ? (error as { code: unknown }).code : "check connection");
    process.exitCode = 1;
  } finally { await client.end().catch(() => {}); }
}

void main();
