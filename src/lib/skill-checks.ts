import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Any published skill (React and SQL were the first two); versions grow when admins publish new questions. */
const skillName = z.string().trim().min(1).max(60);
const bankVersion = z.number().int().positive();

export const checkSubmission = z.object({ sessionId: z.uuid(), answers: z.record(z.string().max(8), z.number().int().min(0).max(2)).refine(value => Object.keys(value).length === 5) }).strict();
export const sessionActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), skill: skillName, version: bankVersion, timingMode: z.enum(["standard", "extended"]) }).strict(),
  z.object({ action: z.literal("cancel"), sessionId: z.uuid() }).strict()
]);
export const checkSessionSchema = z.object({
  id: z.uuid(), skill: skillName, version: bankVersion,
  timingMode: z.enum(["standard", "extended"]), state: z.enum(["active", "expired"]),
  startedAt: z.iso.datetime({ offset: true }), deadlineAt: z.iso.datetime({ offset: true }), serverNow: z.iso.datetime({ offset: true })
}).strict().refine(session => Date.parse(session.deadlineAt) - Date.parse(session.startedAt) === (session.timingMode === "extended" ? 6000000 : 600000));
export const sessionReplySchema = z.object({ session: checkSessionSchema.nullable() }).strict();
export type CheckSession = z.infer<typeof checkSessionSchema>;
export const bankSchema = z.array(z.object({ skill: skillName, version: bankVersion, questions: z.array(z.object({ id: z.string(), prompt: z.string(), options: z.array(z.string()).length(3) }).strict()).length(5) }).strict());
export const resultSchema = z.object({ skill: z.string(), version: z.number(), score: z.number(), passed: z.boolean(), taken_at: z.string() });
export const submissionResultSchema = z.object({
  skill: skillName, version: bankVersion,
  score: z.number().int().min(0).max(5), total: z.literal(5),
  passed: z.boolean(), takenAt: z.iso.datetime({ offset: true })
}).strict().refine(result => result.passed === (result.score >= 4));
export type SkillBank = z.infer<typeof bankSchema>[number];
export type CheckResult = z.infer<typeof resultSchema>;

/** The most recent pass per skill (any version). */
export async function readSkillResults(client: SupabaseClient, userId: string) {
  const { data, error } = await client.from("skill_check_attempts").select("skill,version,score,passed,taken_at").eq("user_id", userId).eq("passed", true).order("taken_at", { ascending: false }).limit(200);
  if (error) throw new Error("Skill checks unavailable");
  const seen = new Set<string>();
  return z.array(resultSchema).parse(data ?? []).filter(result => {
    const key = result.skill.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
export function eligibleCVSkills(skills: string[], results: CheckResult[]) {
  return skills.filter(skill => results.some(result => result.passed && result.skill.toLowerCase() === skill.trim().toLowerCase()));
}
