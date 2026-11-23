import { z } from "zod";
import { failure, isSameOrigin, json } from "../account/http";
import { readBoundedJson } from "../account/request-body";
import { AiError, type AiProvider } from "../ai/provider";
import { AiLimitError, runAi, type AiRunStore } from "../ai/runner";
import type { CareerDetail } from "./score";
import { CAREER_EXPLAIN_PROMPT, aiCareerSchema, careerFacts, careerPrompt, guardCareer } from "./explain";

export type CareerExplainAccess = { detail(careerId: string): Promise<{ detail: CareerDetail; headline: string } | null>; runs: AiRunStore };
const requestSchema = z.object({ careerId: z.string().regex(/^[a-z0-9-]{1,60}$/) }).strict();

/** POST /api/v1/career-analysis/explain: recompute the match on the server, then let the AI explain it. */
export function careerExplainHandlers(authorize: () => Promise<CareerExplainAccess | null>, provider: () => AiProvider | null) {
  async function POST(request: Request) {
    if (!isSameOrigin(request)) return failure("FORBIDDEN", "This request must come from CareerForge.", 403);
    let access: CareerExplainAccess | null;
    try { access = await authorize(); }
    catch { return failure("AUTH_UNAVAILABLE", "Your session could not be verified. Please try again.", 503); }
    if (!access) return failure("UNAUTHORIZED", "Sign in to analyse a career.", 401);
    const input = requestSchema.safeParse(await readBoundedJson(request, 1024));
    if (!input.success) return failure("INVALID_INPUT", "Choose a career.", 400);
    const ai = provider();
    if (!ai) return failure("AI_NOT_CONFIGURED", "The AI explanation is not available right now. Your match and gap list are complete without it.", 501);
    try {
      const found = await access.detail(input.data.careerId);
      if (!found) return failure("NOT_FOUND", "This career is not available.", 404);
      const facts = careerFacts(found.detail, found.headline);
      const run = await runAi(access.runs, ai, { feature: "career_analysis", promptVersion: CAREER_EXPLAIN_PROMPT, schema: aiCareerSchema, ...careerPrompt(facts), cacheKey: [JSON.stringify(facts)] });
      return json({ ...guardCareer(run.value, facts), cached: run.cached, remaining: run.remaining, model: run.model });
    } catch (error) {
      if (error instanceof AiLimitError) {
        const response = failure(error.code, error.message, 429);
        if (error.retryAfter) response.headers.set("Retry-After", String(error.retryAfter));
        return response;
      }
      if (error instanceof AiError) return error.code === "AI_TIMEOUT" ? failure("AI_TIMEOUT", "The AI took too long. Please try again.", 504) : failure("AI_UNAVAILABLE", "The AI could not explain this right now. Your match and gap list are complete without it.", 503);
      return failure("ANALYSIS_UNAVAILABLE", "The analysis could not be completed. Please try again.", 503);
    }
  }
  return { POST };
}
