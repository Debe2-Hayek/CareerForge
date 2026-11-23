import { claimReviewHandlers } from "@/lib/claims/handlers";
import { authorizeReview } from "@/lib/claims/server";

export const { POST } = claimReviewHandlers(authorizeReview);
