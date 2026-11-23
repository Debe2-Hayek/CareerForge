import { assistantHandlers } from "@/lib/assistant/handlers";
import { assistantProvider, readAssistantData } from "@/lib/assistant/server";
import { signedInClient } from "@/lib/cv-analysis/server";
import { authorizeAi } from "@/lib/ai/server";

export const maxDuration = 60;
export const { POST } = assistantHandlers(async () => {
  const session = await signedInClient();
  if (!session) return null;
  const ai = await authorizeAi();
  if (!ai) return null;
  return { runs: ai.runs, data: () => readAssistantData(session.client, session.userId) };
}, assistantProvider);
