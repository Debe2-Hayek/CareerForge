import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { profileFromRow } from "../account/schemas";
import { historyAccess } from "../profile-history-server";
import { formatHistoryPeriod } from "../profile-history-format";
import { readLearningSnapshot } from "../learning/server";
import { analyseCareers } from "../career-analysis/server";
import { readClaimsOverview } from "../claims/server";
import { chatProviderFromEnv } from "../ai/provider";
import type { AssistantData } from "./context";

export const assistantProvider = () => chatProviderFromEnv(process.env);

/** The owner's data the assistant may use; each part is sent only if the user ticks it. */
export async function readAssistantData(client: SupabaseClient, userId: string): Promise<AssistantData> {
  const { data, error } = await client.from("profiles").select("full_name,headline,location,bio,education_summary,project_summary,self_reported_skills").eq("id", userId).single();
  if (error) throw new Error("Profile unavailable");
  const profile = profileFromRow(data);
  const [history, items, snapshot] = await Promise.all([
    historyAccess(client, userId).readAll(),
    readClaimsOverview(client, userId, profile.skills).catch(() => []),
    readLearningSnapshot(client, userId).catch(() => null)
  ]);
  const statusOf = new Map(items.filter(item => item.kind === "skill").map(item => [item.title.toLowerCase(), item.status]));
  const { ranked } = await analyseCareers(client, userId, profile, snapshot, null);
  return {
    headline: profile.headline, location: profile.location, bio: profile.bio,
    skills: profile.skills.map(name => ({ name, status: statusOf.get(name.toLowerCase()) ?? "self_declared" })),
    experience: history.experience.map(record => ({ role: record.role, company: record.company, years: formatHistoryPeriod(record) })),
    education: history.education.map(record => ({ degree: record.degree, institution: record.institution, years: formatHistoryPeriod(record) })),
    careers: ranked.slice(0, 3).map(career => ({ title: career.title, score: career.score, criticalDone: career.critical.done, criticalTotal: career.critical.total }))
  };
}
