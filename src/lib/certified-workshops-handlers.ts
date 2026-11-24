import { z } from "zod";
import { failure, isSameOrigin, json } from "./account/http";
import { readBoundedJson } from "./account/request-body";
import { privateWriteLimit } from "./account/attempt-limit";
import { workshopFieldsSchema, type WorkshopFields } from "./certified-workshops";

export class WorkshopError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}
export type LearnerAccess = { userId: string; enroll(workshopId: string, showName: boolean): Promise<void>; withdraw(workshopId: string): Promise<void> };
export type StaffAccess = {
  userId: string;
  mark(enrollmentId: string, attended: boolean, score: number | null): Promise<void>;
  issue(workshopId: string): Promise<number>;
  revoke(certificateId: string, reason: string): Promise<void>;
};
export type AdminAccess = { userId: string; save(id: string | null, fields: WorkshopFields): Promise<string>; assign(workshopId: string, email: string): Promise<boolean> };
type Limit = typeof privateWriteLimit;

async function begin<T extends { userId: string }>(request: Request, authorize: () => Promise<T | null>, limit: Limit, unauthorized: Response) {
  if (!isSameOrigin(request)) return failure("FORBIDDEN", "This request must come from CareerForge.", 403);
  let access: T | null;
  try { access = await authorize(); }
  catch { return failure("AUTH_UNAVAILABLE", "Your session could not be verified. Please try again.", 503); }
  if (!access) return unauthorized;
  const wait = limit("workshops", access.userId);
  if (wait) {
    const response = failure("RATE_LIMITED", "Too many requests. Please wait a moment and try again.", 429);
    response.headers.set("Retry-After", String(wait));
    return response;
  }
  return access;
}
function refused(error: unknown) {
  if (error instanceof WorkshopError) return failure(error.code, error.message, error.status);
  return failure("WORKSHOPS_UNAVAILABLE", "The change could not be saved. Please try again.", 503);
}

const learnerSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enroll"), workshopId: z.uuid(), showName: z.boolean() }).strict(),
  z.object({ action: z.literal("withdraw"), workshopId: z.uuid() }).strict()
]);
/** POST /api/v1/certified-workshops: a learner enrolls or withdraws. */
export function learnerWorkshopHandlers(authorize: () => Promise<LearnerAccess | null>, limit: Limit = privateWriteLimit) {
  async function POST(request: Request) {
    const access = await begin(request, authorize, limit, failure("UNAUTHORIZED", "Sign in to enroll.", 401));
    if (access instanceof Response) return access;
    const input = learnerSchema.safeParse(await readBoundedJson(request, 512));
    if (!input.success) return failure("INVALID_INPUT", "Choose a workshop.", 400);
    try {
      if (input.data.action === "enroll") await access.enroll(input.data.workshopId, input.data.showName);
      else await access.withdraw(input.data.workshopId);
      return json({ ok: true });
    } catch (error) { return refused(error); }
  }
  return { POST };
}

const staffSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark"), enrollmentId: z.uuid(), attended: z.boolean(), score: z.number().int().min(0).max(100).nullable().default(null) }).strict(),
  z.object({ action: z.literal("issue"), workshopId: z.uuid() }).strict(),
  z.object({ action: z.literal("revoke"), certificateId: z.uuid(), reason: z.string().trim().min(1).max(300) }).strict()
]);
/** POST /api/v1/certified-workshops/staff: attendance, issuing and revoking (the database checks the role per workshop). */
export function staffWorkshopHandlers(authorize: () => Promise<StaffAccess | null>, limit: Limit = privateWriteLimit) {
  async function POST(request: Request) {
    const access = await begin(request, authorize, limit, failure("UNAUTHORIZED", "Sign in first.", 401));
    if (access instanceof Response) return access;
    const input = staffSchema.safeParse(await readBoundedJson(request, 1024));
    if (!input.success) return failure("INVALID_INPUT", "Check the request. A reason (up to 300 characters) is required to revoke.", 400);
    try {
      if (input.data.action === "mark") { await access.mark(input.data.enrollmentId, input.data.attended, input.data.attended ? input.data.score : null); return json({ ok: true }); }
      if (input.data.action === "issue") return json({ issued: await access.issue(input.data.workshopId) });
      await access.revoke(input.data.certificateId, input.data.reason);
      return json({ ok: true });
    } catch (error) { return refused(error); }
  }
  return { POST };
}

const adminSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), id: z.uuid().nullable().default(null), fields: z.unknown() }).strict(),
  z.object({ action: z.literal("assign"), workshopId: z.uuid(), email: z.string().trim().max(254) }).strict()
]);
/** POST /api/v1/admin/certified-workshops: create or edit a workshop, assign its trainer. */
export function adminWorkshopHandlers(authorize: () => Promise<AdminAccess | null>, limit: Limit = privateWriteLimit) {
  async function POST(request: Request) {
    const access = await begin(request, authorize, limit, failure("FORBIDDEN", "Admin access is required.", 403));
    if (access instanceof Response) return access;
    const input = adminSchema.safeParse(await readBoundedJson(request, 8192));
    if (!input.success) return failure("INVALID_INPUT", "Check the request.", 400);
    try {
      if (input.data.action === "assign") {
        const email = input.data.email;
        if (email && !z.email().safeParse(email).success) return failure("INVALID_INPUT", "Enter the trainer's account email.", 400);
        return (await access.assign(input.data.workshopId, email)) ? json({ ok: true }) : failure("NO_ACCOUNT", "No CareerForge account uses this email. Ask the trainer to sign up first.", 404);
      }
      const fields = workshopFieldsSchema.safeParse(input.data.fields);
      if (!fields.success) {
        const issue = fields.error.issues[0];
        return failure("INVALID_INPUT", issue?.code === "custom" || issue?.path[0] === "title" ? issue.message : `Check the ${String(issue?.path[0] ?? "form")} field.`, 400);
      }
      return json({ id: await access.save(input.data.id, fields.data) }, input.data.id ? 200 : 201);
    } catch (error) { return refused(error); }
  }
  return { POST };
}
