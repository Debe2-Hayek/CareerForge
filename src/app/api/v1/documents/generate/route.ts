import { documentGenerateHandlers } from "@/lib/ai/handlers";
import { aiProvider, authorizeAi } from "@/lib/ai/server";

export const maxDuration = 60;
export const { POST } = documentGenerateHandlers(authorizeAi, aiProvider);
