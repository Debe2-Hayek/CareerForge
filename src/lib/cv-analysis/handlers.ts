import { z } from "zod";
import { failure, isSameOrigin, json } from "../account/http";
import { readBoundedJson } from "../account/request-body";
import { AiError, type AiProvider } from "../ai/provider";
import { AiLimitError, runAi, type AiRunStore } from "../ai/runner";
import { analyseFit, type CandidateInput, type JobInput } from "./score";
import { CV_EXPLAIN_PROMPT, aiExplanationSchema, explainInput, explainPrompt, guardExplanation } from "./explain";

/** A job is either one the owner can see (by id) or text they pasted. */
export const explainRequestSchema = z.union([
  z.object({ jobId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/) }).strict(),
  z.object({ pasted: z.object({ title: z.string().trim().min(2).max(160), company: z.string().trim().max(120).default(""), description: z.string().trim().min(40).max(8000) }).strict() }).strict()
]);
export type ExplainAccess = {
  candidate(): Promise<CandidateInput>;
  job(id: string): Promise<JobInput | null>;
  runs: AiRunStore;
};

/** POST /api/v1/cv-analysis/explain: recompute the score on the server, then let the AI explain it. */
export function cvExplainHandlers(authorize: () => Promise<ExplainAccess | null>, provider: () => AiProvider | null) {
  async function POST(request: Request) {
    if (!isSameOrigin(request)) return failure("FORBIDDEN", "This request must come from CareerForge.", 403);
    let access: ExplainAccess | null;
    try { access = await authorize(); }
    catch { return failure("AUTH_UNAVAILABLE", "Your session could not be verified. Please try again.", 503); }
    if (!access) return failure("UNAUTHORIZED", "Sign in to analyse a job.", 401);
    const input = explainRequestSchema.safeParse(await readBoundedJson(request, 16384));
    if (!input.success) return failure("INVALID_INPUT", "Choose a saved job, or paste a title and at least 40 characters of the job description.", 400);
    const ai = provider();
    if (!ai) return failure("AI_NOT_CONFIGURED", "The AI explanation is not available right now. Your score and next steps above are complete without it.", 501);
    try {
      const job = "jobId" in input.data ? await access.job(input.data.jobId) : { ...input.data.pasted, skills: [], experienceLevel: null };
      if (!job) return failure("NOT_FOUND", "This job is no longer available.", 404);
      const candidate = await access.candidate();
      // The score comes from code on the server; the browser's copy is never trusted.
      const analysis = analyseFit(job, candidate);
      const facts = explainInput(job, candidate, analysis);
      const run = await runAi(access.runs, ai, { feature: "cv_analysis", promptVersion: CV_EXPLAIN_PROMPT, schema: aiExplanationSchema, ...explainPrompt(facts), cacheKey: [JSON.stringify(facts)] });
      const guarded = guardExplanation(run.value, facts, `${job.title}\n${job.description}`);
      return json({ ...guarded, cached: run.cached, remaining: run.remaining, model: run.model });
    } catch (error) {
      if (error instanceof AiLimitError) {
        const response = failure(error.code, error.message, 429);
        if (error.retryAfter) response.headers.set("Retry-After", String(error.retryAfter));
        return response;
      }
      if (error instanceof AiError) return error.code === "AI_TIMEOUT" ? failure("AI_TIMEOUT", "The AI took too long. Please try again.", 504) : failure("AI_UNAVAILABLE", "The AI could not explain this right now. Your score and next steps are complete without it.", 503);
      return failure("ANALYSIS_UNAVAILABLE", "The analysis could not be completed. Please try again.", 503);
    }
  }
  return { POST };
}
