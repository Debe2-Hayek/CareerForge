import { z } from "zod";
import { failure, isSameOrigin, json } from "../account/http";
import { readBoundedJson } from "../account/request-body";
import { privateWriteLimit } from "../account/attempt-limit";
import { AiError } from "../ai/provider";
import { AiLimitError } from "../ai/runner";
import { RepoError, parseRepoUrl, type RepoRef } from "./github";

export class InterviewError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}
const id = z.uuid();
const answersSchema = z.record(z.string().regex(/^q[1-5]$/), z.string().max(1500)).refine(value => Object.keys(value).length <= 5);
export const studentActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), repoUrl: z.string().trim().min(10).max(300) }).strict(),
  z.object({ action: z.literal("prepare"), id }).strict(),
  z.object({ action: z.literal("start"), id }).strict(),
  z.object({ action: z.literal("submit"), id, answers: answersSchema }).strict()
]);
export const adminActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("review"), id }).strict(),
  z.object({ action: z.literal("decide"), id, decision: z.enum(["approve", "reject"]), note: z.string().trim().max(500).default("") }).strict()
    .refine(value => value.decision === "approve" || value.note.length > 0, { message: "A reason is required to reject." })
]);
export type StudentAccess = {
  userId: string;
  create(repo: RepoRef): Promise<string>;
  prepare(interviewId: string): Promise<unknown>;
  start(interviewId: string): Promise<unknown>;
  submit(interviewId: string, answers: Record<string, string>): Promise<string>;
};
export type AdminAccess = { userId: string; review(interviewId: string): Promise<unknown>; decide(interviewId: string, decision: "approve" | "reject", note: string): Promise<string> };

function mapError(error: unknown) {
  if (error instanceof InterviewError) return failure(error.code, error.message, error.status);
  if (error instanceof RepoError) return failure(`REPO_${error.code}`, error.message, error.code === "RATE_LIMITED" ? 429 : error.code === "UNAVAILABLE" ? 503 : 422);
  if (error instanceof AiLimitError) {
    const response = failure(error.code, error.message, 429);
    if (error.retryAfter) response.headers.set("Retry-After", String(error.retryAfter));
    return response;
  }
  if (error instanceof AiError) return error.code === "AI_TIMEOUT" ? failure("AI_TIMEOUT", "The AI took too long. Please try again.", 504) : failure("AI_UNAVAILABLE", "The AI is not available right now. Please try again later.", 503);
  return failure("INTERVIEWS_UNAVAILABLE", "That did not work. Please try again.", 503);
}

async function run<A extends { userId: string }>(request: Request, authorize: () => Promise<A | null>, unauthorised: Response, schema: z.ZodType<unknown>, act: (access: A, input: never) => Promise<Response>) {
  if (!isSameOrigin(request)) return failure("FORBIDDEN", "This request must come from CareerForge.", 403);
  let access: A | null;
  try { access = await authorize(); }
  catch { return failure("AUTH_UNAVAILABLE", "Your session could not be verified. Please try again.", 503); }
  if (!access) return unauthorised;
  const input = schema.safeParse(await readBoundedJson(request, 16384));
  if (!input.success) return failure("INVALID_INPUT", "Check the request and try again.", 400);
  const wait = privateWriteLimit("claims", access.userId);
  if (wait) { const response = failure("RATE_LIMITED", "Too many requests. Please wait a moment.", 429); response.headers.set("Retry-After", String(wait)); return response; }
  try { return await act(access, input.data as never); } catch (error) { return mapError(error); }
}

/** POST /api/v1/project-interviews */
export function studentInterviewHandlers(authorize: () => Promise<StudentAccess | null>) {
  return {
    POST: (request: Request) => run(request, authorize, failure("UNAUTHORIZED", "Sign in to prove a project.", 401), studentActionSchema, async (access, input: z.infer<typeof studentActionSchema>) => {
      if (input.action === "create") {
        const repo = parseRepoUrl(input.repoUrl);
        if (!repo) return failure("INVALID_REPO", "Paste the address of a public GitHub repository, like https://github.com/you/project.", 400);
        return json({ id: await access.create(repo) }, 201);
      }
      if (input.action === "prepare") return json(await access.prepare(input.id));
      if (input.action === "start") return json(await access.start(input.id));
      return json({ status: await access.submit(input.id, input.answers) });
    })
  };
}

/** POST /api/v1/admin/interviews */
export function adminInterviewHandlers(authorize: () => Promise<AdminAccess | null>) {
  return {
    POST: (request: Request) => run(request, authorize, failure("FORBIDDEN", "Reviewer access is required.", 403), adminActionSchema, async (access, input: z.infer<typeof adminActionSchema>) => {
      if (input.action === "review") return json({ review: await access.review(input.id) });
      return json({ status: await access.decide(input.id, input.decision, input.note) });
    })
  };
}
