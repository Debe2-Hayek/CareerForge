import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authorizeReview } from "./claims/server";
import { aiProvider, authorizeAi } from "./ai/server";
import { runAi } from "./ai/runner";
import { DraftError, type DraftAccess } from "./skill-check-drafts-handlers";
import {
  aiDraftSchema, bankOverviewSchema, draftRowSchema, reviewDraft, skillDraftPrompt, SKILL_DRAFT_PROMPT,
  type BankOverview, type DraftRow
} from "./skill-check-drafts";

const columns = "id,skill,focus,questions,status,model,created_at,updated_at,published_version";

/** Any partial question becomes the editor's shape: prompt, 3 options, answer 0-2, explanation. */
function normalise(questions: unknown[]) {
  return questions.slice(0, 10).map(raw => {
    const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const options = Array.isArray(item.options) ? item.options.map(option => String(option ?? "").slice(0, 160)) : [];
    const answer = typeof item.answer === "number" && Number.isInteger(item.answer) && item.answer >= 0 && item.answer <= 2 ? item.answer : 0;
    return { prompt: String(item.prompt ?? "").slice(0, 300), options: [0, 1, 2].map(index => options[index] ?? ""), answer, explanation: String(item.explanation ?? "").slice(0, 400) };
  });
}
function rpcFailure(error: { code?: string; message?: string }): never {
  if (error.code === "P0002") throw new DraftError("NOT_FOUND", "This draft was already published or discarded. Reload the page.", 404);
  if (error.code === "23514") throw new DraftError("INCOMPLETE", "The questions are not complete yet.", 422);
  if (error.code === "42501") throw new DraftError("FORBIDDEN", "Reviewer access is required.", 403);
  throw new Error("Drafts storage unavailable");
}
async function readDraft(client: SupabaseClient, id: string): Promise<DraftRow> {
  const { data, error } = await client.from("skill_check_drafts").select(columns).eq("id", id).maybeSingle();
  if (error) throw new Error("Drafts unavailable");
  if (!data) throw new DraftError("NOT_FOUND", "This draft no longer exists. Reload the page.", 404);
  return draftRowSchema.parse(data);
}

export async function authorizeDrafts(): Promise<DraftAccess | null> {
  const review = await authorizeReview();
  if (!review) return null;
  const { client } = review;
  return {
    userId: review.userId,
    async run(action) {
      if (action.action === "generate") {
        const provider = aiProvider();
        if (!provider) throw new DraftError("AI_NOT_CONFIGURED", "The AI is not configured. Write the questions yourself.", 501);
        const ai = await authorizeAi();
        if (!ai) throw new DraftError("FORBIDDEN", "Reviewer access is required.", 403);
        const prompt = skillDraftPrompt(action.skill, action.focus);
        const run = await runAi(ai.runs, provider, { feature: "skill_bank_draft", promptVersion: SKILL_DRAFT_PROMPT, schema: aiDraftSchema, ...prompt, cacheKey: [action.skill.toLowerCase(), action.focus.toLowerCase()] });
        const questions = normalise(run.value.questions);
        const { data, error } = await client.rpc("save_skill_check_draft", { p_id: null, p_skill: action.skill, p_focus: action.focus, p_questions: questions, p_model: run.model ?? "cached" });
        if (error) rpcFailure(error);
        return { draft: await readDraft(client, z.uuid().parse(data)) };
      }
      if (action.action === "create") {
        // Writing questions by hand works without any AI.
        const { data, error } = await client.rpc("save_skill_check_draft", { p_id: null, p_skill: action.skill, p_focus: action.focus, p_questions: normalise([{}, {}, {}, {}, {}]), p_model: null });
        if (error) rpcFailure(error);
        return { draft: await readDraft(client, z.uuid().parse(data)) };
      }
      if (action.action === "save") {
        const { error } = await client.rpc("save_skill_check_draft", { p_id: action.id, p_skill: "", p_focus: "", p_questions: normalise(action.questions), p_model: null });
        if (error) rpcFailure(error);
        return { draft: await readDraft(client, action.id) };
      }
      if (action.action === "publish") {
        const draft = await readDraft(client, action.id);
        const review = reviewDraft(draft.questions);
        if (review.errors.length) throw new DraftError("INCOMPLETE", "Fix these before publishing.", 422, review.errors);
        const { data, error } = await client.rpc("publish_skill_check_draft", { p_id: action.id });
        if (error) rpcFailure(error);
        return { published: z.object({ skill: z.string(), version: z.number() }).parse(data) };
      }
      const { error } = await client.rpc("discard_skill_check_draft", { p_id: action.id });
      if (error) rpcFailure(error);
      return { discarded: true };
    }
  };
}

/** Admin page data: open drafts, recent publications and what is live. */
export async function readDraftsOverview(client: SupabaseClient): Promise<{ drafts: DraftRow[]; live: BankOverview[] }> {
  const [drafts, live] = await Promise.all([
    client.from("skill_check_drafts").select(columns).neq("status", "discarded").order("updated_at", { ascending: false }).limit(30),
    client.rpc("skill_check_bank_overview")
  ]);
  if (drafts.error || live.error) throw new Error("Drafts unavailable");
  return { drafts: z.array(draftRowSchema).parse(drafts.data ?? []), live: bankOverviewSchema.parse(live.data ?? []) };
}
