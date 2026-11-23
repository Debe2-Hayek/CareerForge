import { cvExplainHandlers } from "@/lib/cv-analysis/handlers";
import { jobInputFrom, readCandidate, signedInClient } from "@/lib/cv-analysis/server";
import { aiProvider, authorizeAi } from "@/lib/ai/server";
import { catalogJob, jobColumns } from "@/lib/tracker/schemas";

export const maxDuration = 60;
export const { POST } = cvExplainHandlers(async () => {
  const session = await signedInClient();
  if (!session) return null;
  const ai = await authorizeAi();
  if (!ai) return null;
  return {
    runs: ai.runs,
    candidate: async () => (await readCandidate(session.client, session.userId)).candidate,
    // RLS decides which listings the owner may see (live, current or saved by them).
    job: async id => {
      const { data, error } = await session.client.from("job_postings").select(jobColumns).eq("id", id).maybeSingle();
      if (error) throw new Error("Job unavailable");
      return data ? jobInputFrom(catalogJob(data)) : null;
    }
  };
}, aiProvider);
