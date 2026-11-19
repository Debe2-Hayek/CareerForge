// Imports live listings from the configured permitted sources into the
// database named by DATABASE_URL (server-side administration credentials).
// Usage: npm run jobs:ingest              (fetch + write)
//        npm run jobs:ingest -- --dry-run (fetch + validate only, no writes)
import { loadEnvConfig } from "@next/env";
import pg from "pg";
import { collectLiveJobs, recheckHimalayas, writeLiveJobs } from "../src/lib/jobs/ingest";

async function main() {
  loadEnvConfig(process.cwd());
  const dryRun = process.argv.includes("--dry-run");
  const key = process.env.HIMALAYAS_API_KEY?.trim() || undefined;
  if (!key) console.warn("HIMALAYAS_API_KEY is not set; using Himalayas' lower anonymous limits.");

  const results = await collectLiveJobs({ himalayasKey: key });
  const connectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
  if (!connectionString && !dryRun) { console.error("DATABASE_URL is required to write listings."); process.exitCode = 1; return; }
  const client = connectionString ? new pg.Client({ connectionString, connectionTimeoutMillis: 15_000, statement_timeout: 60_000 }) : null;
  try {
    if (client) {
      await client.connect();
      // Stored Himalayas jobs missing from the latest pages are looked up individually (read-only).
      const stored = await client.query("select external_id, title from public.job_postings where source='himalayas' and is_active");
      const himalayas = results.find(result => result.source === "himalayas");
      if (himalayas) await recheckHimalayas(himalayas, stored.rows.map(row => ({ externalId: String(row.external_id), title: String(row.title) })), { himalayasKey: key });
    }
    for (const result of results) {
      const regions = result.jobs.reduce<Record<string, number>>((counts, job) => ({ ...counts, [job.region]: (counts[job.region] ?? 0) + 1 }), {});
      const levels = result.jobs.reduce<Record<string, number>>((counts, job) => ({ ...counts, [job.experienceLevel ?? "unknown"]: (counts[job.experienceLevel ?? "unknown"] ?? 0) + 1 }), {});
      console.log(`${result.ok ? "fetched" : "FAILED "} ${result.label}: ${result.jobs.length} jobs, ${result.skipped} skipped, ${result.exclusions.length} not open to Lebanon ${JSON.stringify(regions)} ${JSON.stringify(levels)}${result.error ? ` — ${result.error}` : ""}`);
      if (result.recheck) console.log(`        recheck of stored jobs: ${JSON.stringify(result.recheck)}`);
      if (process.argv.includes("--verbose")) for (const item of result.exclusions) console.log(`        excluded: ${item.reason}`);
    }
    if (results.every(result => !result.ok)) process.exitCode = 1;
    if (dryRun || !client) { console.log("Dry run: nothing written."); return; }
    const summaries = await writeLiveJobs(client, results, new Date());
    for (const summary of summaries) console.log(`stored  ${summary.label}: ${summary.upserted} upserted, ${summary.closed} closed${summary.error ? ` — ${summary.error}` : ""}`);
    const counts = await client.query("select source, region, count(*)::int as n from public.job_postings where source <> 'fictional' and is_active group by 1,2 order by 1,2");
    console.log("Active live listings:", counts.rows.map(row => `${row.source}/${row.region}=${row.n}`).join(", ") || "none");
  } catch (error) {
    console.error("Ingestion write failed:", error instanceof Error && "code" in error ? (error as { code: unknown }).code : "check connection");
    process.exitCode = 1;
  } finally { await client?.end().catch(() => {}); }
}

void main();
