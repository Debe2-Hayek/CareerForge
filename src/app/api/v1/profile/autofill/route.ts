import { profileAutofillHandlers } from "@/lib/ai/handlers";
import { aiProvider, authorizeAi } from "@/lib/ai/server";

// PDF parsing needs Node APIs; responses are private to the signed-in owner.
export const runtime = "nodejs";
export const maxDuration = 60;
export const { POST } = profileAutofillHandlers(authorizeAi, aiProvider);
