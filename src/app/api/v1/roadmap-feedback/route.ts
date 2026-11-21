import { feedbackHandlers } from "@/lib/product-signals";
import { authorizeProductSignals, readFeedbackCounts } from "@/lib/product-signals-server";

const handlers = feedbackHandlers(authorizeProductSignals, readFeedbackCounts);
export const { GET, POST } = handlers;
