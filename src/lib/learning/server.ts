import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCourse } from "./catalog";
import { toSnapshot, type EnrollmentInput, type LearningSnapshot, type ProgressInput } from "./api";
import { LearningError, type LearningAccess } from "./handlers";

// All reads and writes use the signed-in user's Supabase session, so RLS and
// column grants (supabase/migrations/202611210001_learning_progress.sql) apply.

const enrollmentColumns = "course_id,goal_id,experience_level,weekly_hours,resource_format,content_version,started_at,last_active_at";
const progressColumns = "course_id,item_kind,item_id,state,evidence_url";

export async function readLearningSnapshot(client: SupabaseClient, userId: string): Promise<LearningSnapshot> {
  const [enrollments, progress] = await Promise.all([
    client.from("learning_enrollments").select(enrollmentColumns).eq("user_id", userId).order("last_active_at", { ascending: false }).limit(50),
    client.from("learning_progress").select(progressColumns).eq("user_id", userId).limit(2000)
  ]);
  if (enrollments.error || progress.error) throw new Error("Learning progress unavailable");
  return toSnapshot(enrollments.data ?? [], progress.data ?? []);
}

export function learningAccess(client: SupabaseClient, userId: string): LearningAccess {
  return {
    userId,
    snapshot: () => readLearningSnapshot(client, userId),
    async enroll(input: EnrollmentInput) {
      const version = getCourse(input.courseId)?.version ?? 1;
      const settings = { goal_id: input.goalId, experience_level: input.level, weekly_hours: input.weeklyHours, resource_format: input.format, content_version: version };
      // Update-then-insert rather than upsert: clients may not rewrite owner/course columns.
      const updated = await client.from("learning_enrollments").update(settings).eq("user_id", userId).eq("course_id", input.courseId).select("course_id");
      if (updated.error) throw updated.error;
      if (updated.data?.length) return;
      const inserted = await client.from("learning_enrollments").insert({ user_id: userId, course_id: input.courseId, ...settings });
      if (inserted.error?.code === "23505") {
        const retry = await client.from("learning_enrollments").update(settings).eq("user_id", userId).eq("course_id", input.courseId);
        if (retry.error) throw retry.error;
        return;
      }
      if (inserted.error) throw inserted.error;
    },
    async saveProgress(input: ProgressInput) {
      const version = getCourse(input.courseId)?.version ?? 1;
      const key = <Query extends { eq: (column: string, value: string) => Query }>(query: Query) =>
        query.eq("user_id", userId).eq("course_id", input.courseId).eq("item_kind", input.kind).eq("item_id", input.itemId);
      if (input.state === null) {
        const removed = await key(client.from("learning_progress").delete());
        if (removed.error) throw removed.error;
        return;
      }
      const evidence = input.kind === "project" ? input.evidenceUrl ?? null : null;
      const values = { state: input.state, evidence_url: evidence, content_version: version };
      const updated = await key(client.from("learning_progress").update(values)).select("item_id");
      if (updated.error) throw updated.error;
      if (updated.data?.length) return;
      const inserted = await client.from("learning_progress").insert({ user_id: userId, course_id: input.courseId, item_kind: input.kind, item_id: input.itemId, ...values });
      if (inserted.error?.code === "23503") throw new LearningError("NOT_ENROLLED", "Start this learning path before tracking progress.", 409);
      if (inserted.error?.code === "23505") {
        const retry = await key(client.from("learning_progress").update(values));
        if (retry.error) throw retry.error;
        return;
      }
      if (inserted.error) throw inserted.error;
    }
  };
}

export async function authorizeLearning(): Promise<LearningAccess | null> {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error) {
    if (error.status === 400 || error.status === 401 || error.name === "AuthSessionMissingError") return null;
    throw new Error("Session verification unavailable");
  }
  return user ? learningAccess(client, user.id) : null;
}
