import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "../supabase/server";
import { historyAccess } from "../profile-history-server";
import { readClaimsOverview } from "../claims/server";
import { catalogJob, jobColumns } from "../tracker/schemas";
import { trackerAccess } from "../tracker/server";
import { profileFromRow } from "../account/schemas";
import type { CatalogJob } from "../tracker/schemas";
import type { CandidateInput, JobInput } from "./score";

export type AnalysisJob = JobInput & { id: string | null; source: string; location: string };

export function jobInputFrom(job: CatalogJob): AnalysisJob {
  return { id: job.id, title: job.title, company: job.company, skills: job.skills, description: job.description, experienceLevel: job.level ?? null, source: job.isFictional ? "Demo role" : "Live listing", location: job.location };
}

/** The owner's saved profile as analysis input: skills with trust levels, work, education. */
export async function readCandidate(client: SupabaseClient, userId: string): Promise<{ candidate: CandidateInput; name: string }> {
  const { data, error } = await client.from("profiles").select("full_name,headline,location,bio,education_summary,project_summary,self_reported_skills").eq("id", userId).single();
  if (error) throw new Error("Profile unavailable");
  const profile = profileFromRow(data);
  const [history, items, catalog] = await Promise.all([
    historyAccess(client, userId).readAll(),
    readClaimsOverview(client, userId, profile.skills),
    client.rpc("skill_check_catalog")
  ]);
  const statusOf = new Map(items.filter(item => item.kind === "skill").map(item => [item.title.toLowerCase(), item.status]));
  const checkable = catalog.error ? [] : z.array(z.object({ skill: z.string() }).loose()).catch([]).parse(catalog.data ?? []).map(bank => bank.skill);
  return {
    name: profile.name,
    candidate: {
      headline: profile.headline,
      skills: profile.skills.map(name => ({ name, status: statusOf.get(name.toLowerCase()) ?? "self_declared" })),
      experience: history.experience.map(record => ({ role: record.role, company: record.company, startDate: record.startDate, endDate: record.endDate, isCurrent: record.isCurrent })),
      education: history.education.map(record => ({ degree: record.degree, institution: record.institution })),
      project: profile.project,
      checkable
    }
  };
}

/** Jobs the owner saved in the tracker, plus one listing named in the link (if visible to them). */
export async function readAnalysisJobs(client: SupabaseClient, userId: string, requestedId: string | null): Promise<AnalysisJob[]> {
  const saved = (await trackerAccess(client, userId).list()).map(entry => jobInputFrom(entry.job));
  if (requestedId && !saved.some(job => job.id === requestedId) && /^[a-zA-Z0-9_-]{1,100}$/.test(requestedId)) {
    const { data } = await client.from("job_postings").select(jobColumns).eq("id", requestedId).maybeSingle();
    if (data) saved.unshift(jobInputFrom(catalogJob(data)));
  }
  return saved;
}

export async function signedInClient() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error) {
    if (error.status === 400 || error.status === 401 || error.name === "AuthSessionMissingError") return null;
    throw new Error("Session verification unavailable");
  }
  return user ? { client, userId: user.id } : null;
}
