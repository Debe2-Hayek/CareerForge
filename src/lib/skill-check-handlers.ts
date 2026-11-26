import { z } from "zod";
import { failure, isSameOrigin, json } from "./account/http";
import { readBoundedJson } from "./account/request-body";
import { checkSubmission, QUESTION_COUNT, sessionActionSchema, sessionReplySchema, submissionResultSchema } from "./skill-checks";

export type SkillCheckAccess = {
  start: (input: Extract<z.infer<typeof sessionActionSchema>, { action: "start" }>) => Promise<unknown>;
  cancel: (sessionId: string) => Promise<unknown>;
  submit: (input: z.infer<typeof checkSubmission>) => Promise<unknown>;
};
const outcomeSchema = z.object({
  rateLimited: z.boolean().optional(), retryAfter: z.number().finite().optional(),
  expired: z.boolean().optional(), notFound: z.boolean().optional(),
  bankChanged: z.boolean().optional(), conflict: z.boolean().optional(), activeSkill: z.string().max(60).optional(),
  skillNotSelected: z.boolean().optional(), invalidInput: z.boolean().optional(), profileFull: z.boolean().optional(),
  cooldown: z.boolean().optional(), retryAt: z.string().optional()
});
function outcome(value: unknown) {
  const parsed = outcomeSchema.safeParse(value);
  if (!parsed.success) return null;
  const data = parsed.data;
  if (data.cooldown) {
    // A failed skill can be taken again 24 hours later; the page shows exactly when.
    const at = Date.parse(data.retryAt ?? "");
    const retryAt = Number.isFinite(at) ? new Date(at).toISOString() : null;
    const response = json({ error: { code: "TRY_LATER", message: "You can take this check again 24 hours after a failed attempt.", retryAt } }, 429);
    if (retryAt) response.headers.set("Retry-After", String(Math.max(1, Math.ceil((at - Date.now()) / 1000))));
    return response;
  }
  if (data.rateLimited) {
    const response = failure("RATE_LIMITED", "Wait a minute before starting or submitting another check.", 429);
    response.headers.set("Retry-After", String(Math.min(60, Math.max(1, Math.ceil(data.retryAfter ?? 60)))));
    return response;
  }
  if (data.notFound) return failure("NOT_FOUND", "This attempt is no longer open. Reload to see your checks.", 404);
  if (data.expired) return failure("CHECK_EXPIRED", "This attempt was left open for more than 24 hours, so it closed. No grade was recorded. Start it again when you are ready.", 410);
  if (data.bankChanged) return failure("CHECK_CHANGED", "The questions for this check were updated. Start it again to see the new ones.", 409);
  if (data.conflict) return failure("CHECK_ACTIVE", data.activeSkill ? `Your ${data.activeSkill} check is still open. Finish or end it first.` : "Another check is still open. Finish or end it first.", 409);
  if (data.skillNotSelected) return failure("SKILL_NOT_SELECTED", "Add this skill to your profile to take its check.", 400);
  if (data.profileFull) return failure("PROFILE_FULL", "Your profile already lists 40 skills. Remove one to add this skill.", 400);
  if (data.invalidInput) return failure("INVALID_INPUT", "Answer every question in an open attempt before submitting.", 400);
  return null;
}
const unavailable = () => failure("CHECK_UNAVAILABLE", "The check could not be reached. Reload to see where you are; nothing is graded twice.", 503);

export function skillCheckHandlers(authorize: () => Promise<SkillCheckAccess | null>) {
  return {
    async session(request: Request) {
      if (!isSameOrigin(request)) return failure("FORBIDDEN", "This request must come from CareerForge.", 403);
      try {
        const access = await authorize();
        if (!access) return failure("UNAUTHORIZED", "Sign in to take a skill check.", 401);
        const input = sessionActionSchema.safeParse(await readBoundedJson(request, 1024));
        if (!input.success) return failure("INVALID_INPUT", "Choose a skill that has a check.", 400);
        const data = input.data.action === "start" ? await access.start(input.data) : await access.cancel(input.data.sessionId);
        const error = outcome(data);
        if (error) return error;
        if (input.data.action === "cancel") {
          if (!z.object({ cancelled: z.literal(true) }).strict().safeParse(data).success) return unavailable();
          return json({ cancelled: true });
        }
        const result = sessionReplySchema.safeParse(data);
        const session = result.success ? result.data.session : null;
        if (!session || session.skill.toLowerCase() !== input.data.skill.trim().toLowerCase() || session.questions.length !== QUESTION_COUNT) return unavailable();
        return json({ session });
      } catch { return unavailable(); }
    },
    async submit(request: Request) {
      if (!isSameOrigin(request)) return failure("FORBIDDEN", "This request must come from CareerForge.", 403);
      try {
        const access = await authorize();
        if (!access) return failure("UNAUTHORIZED", "Sign in to take a skill check.", 401);
        const input = checkSubmission.safeParse(await readBoundedJson(request, 2048));
        if (!input.success) return failure("INVALID_INPUT", "Answer every question in an open attempt before submitting.", 400);
        const data = await access.submit(input.data);
        const error = outcome(data);
        if (error) return error;
        const result = submissionResultSchema.safeParse(data);
        return result.success ? json({ result: result.data }) : unavailable();
      } catch { return unavailable(); }
    }
  };
}
