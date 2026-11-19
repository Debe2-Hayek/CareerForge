import { boundedFetchJson, SourceError, type FetchJson } from "./fetch";
import type { LiveJob, LiveSource } from "./normalize";
import { employerBoards, himalayasQueries, parseGreenhouse, parseHimalayas, parseWorkable, sourceHosts } from "./sources";

/** One unit of ingestion. `complete` means the fetch returned the entire board, so absent jobs have closed. */
export type SourceResult = {
  source: LiveSource; board: string | null; label: string; complete: boolean;
  ok: boolean; jobs: LiveJob[]; skipped: number; error?: string;
};

type Options = { himalayasKey?: string; fetchers?: Partial<Record<LiveSource, FetchJson>>; pause?: (ms: number) => Promise<void> };
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
function describe(error: unknown) {
  if (error instanceof SourceError) return `${error.code}: ${error.message}${error.retryAfterSeconds ? ` (retry after ${error.retryAfterSeconds}s)` : ""}`;
  if (error && typeof error === "object" && "issues" in error) return "INVALID_SHAPE: response did not match the expected schema";
  return "UNEXPECTED: source could not be processed";
}

export async function collectLiveJobs({ himalayasKey, fetchers = {}, pause = wait }: Options = {}): Promise<SourceResult[]> {
  const get = (source: LiveSource) => fetchers[source] ?? boundedFetchJson(sourceHosts[source]);
  const results: SourceResult[] = [];

  // Himalayas refreshes daily and allows 60 requests/minute with a key; stay well below it.
  const himalayas: SourceResult = { source: "himalayas", board: null, label: "Himalayas remote jobs open to Lebanon", complete: false, ok: true, jobs: [], skipped: 0 };
  const seen = new Set<string>();
  const fetchHimalayas = get("himalayas");
  const headers: Record<string, string> = himalayasKey ? { Authorization: `Bearer ${himalayasKey}` } : {};
  let requests = 0;
  outer: for (const query of himalayasQueries) {
    for (let page = 1; page <= query.pages; page++) {
      if (requests++) await pause(1100);
      try {
        const url = `https://himalayas.app/jobs/api/search?${new URLSearchParams({ ...query.params, page: String(page) })}`;
        const parsed = parseHimalayas(await fetchHimalayas(url, headers));
        himalayas.skipped += parsed.skipped;
        for (const job of parsed.jobs) if (!seen.has(job.id)) { seen.add(job.id); himalayas.jobs.push(job); }
        if (!parsed.jobs.length && !parsed.skipped) break;
      } catch (error) {
        // Keep what earlier pages returned; an error mid-way never removes stored jobs.
        himalayas.error = describe(error);
        if (!himalayas.jobs.length) himalayas.ok = false;
        break outer;
      }
    }
  }
  results.push(himalayas);

  for (const { source, board } of employerBoards) {
    const result: SourceResult = { source, board, label: `${source === "greenhouse" ? "Greenhouse" : "Workable"} board: ${board}`, complete: true, ok: true, jobs: [], skipped: 0 };
    try {
      const url = source === "greenhouse"
        ? `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`
        : `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(board)}`;
      const parsed = source === "greenhouse" ? parseGreenhouse(board, await get(source)(url)) : parseWorkable(board, await get(source)(url));
      result.jobs = [...new Map(parsed.jobs.map(job => [job.id, job])).values()];
      result.skipped = parsed.skipped;
    } catch (error) {
      result.ok = false;
      result.complete = false;
      result.error = describe(error);
    }
    results.push(result);
  }
  return results;
}

export type Queryable = { query: (sql: string, params?: unknown[]) => Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }> };
export type WriteSummary = { label: string; upserted: number; closed: number; error?: string };

const upsertSql = `
insert into public.job_postings (id, title, company, initials, location, work_mode, employment_type, skills, description, color,
  is_active, is_fictional, source, source_board, external_id, source_url, apply_url, region, seniority, salary_text,
  published_at, expires_at, fetched_at, updated_at)
values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,false,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$21)
on conflict (source, external_id) where external_id is not null do update set
  title=excluded.title, company=excluded.company, initials=excluded.initials, location=excluded.location,
  work_mode=excluded.work_mode, employment_type=excluded.employment_type, skills=excluded.skills,
  description=excluded.description, color=excluded.color, is_active=true, source_url=excluded.source_url,
  apply_url=excluded.apply_url, region=excluded.region, seniority=excluded.seniority, salary_text=excluded.salary_text,
  published_at=excluded.published_at, expires_at=excluded.expires_at, fetched_at=excluded.fetched_at, updated_at=excluded.updated_at`;

/**
 * Writes successful sources, each in its own transaction. Failed sources are
 * left untouched; their rows stop being shown once they pass the 7-day
 * freshness window. Expired/closed rows are removed unless a user saved them,
 * in which case they stay inactive for that user's tracker history only.
 */
export async function writeLiveJobs(db: Queryable, results: SourceResult[], now: Date): Promise<WriteSummary[]> {
  const summaries: WriteSummary[] = [];
  for (const result of results) {
    if (!result.ok) { summaries.push({ label: result.label, upserted: 0, closed: 0, error: result.error }); continue; }
    await db.query("begin");
    try {
      for (const job of result.jobs) {
        await db.query(upsertSql, [job.id, job.title, job.company, job.initials, job.location, job.workMode, job.employmentType, job.skills,
          job.description, job.color, job.source, job.sourceBoard, job.externalId, job.sourceUrl, job.applyUrl, job.region, job.seniority,
          job.salaryText, job.publishedAt, job.expiresAt, now]);
      }
      let closed = 0;
      if (result.complete && result.board) {
        closed = (await db.query(
          "update public.job_postings set is_active=false, updated_at=$4 where source=$1 and source_board=$2 and is_active and not (external_id = any($3::text[]))",
          [result.source, result.board, result.jobs.map(job => job.externalId), now])).rowCount ?? 0;
      } else {
        closed = (await db.query(
          "update public.job_postings set is_active=false, updated_at=$2 where source=$1 and is_active and (expires_at <= $2 or fetched_at < $2 - interval '3 days')",
          [result.source, now])).rowCount ?? 0;
      }
      await db.query("commit");
      summaries.push({ label: result.label, upserted: result.jobs.length, closed, error: result.error });
    } catch (error) {
      await db.query("rollback").catch(() => {});
      summaries.push({ label: result.label, upserted: 0, closed: 0, error: `WRITE_FAILED: ${error instanceof Error && "code" in error ? String((error as { code: unknown }).code) : "database error"}` });
    }
  }
  await db.query(`delete from public.job_postings j where j.source <> 'fictional'
    and (not j.is_active or j.expires_at <= $1 or j.fetched_at < $1 - interval '7 days')
    and not exists (select 1 from public.saved_jobs s where s.job_id = j.id)`, [now]);
  return summaries;
}
