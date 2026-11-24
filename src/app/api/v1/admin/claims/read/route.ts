import { textReadHandlers } from "@/lib/claims/handlers";
import { authorizeReview, runTextRead } from "@/lib/claims/server";

// OCR of a page takes a few seconds; the first run on a new server also loads the language data.
export const maxDuration = 60;
export const { POST } = textReadHandlers(async () => {
  const review = await authorizeReview();
  if (!review) return null;
  return { userId: review.userId, read: (evidenceId: string) => runTextRead(review.client, evidenceId) };
});
