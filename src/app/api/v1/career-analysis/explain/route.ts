import { careerExplainHandlers } from "@/lib/career-analysis/handlers";
import { analyseCareers, careerIds } from "@/lib/career-analysis/server";
import { signedInClient } from "@/lib/cv-analysis/server";
import { readLearningSnapshot } from "@/lib/learning/server";
import { profileFromRow } from "@/lib/account/schemas";
import { aiProvider, authorizeAi } from "@/lib/ai/server";

export const maxDuration = 60;
// Loads the account directly (not loadLearningAccount, which redirects): an API answers 401.
export const { POST } = careerExplainHandlers(async () => {
  const session = await signedInClient();
  if (!session) return null;
  const ai = await authorizeAi();
  if (!ai) return null;
  return {
    runs: ai.runs,
    detail: async careerId => {
      if (!careerIds.has(careerId)) return null;
      const [profileRow, snapshot] = await Promise.all([
        session.client.from("profiles").select("full_name,headline,location,bio,education_summary,project_summary,self_reported_skills").eq("id", session.userId).single(),
        readLearningSnapshot(session.client, session.userId).catch(() => null)
      ]);
      if (profileRow.error || !profileRow.data) throw new Error("Profile unavailable");
      const profile = profileFromRow(profileRow.data);
      const { detail } = await analyseCareers(session.client, session.userId, profile, snapshot, careerId);
      return { detail, headline: profile.headline };
    }
  };
}, aiProvider);
