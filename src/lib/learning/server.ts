import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { defaultGoal, getRoadmap } from "@/lib/roadmaps/catalog";
import { toSnapshot, type EnrollmentInput, type LearningSnapshot, type ProgressInput } from "./api";
import type { LearningAccess } from "./handlers";

// All reads and writes use the signed-in user's Supabase session, so RLS and
// column grants (supabase/migrations/202611210001_learning_progress.sql) apply.

const enrollmentColumns = "course_id,goal_id,experience_level,weekly_hours,resource_format,content_version,started_at,last_active_at";
const progressColumns = "course_id,item_kind,item_id,state,evidence_url";

const progressPage = 1000;
/** The database returns at most 1,000 rows per request, so active learners need paging. */
async function readAllProgress(client: SupabaseClient, userId: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let from = 0; from < progressPage * 5; from += progressPage) {
    const page = await client.from("learning_progress").select(progressColumns).eq("user_id", userId)
      .order("course_id").order("item_kind").order("item_id").range(from, from + progressPage - 1);
    if (page.error) throw new Error("Learning progress unavailable");
    rows.push(...(page.data ?? []));
    if ((page.data?.length ?? 0) < progressPage) break;
  }
  return rows;
}

export async function readLearningSnapshot(client: SupabaseClient, userId: string): Promise<LearningSnapshot> {
  const [enrollments, progress] = await Promise.all([
    client.from("learning_enrollments").select(enrollmentColumns).eq("user_id", userId).order("last_active_at", { ascending: false }).limit(100),
    readAllProgress(client, userId)
  ]);
  if (enrollments.error) throw new Error("Learning progress unavailable");
  return toSnapshot(enrollments.data ?? [], progress);
}

export function learningAccess(client: SupabaseClient, userId: string): LearningAccess {
  /** Marking the first topic or project starts the roadmap: no setup form needed. */
  async function ensureStarted(courseId: string) {
    const roadmap = getRoadmap(courseId);
    if (!roadmap) throw new Error("Unknown roadmap");
    const inserted = await client.from("learning_enrollments").insert({
      user_id: userId, course_id: courseId, goal_id: defaultGoal(roadmap),
      experience_level: "new", weekly_hours: 6, resource_format: "mixed", content_version: roadmap.version
    });
    // A simultaneous first mark may have started it already.
    if (inserted.error && inserted.error.code !== "23505") throw inserted.error;
  }
  return {
    userId,
    snapshot: () => readLearningSnapshot(client, userId),
    async enroll(input: EnrollmentInput) {
      const version = getRoadmap(input.courseId)?.version ?? 1;
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
    async resetProgress(courseId: string) {
      // Progress rows cascade, so the roadmap looks as if it had never been started.
      const removed = await client.from("learning_enrollments").delete().eq("user_id", userId).eq("course_id", courseId);
      if (removed.error) throw removed.error;
    },
    async saveProgress(input: ProgressInput) {
      const version = getRoadmap(input.courseId)?.version ?? 1;
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
      const insert = () => client.from("learning_progress").insert({ user_id: userId, course_id: input.courseId, item_kind: input.kind, item_id: input.itemId, ...values });
      let inserted = await insert();
      if (inserted.error?.code === "23503") {
        await ensureStarted(input.courseId);
        inserted = await insert();
      }
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
