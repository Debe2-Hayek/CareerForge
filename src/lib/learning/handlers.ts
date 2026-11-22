import { failure, isSameOrigin, json } from "@/lib/account/http";
import { readBoundedJson } from "@/lib/account/request-body";
import { privateWriteLimit } from "@/lib/account/attempt-limit";
import { enrollmentInputSchema, progressInputSchema, resetInputSchema, validateAgainstCatalog, type EnrollmentInput, type LearningSnapshot, type ProgressInput } from "./api";
import { getRoadmap } from "@/lib/roadmaps/catalog";

export class LearningError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}

export type LearningAccess = {
  userId: string;
  snapshot: () => Promise<LearningSnapshot>;
  enroll: (input: EnrollmentInput) => Promise<void>;
  saveProgress: (input: ProgressInput) => Promise<void>;
  /** Removes one roadmap from the learner's list together with every topic and project record. */
  resetProgress: (courseId: string) => Promise<void>;
};

export function learningHandlers(authorize: () => Promise<LearningAccess | null>, limit = privateWriteLimit) {
  const unavailable = () => failure("LEARNING_UNAVAILABLE", "Your learning progress could not be saved or loaded. Your roadmap is unchanged; please retry.", 503);
  async function run(request: Request, action: (access: LearningAccess) => Promise<Response>) {
    if (request.method !== "GET" && !isSameOrigin(request)) return failure("FORBIDDEN", "This request must come from CareerForge.", 403);
    try {
      const access = await authorize();
      if (!access) return failure("UNAUTHORIZED", "Sign in to save your learning progress.", 401);
      return await action(access);
    } catch (error) {
      if (error instanceof LearningError) return failure(error.code, error.message, error.status);
      return unavailable();
    }
  }
  function limited(access: LearningAccess) {
    const wait = limit("learning", access.userId);
    if (!wait) return null;
    const response = failure("RATE_LIMITED", "Too many learning updates. Wait a moment and retry.", 429);
    response.headers.set("Retry-After", String(wait));
    return response;
  }
  return {
    GET: (request: Request) => run(request, async access => {
      if (new URL(request.url).search) return failure("INVALID_INPUT", "This endpoint takes no parameters.", 400);
      return json(await access.snapshot());
    }),
    enroll: (request: Request) => run(request, async access => {
      const parsed = enrollmentInputSchema.safeParse(await readBoundedJson(request, 1024));
      if (!parsed.success) return failure("INVALID_INPUT", "Choose a learning goal, experience level, weekly hours (1–40) and format.", 400);
      const unknown = validateAgainstCatalog(parsed.data);
      if (unknown) return failure("INVALID_INPUT", unknown, 400);
      const denied = limited(access);
      if (denied) return denied;
      await access.enroll(parsed.data);
      return json({ saved: true });
    }),
    reset: (request: Request) => run(request, async access => {
      const parsed = resetInputSchema.safeParse(await readBoundedJson(request, 256));
      if (!parsed.success || !getRoadmap(parsed.data.courseId)) return failure("INVALID_INPUT", "Choose a learning path and confirm the reset.", 400);
      const denied = limited(access);
      if (denied) return denied;
      await access.resetProgress(parsed.data.courseId);
      return json({ reset: true });
    }),
    progress: (request: Request) => run(request, async access => {
      const parsed = progressInputSchema.safeParse(await readBoundedJson(request, 1024));
      if (!parsed.success) return failure("INVALID_INPUT", "Check the topic or project and its new state. Links must be public https:// URLs.", 400);
      const unknown = validateAgainstCatalog(parsed.data);
      if (unknown) return failure("INVALID_INPUT", unknown, 400);
      const denied = limited(access);
      if (denied) return denied;
      await access.saveProgress(parsed.data);
      return json({ saved: true });
    })
  };
}
