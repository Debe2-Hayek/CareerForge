import { z } from "zod";
import {
  clip, companyStyle, dateOrNull, detectSkills, employmentType, htmlToText, liveJobId, regionOfPlace,
  regionOfRestrictions, remoteLocationLabel, safeHttpsUrl, salaryText, workModeFrom, type LiveJob
} from "./normalize";

/**
 * Configured, permitted sources only. Ingestion never fetches user-supplied
 * URLs. Terms reviewed 19 November 2026:
 * - Himalayas API terms (himalayas.app/terms, API clause): display on sites we
 *   operate, keep `applicationLink` unchanged for Apply, visibly attribute
 *   Himalayas, cache and remove expired jobs, keep the key server-side, and do
 *   not pass jobs to other boards/aggregators or JobPosting structured data.
 * - Greenhouse Job Board API and Workable public job widget: public,
 *   unauthenticated read endpoints for each employer's published listings;
 *   robots.txt does not disallow them. We link back to the original posting.
 */
export const sourceHosts = {
  himalayas: ["himalayas.app"],
  greenhouse: ["greenhouse.io"],
  workable: ["workable.com"]
} as const;

export const himalayasQueries = [
  // Remote jobs whose employers accept applicants in Lebanon (includes worldwide).
  { label: "Open to Lebanon · recent", params: { country: "LB", sort: "recent" }, pages: 4 },
  { label: "Open to Lebanon · entry level", params: { country: "LB", seniority: "Entry-level", sort: "recent" }, pages: 2 }
] as const;

/** Employer boards with on-site/hybrid roles in Lebanon or the wider MENA region. */
export const employerBoards = [
  { source: "workable", board: "valsoft-corp" },
  { source: "workable", board: "infoquest" },
  { source: "greenhouse", board: "careem" },
  { source: "greenhouse", board: "tamara" }
] as const satisfies readonly { source: "workable" | "greenhouse"; board: string }[];

export type ParseResult = { jobs: LiveJob[]; skipped: number };
const text = (max: number) => z.string().trim().min(1).max(max);

const himalayasJob = z.object({
  title: text(300), companyName: text(200), guid: text(2000), applicationLink: text(2000),
  excerpt: z.string().max(5000).nullish(), description: z.string().max(400_000).nullish(),
  employmentType: z.string().max(80).nullish(), seniority: z.array(z.string().max(60)).max(10).nullish(),
  locationRestrictions: z.array(z.string().max(120)).max(300).nullish(),
  categories: z.array(z.string().max(120)).max(60).nullish(),
  minSalary: z.number().nullish(), maxSalary: z.number().nullish(), currency: z.string().max(8).nullish(), salaryPeriod: z.string().max(20).nullish(),
  pubDate: z.number().nullish(), expiryDate: z.number().nullish()
});
export const himalayasPage = z.object({ jobs: z.array(z.unknown()).max(100), totalCount: z.number().optional() });

export function parseHimalayas(payload: unknown): ParseResult {
  const page = himalayasPage.parse(payload);
  const jobs: LiveJob[] = [];
  let skipped = 0;
  for (const raw of page.jobs) {
    const parsed = himalayasJob.safeParse(raw);
    const job = parsed.success ? parsed.data : null;
    const sourceUrl = job && safeHttpsUrl(job.guid, sourceHosts.himalayas);
    const applyUrl = job && safeHttpsUrl(job.applicationLink, sourceHosts.himalayas);
    if (!job || !sourceUrl || !applyUrl) { skipped++; continue; }
    const restrictions = job.locationRestrictions ?? [];
    const description = htmlToText(job.description || job.excerpt || "", 900) || clip(job.title, 900);
    const company = clip(job.companyName, 160);
    jobs.push({
      id: liveJobId("himalayas", job.guid), source: "himalayas", sourceBoard: null, externalId: job.guid,
      title: clip(job.title, 160), company, ...companyStyle(company),
      location: remoteLocationLabel(restrictions), workMode: "Remote", employmentType: employmentType(job.employmentType),
      region: regionOfRestrictions(restrictions),
      skills: detectSkills(job.title, (job.categories ?? []).join(" ").replace(/-/g, " "), htmlToText(job.description ?? "", 20_000)),
      description, sourceUrl, applyUrl,
      seniority: job.seniority?.length ? clip(job.seniority.join(", "), 120) : null,
      salaryText: salaryText(job.minSalary, job.maxSalary, job.currency, job.salaryPeriod),
      publishedAt: dateOrNull(job.pubDate), expiresAt: dateOrNull(job.expiryDate)
    });
  }
  return { jobs, skipped };
}

const greenhouseJob = z.object({
  id: z.number().int().positive(), title: text(300), absolute_url: text(2000),
  company_name: z.string().max(200).nullish(), location: z.object({ name: z.string().max(300).nullish() }).nullish(),
  content: z.string().max(400_000).nullish(), first_published: z.string().max(40).nullish(), updated_at: z.string().max(40).nullish(),
  application_deadline: z.string().max(40).nullish()
});
export const greenhouseBoard = z.object({ jobs: z.array(z.unknown()).max(2000) });

/** Keeps only roles located in Lebanon or MENA. Metadata (which can include staff emails) is never read. */
export function parseGreenhouse(board: string, payload: unknown): ParseResult {
  const data = greenhouseBoard.parse(payload);
  const jobs: LiveJob[] = [];
  let skipped = 0;
  for (const raw of data.jobs) {
    const parsed = greenhouseJob.safeParse(raw);
    const job = parsed.success ? parsed.data : null;
    const url = job && safeHttpsUrl(job.absolute_url, sourceHosts.greenhouse);
    if (!job || !url) { skipped++; continue; }
    const place = clip(job.location?.name ?? "", 160);
    const region = regionOfPlace(place);
    if (!region) continue; // Outside the configured geography; not an error.
    const company = clip(job.company_name || board, 160);
    const body = htmlToText(job.content ?? "", 20_000);
    jobs.push({
      id: liveJobId("greenhouse", `${board}:${job.id}`), source: "greenhouse", sourceBoard: board, externalId: `${board}:${job.id}`,
      title: clip(job.title, 160), company, ...companyStyle(company), location: place || "Location not specified",
      workMode: workModeFrom(`${place} ${job.title}`), employmentType: employmentType(/intern/i.test(job.title) ? "intern" : body.match(/\b(full[- ]time|part[- ]time|internship|contract)\b/i)?.[0]),
      region, skills: detectSkills(job.title, body), description: clip(body, 900) || clip(job.title, 900),
      sourceUrl: url, applyUrl: url, seniority: null, salaryText: null,
      publishedAt: dateOrNull(job.first_published) ?? dateOrNull(job.updated_at), expiresAt: dateOrNull(job.application_deadline)
    });
  }
  return { jobs, skipped };
}

const workableLocation = z.object({ country: z.string().max(120).nullish(), city: z.string().max(120).nullish(), region: z.string().max(120).nullish() });
const workableJob = z.object({
  shortcode: z.string().regex(/^[A-Za-z0-9]{4,40}$/), title: text(300), url: text(2000), application_url: z.string().max(2000).nullish(),
  employment_type: z.string().max(80).nullish(), telecommuting: z.boolean().nullish(), department: z.string().max(200).nullish(),
  function: z.string().max(200).nullish(), industry: z.string().max(200).nullish(), experience: z.string().max(120).nullish(),
  education: z.string().max(200).nullish(), published_on: z.string().max(40).nullish(), created_at: z.string().max(40).nullish(),
  country: z.string().max(120).nullish(), city: z.string().max(120).nullish(), locations: z.array(workableLocation).max(50).nullish()
});
export const workableBoard = z.object({ name: z.string().max(200).nullish(), jobs: z.array(z.unknown()).max(2000) });

export function parseWorkable(board: string, payload: unknown): ParseResult {
  const data = workableBoard.parse(payload);
  const company = clip(data.name || board, 160);
  const jobs: LiveJob[] = [];
  let skipped = 0;
  for (const raw of data.jobs) {
    const parsed = workableJob.safeParse(raw);
    const job = parsed.success ? parsed.data : null;
    const sourceUrl = job && safeHttpsUrl(job.url, sourceHosts.workable);
    if (!job || !sourceUrl) { skipped++; continue; }
    const applyUrl = safeHttpsUrl(job.application_url, sourceHosts.workable) ?? sourceUrl;
    const places = (job.locations?.length ? job.locations : [{ city: job.city, country: job.country }])
      .map(place => [place.city, place.country].filter(Boolean).join(", ")).filter(Boolean);
    const regionsFound = places.map(regionOfPlace);
    const region = regionsFound.includes("lebanon") ? "lebanon" : regionsFound.includes("mena") ? "mena" : null;
    if (!region) continue;
    const local = places.filter(place => regionOfPlace(place) === region);
    const facts = [["Department", job.department], ["Function", job.function], ["Industry", job.industry], ["Experience", job.experience], ["Education", job.education]]
      .filter(([, value]) => value).map(([label, value]) => `${label}: ${value}.`).join(" ");
    jobs.push({
      id: liveJobId("workable", `${board}:${job.shortcode}`), source: "workable", sourceBoard: board, externalId: `${board}:${job.shortcode}`,
      title: clip(job.title, 160), company, ...companyStyle(company), location: clip(local.join(" · ") || places[0] || "Location not specified", 160),
      workMode: job.telecommuting ? "Remote" : "Not specified", employmentType: employmentType(job.employment_type), region,
      skills: detectSkills(job.title, job.function ?? "", job.department ?? ""),
      description: clip(facts ? `${facts} The employer's page has the full description.` : "The employer's page has the full description.", 900),
      sourceUrl, applyUrl, seniority: job.experience ? clip(job.experience, 120) : null, salaryText: null,
      publishedAt: dateOrNull(job.published_on) ?? dateOrNull(job.created_at), expiresAt: null
    });
  }
  return { jobs, skipped };
}
