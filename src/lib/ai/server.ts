import "server-only";
import { createClient } from "../supabase/server";
import { providerFromEnv, type AiProvider } from "./provider";
import type { AiAccess } from "./handlers";
import type { AiFeature, Reservation } from "./runner";

/** OpenRouter (OPENROUTER_API_KEY, or an sk-or- key) or DeepSeek directly (DEEPSEEK_API_KEY). Server-only. */
export function aiProvider(): AiProvider | null {
  return providerFromEnv(process.env)?.provider ?? null;
}

/** Signed-in user plus the owner-scoped AI ledger RPCs. */
export async function authorizeAi(): Promise<AiAccess | null> {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error) {
    if (error.status === 400 || error.status === 401 || error.name === "AuthSessionMissingError") return null;
    throw new Error("Session verification unavailable");
  }
  if (!user) return null;
  return {
    userId: user.id,
    runs: {
      async reserve(feature: AiFeature, inputHash: string, promptVersion: string) {
        const { data, error } = await client.rpc("reserve_ai_run", { p_feature: feature, p_input_hash: inputHash, p_prompt_version: promptVersion });
        if (error || !data || typeof data !== "object") throw new Error("AI ledger unavailable");
        return data as Reservation;
      },
      async finish(runId: string, model: string | null, output: unknown | null) {
        const { error } = await client.rpc("finish_ai_run", { p_run_id: runId, p_model: model, p_output: output });
        if (error) throw new Error("AI ledger unavailable");
      }
    }
  };
}
