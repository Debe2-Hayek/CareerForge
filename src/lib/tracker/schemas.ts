import { z } from "zod";
import { statuses, type Job } from "@/lib/demo-workspace";
import { levelLabels, regionLabels, type LevelKey, type RegionKey } from "@/lib/jobs/display";

export const jobIdSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
export const saveSchema = z.object({ jobId: jobIdSchema }).strict();
export const revisionSchema = z.object({ revision: z.uuid() }).strict();
export const statusSchema = revisionSchema.extend({ status: z.enum(statuses) });
export const filtersSchema = z.object({
  search: z.string().max(160).optional(),
  mode: z.enum(["Remote", "Hybrid", "On-site", "Not specified"]).optional(),
  region: z.enum(Object.keys(regionLabels) as [RegionKey, ...RegionKey[]]).optional(),
  source: z.enum(["live", "demo"]).optional(),
  level: z.enum(Object.keys(levelLabels) as [LevelKey, ...LevelKey[]]).optional()
}).strict();

/** Live listing provenance. All null for fictional demo roles. */
export type ListingFields = {
  source: string; region: RegionKey | null; sourceUrl: string | null; applyUrl: string | null;
  seniority: string | null; level: LevelKey | null; salaryText: string | null; publishedAt: string | null; expiresAt: string | null; fetchedAt: string | null;
};
export type CatalogJob = Job & { isActive: boolean; isFictional: boolean; /** The description is shortened; the full text loads on demand. */ excerpt?: boolean } & ListingFields;

/** Long descriptions are cut on a word boundary for lists; the role dialog loads the full text. */
export function withExcerpt(job: CatalogJob, length = 260): CatalogJob {
  if (job.description.length <= length + 40) return job;
  const cut = job.description.slice(0, length);
  return { ...job, description: `${cut.slice(0, Math.max(cut.lastIndexOf(" "), length - 40)).trimEnd()}…`, excerpt: true };
}
export const demoListingFields: ListingFields = {
  source: "fictional", region: null, sourceUrl: null, applyUrl: null, seniority: null, level: "entry", salaryText: null, publishedAt: null, expiresAt: null, fetchedAt: null
};
export type TrackerEntry = { jobId: string; status: (typeof statuses)[number]; revision: string; createdAt: string; updatedAt: string; job: CatalogJob };
export type TrackerData = { jobs: CatalogJob[]; applications: TrackerEntry[] };

/** Explicit column list keeps payloads small and never exposes internal columns. */
export const jobColumns = "id,title,company,initials,location,work_mode,employment_type,skills,description,color,is_active,is_fictional,source,region,source_url,apply_url,seniority,experience_level,salary_text,published_at,expires_at,fetched_at";

const httpsUrl = z.string().max(2000).refine(value => { try { return new URL(value).protocol === "https:"; } catch { return false; } });
const jobRow = z.object({
  id: jobIdSchema, title: z.string(), company: z.string(), initials: z.string(), location: z.string(),
  work_mode: z.string(), employment_type: z.string(), skills: z.array(z.string()), description: z.string(),
  color: z.string(), is_active: z.boolean(), is_fictional: z.boolean(),
  source: z.string().default("fictional"), region: z.enum(Object.keys(regionLabels) as [RegionKey, ...RegionKey[]]).nullish(),
  source_url: httpsUrl.nullish(), apply_url: httpsUrl.nullish(), seniority: z.string().nullish(),
  experience_level: z.enum(Object.keys(levelLabels) as [LevelKey, ...LevelKey[]]).nullish(), salary_text: z.string().nullish(),
  published_at: z.string().nullish(), expires_at: z.string().nullish(), fetched_at: z.string().nullish()
});
export function catalogJob(row: unknown): CatalogJob {
  const j = jobRow.parse(row);
  return { id: j.id, title: j.title, company: j.company, initials: j.initials, location: j.location,
    mode: j.work_mode, type: j.employment_type, skills: j.skills, description: j.description,
    color: j.color, isActive: j.is_active, isFictional: j.is_fictional,
    source: j.source, region: j.region ?? null, sourceUrl: j.source_url ?? null, applyUrl: j.apply_url ?? null,
    seniority: j.seniority ?? null, level: j.experience_level ?? (j.is_fictional ? "entry" : null), salaryText: j.salary_text ?? null, publishedAt: j.published_at ?? null,
    expiresAt: j.expires_at ?? null, fetchedAt: j.fetched_at ?? null };
}
export function trackerEntry(row: unknown): TrackerEntry {
  const r = z.object({ job_id: jobIdSchema, status: z.enum(statuses), revision: z.uuid(), created_at: z.string(), updated_at: z.string(), job: jobRow }).parse(row);
  return { jobId: r.job_id, status: r.status, revision: r.revision, createdAt: r.created_at, updatedAt: r.updated_at, job: catalogJob(r.job) };
}
