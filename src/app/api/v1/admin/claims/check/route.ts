import { claimCheckHandlers, ClaimError } from "@/lib/claims/handlers";
import { authorizeReview, runEvidenceCheck } from "@/lib/claims/server";
import { aiProvider, authorizeAi } from "@/lib/ai/server";

export const maxDuration = 60;
export const { POST } = claimCheckHandlers(async () => {
  const review = await authorizeReview();
  if (!review) return null;
  return {
    userId: review.userId,
    async check(evidenceId: string) {
      const provider = aiProvider();
      if (!provider) throw new ClaimError("AI_NOT_CONFIGURED", "The AI is not configured. Review the file yourself.", 501);
      const ai = await authorizeAi();
      if (!ai) throw new ClaimError("FORBIDDEN", "Reviewer access is required.", 403);
      return runEvidenceCheck(review.client, ai.runs, provider, evidenceId);
    }
  };
});
