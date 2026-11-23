import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { signedInClient } from "../cv-analysis/server";
import { authorizeReview } from "../claims/server";
import { aiProvider, authorizeAi } from "../ai/server";
import { runAi } from "../ai/runner";
import { githubFetchers, quoteLines, readRepo } from "./github";
import { fakeGithubFetchers } from "./fake-github";
import { INTERVIEW_QUESTIONS_PROMPT, INTERVIEW_REVIEW_PROMPT, aiQuestionsSchema, aiReviewSchema, buildQuestions, questionSchema, questionsPrompt, reviewPrompt, summariseReview } from "./ai";
import { InterviewError, type AdminAccess, type StudentAccess } from "./handlers";

const ownColumns = "id,repo_owner,repo_name,ownership_code,commit_sha,questions,status,started_at,deadline_at,submitted_at,answers,decision_note,decided_at,created_at";
export const interviewRowSchema = z.object({
  id: z.uuid(), repo_owner: z.string(), repo_name: z.string(), ownership_code: z.string(), commit_sha: z.string().nullable(),
  questions: z.array(questionSchema).nullable(), status: z.enum(["draft", "ready", "in_progress", "submitted", "approved", "rejected", "expired"]),
  started_at: z.string().nullable(), deadline_at: z.string().nullable(), submitted_at: z.string().nullable(), answers: z.record(z.string(), z.string()).nullable(),
  decision_note: z.string().nullable(), decided_at: z.string().nullable(), created_at: z.string()
});
export type InterviewRow = z.infer<typeof interviewRowSchema>;

function rpcFailure(error: { code?: string; message?: string }): never {
  if (error.code === "23514" && /Too many/.test(error.message ?? "")) throw new InterviewError("TOO_MANY", "You can have 3 open interviews. Finish or wait for review first.", 409);
  if (error.code === "23514") throw new InterviewError("WRONG_STATE", "This interview is not at that step any more. Reload the page.", 409);
  if (error.code === "P0002") throw new InterviewError("NOT_FOUND", "This interview was not found. Reload the page.", 404);
  if (error.code === "42501") throw new InterviewError("FORBIDDEN", /own claims/.test(error.message ?? "") ? "You cannot review your own interview." : "Reviewer access is required.", 403);
  if (error.code === "22023") throw new InterviewError("INVALID_INPUT", "Check the request and try again.", 400);
  throw new Error("Interviews storage unavailable");
}
// The development test GitHub follows the same switch as the test AI, and never runs in production or on Vercel.
const fakeGithub = () => process.env.AI_FAKE === "1" && process.env.NODE_ENV !== "production" && !process.env.VERCEL;
const fetchers = (code: string | null) => fakeGithub() ? fakeGithubFetchers(code) : githubFetchers(process.env.GITHUB_TOKEN?.trim() || undefined);

export async function readOwnInterviews(client: SupabaseClient, userId: string): Promise<InterviewRow[]> {
  const { data, error } = await client.from("project_interviews").select(ownColumns).eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
  if (error) throw new Error("Interviews unavailable");
  return z.array(interviewRowSchema).parse(data ?? []);
}

export async function authorizeStudentInterviews(): Promise<StudentAccess | null> {
  const session = await signedInClient();
  if (!session) return null;
  const { client, userId } = session;
  const own = async (interviewId: string) => {
    const { data, error } = await client.from("project_interviews").select(ownColumns).eq("id", interviewId).eq("user_id", userId).maybeSingle();
    if (error) throw new Error("Interviews unavailable");
    if (!data) throw new InterviewError("NOT_FOUND", "This interview was not found. Reload the page.", 404);
    return interviewRowSchema.parse(data);
  };
  return {
    userId,
    async create(repo) {
      const { data, error } = await client.rpc("create_project_interview", { p_owner: repo.owner, p_name: repo.name });
      if (error) rpcFailure(error);
      return z.uuid().parse(data);
    },
    async prepare(interviewId) {
      const row = await own(interviewId);
      if (row.status !== "draft" && row.status !== "ready") throw new InterviewError("WRONG_STATE", "Questions can only be prepared before the interview starts.", 409);
      const snapshot = await readRepo({ owner: row.repo_owner, name: row.repo_name }, row.ownership_code, fetchers(row.ownership_code));
      if (!snapshot.ownershipFound) throw new InterviewError("OWNERSHIP_NOT_FOUND", `The code ${row.ownership_code} was not found in the repository's README or a .careerforge file on the default branch. Add it, push, and try again.`, 422);
      const provider = aiProvider();
      if (!provider) throw new InterviewError("AI_NOT_CONFIGURED", "The AI is not available right now, so questions cannot be prepared. Try again later.", 501);
      const ai = await authorizeAi();
      if (!ai) throw new InterviewError("UNAUTHORIZED", "Sign in again.", 401);
      const run = await runAi(ai.runs, provider, { feature: "interview_questions", promptVersion: INTERVIEW_QUESTIONS_PROMPT, schema: aiQuestionsSchema, ...questionsPrompt(snapshot.files), cacheKey: [snapshot.sha] });
      const questions = buildQuestions(run.value, snapshot.files);
      if (questions.length < 3) throw new InterviewError("TOO_FEW_QUESTIONS", "Not enough good questions could be prepared from this code. Try a repository with more of your own code.", 422);
      const { error } = await client.rpc("prepare_project_interview", { p_id: interviewId, p_commit: snapshot.sha, p_questions: questions });
      if (error) rpcFailure(error);
      return { status: "ready", questions: questions.length, commit: snapshot.sha };
    },
    async start(interviewId) {
      const { data, error } = await client.rpc("start_project_interview", { p_id: interviewId });
      if (error) rpcFailure(error);
      return data;
    },
    async submit(interviewId, answers) {
      const { data, error } = await client.rpc("submit_project_interview", { p_id: interviewId, p_answers: answers });
      if (error) rpcFailure(error);
      return z.string().parse(data);
    }
  };
}

export const queueItemSchema = z.object({
  id: z.uuid(), ownerName: z.string(), own: z.boolean(), repoOwner: z.string(), repoName: z.string(), ownershipCode: z.string(),
  commitSha: z.string().nullable(), questions: z.array(questionSchema).nullable(), answers: z.record(z.string(), z.string()).nullable(),
  startedAt: z.string().nullable(), submittedAt: z.string().nullable(), aiReview: z.unknown().nullable(), aiReviewedAt: z.string().nullable()
});
export type InterviewQueueItem = z.infer<typeof queueItemSchema>;

export async function readInterviewQueue(client: SupabaseClient): Promise<InterviewQueueItem[]> {
  const { data, error } = await client.rpc("project_interview_queue");
  if (error) throw new Error("Interview queue unavailable");
  return z.array(queueItemSchema).parse(data ?? []);
}

export async function authorizeAdminInterviews(): Promise<AdminAccess | null> {
  const review = await authorizeReview();
  if (!review) return null;
  const { client } = review;
  return {
    userId: review.userId,
    async review(interviewId) {
      const item = (await readInterviewQueue(client)).find(entry => entry.id === interviewId);
      if (!item || !item.questions || !item.commitSha) throw new InterviewError("NOT_FOUND", "This interview is no longer waiting for review.", 404);
      // Re-read the repository at the recorded commit from the reviewer's side: forged questions or a
      // missing ownership code show up here, whatever the owner's browser sent earlier.
      const snapshot = await readRepo({ owner: item.repoOwner, name: item.repoName }, item.ownershipCode, fetchers(item.ownershipCode), item.commitSha);
      const citations = item.questions.map(question => {
        const file = snapshot.files.find(entry => entry.path === question.file);
        return { id: question.id, ok: !!file && quoteLines(file.text, question.startLine, question.endLine) === question.quote };
      });
      const context = Object.fromEntries(item.questions.map(question => {
        const file = snapshot.files.find(entry => entry.path === question.file);
        const lines = file?.text.split("\n") ?? [];
        return [question.id, lines.slice(Math.max(0, question.startLine - 16), question.endLine + 15).join("\n") || question.quote];
      }));
      const provider = aiProvider();
      if (!provider) throw new InterviewError("AI_NOT_CONFIGURED", "The AI is not available right now. Review the answers yourself.", 501);
      const ai = await authorizeAi();
      if (!ai) throw new InterviewError("FORBIDDEN", "Reviewer access is required.", 403);
      const answers = item.answers ?? {};
      const run = await runAi(ai.runs, provider, { feature: "interview_review", promptVersion: INTERVIEW_REVIEW_PROMPT, schema: aiReviewSchema, ...reviewPrompt(item.questions, answers, context), cacheKey: [item.id, JSON.stringify(answers)] });
      const result = { ...summariseReview(run.value, item.questions, citations, run.model), ownership: snapshot.ownershipFound };
      const { error } = await client.rpc("record_interview_review", { p_id: interviewId, p_review: result });
      if (error) rpcFailure(error);
      return result;
    },
    async decide(interviewId, decision, note) {
      const { data, error } = await client.rpc("decide_project_interview", { p_id: interviewId, p_decision: decision, p_note: note });
      if (error) rpcFailure(error);
      return z.string().parse(data);
    }
  };
}
