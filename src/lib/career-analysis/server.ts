import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { roleRoadmaps } from "../roadmaps/catalog";
import { marksFor } from "../roadmaps/progress";
import { readClaimsOverview } from "../claims/server";
import type { LearningSnapshot } from "../learning/api";
import type { AccountProfile } from "../account/schemas";
import { analyseCareer, rankCareers, type CareerDetail, type CareerSummary, type SkillWithStatus } from "./score";

export const careerIds = new Set(roleRoadmaps.map(roadmap => roadmap.id));

/** Every career scored for this user, best first, plus the full detail of one. */
export async function analyseCareers(client: SupabaseClient, userId: string, profile: AccountProfile, snapshot: LearningSnapshot | null, selectedId: string | null): Promise<{ ranked: CareerSummary[]; detail: CareerDetail }> {
  const items = await readClaimsOverview(client, userId, profile.skills).catch(() => []);
  const statusOf = new Map(items.filter(item => item.kind === "skill").map(item => [item.title.toLowerCase(), item.status]));
  const skills: SkillWithStatus[] = profile.skills.map(name => ({ name, status: statusOf.get(name.toLowerCase()) ?? "self_declared" }));
  const details = roleRoadmaps.map(roadmap => analyseCareer(roadmap, skills, marksFor(roadmap, snapshot)));
  const ranked = rankCareers(details);
  const chosen = selectedId && careerIds.has(selectedId) ? selectedId : ranked[0].id;
  return { ranked, detail: details.find(detail => detail.id === chosen)! };
}
