import { linkCheckHandlers } from "@/lib/claims/handlers";
import { authorizeReview, runLinkCheck } from "@/lib/claims/server";

export const maxDuration = 30;
export const { POST } = linkCheckHandlers(async () => {
  const review = await authorizeReview();
  if (!review) return null;
  return { userId: review.userId, check: (linkId: string) => runLinkCheck(review.client, linkId) };
});
