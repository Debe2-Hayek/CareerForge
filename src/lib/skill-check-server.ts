import "server-only";
import { createClient } from "./supabase/server";
import type { SkillCheckAccess } from "./skill-check-handlers";

export async function authorizeSkillChecks(): Promise<SkillCheckAccess | null> {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error) {
    if (error.status === 400 || error.status === 401 || error.name === "AuthSessionMissingError") return null;
    throw new Error("Session verification unavailable");
  }
  if (!user) return null;
  async function rpc(name: string, args: Record<string, unknown>) {
    const { data, error } = await client.rpc(name, args);
    if (error?.code === "22023") return { invalidInput: true };
    if (error) throw new Error("Assessment operation unavailable");
    return data as unknown;
  }
  // Untimed checks (migration 202611260002): the server shuffles each attempt and maps answers back.
  return {
    start: input => rpc("start_untimed_skill_check", { p_skill: input.skill, p_add_to_profile: input.addToProfile ?? false }),
    cancel: sessionId => rpc("cancel_skill_check", { p_session_id: sessionId }),
    submit: input => rpc("submit_untimed_skill_check", { p_session_id: input.sessionId, p_answers: input.answers })
  };
}
