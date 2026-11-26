import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

// Skill checks are part of verification: a pass is CareerForge's own confirmation of a skill (the
// "Verified" level). Since 26 Nov they have no clock; fairness comes from a new question and option
// order on every attempt, server-side grading, and a 24-hour wait after a failed attempt.

/** Any published skill (React and SQL were the first two); versions grow when admins publish new questions. */
const skillName = z.string().trim().min(1).max(60);
const bankVersion = z.number().int().positive();
export const RETRY_HOURS = 24;
export const PASS_MARK = 4;
export const QUESTION_COUNT = 5;

/** Answers are the option positions as shown in this attempt; the server maps them back before grading. */
export const checkSubmission = z.object({ sessionId: z.uuid(), answers: z.record(z.string().max(8), z.number().int().min(0).max(2)).refine(value => Object.keys(value).length === QUESTION_COUNT) }).strict();
export const sessionActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), skill: skillName, addToProfile: z.boolean().optional() }).strict(),
  z.object({ action: z.literal("cancel"), sessionId: z.uuid() }).strict()
]);
const allowance = { standard: 600000, extended: 6000000, untimed: 86400000 } as const;
const shownQuestion = z.object({ id: z.string().min(1).max(8), prompt: z.string().min(1), options: z.array(z.string()).length(3) }).strict();
export const checkSessionSchema = z.object({
  id: z.uuid(), skill: skillName, version: bankVersion,
  timingMode: z.enum(["standard", "extended", "untimed"]), state: z.enum(["active", "expired"]),
  startedAt: z.iso.datetime({ offset: true }), deadlineAt: z.iso.datetime({ offset: true }), serverNow: z.iso.datetime({ offset: true }),
  questions: z.array(shownQuestion).max(20)
}).strict().refine(session => Date.parse(session.deadlineAt) - Date.parse(session.startedAt) === allowance[session.timingMode]);
export const sessionReplySchema = z.object({ session: checkSessionSchema.nullable() }).strict();
export type CheckSession = z.infer<typeof checkSessionSchema>;
export type ShownQuestion = z.infer<typeof shownQuestion>;
export const bankSchema = z.array(z.object({ skill: skillName, version: bankVersion, questions: z.array(z.object({ id: z.string(), prompt: z.string(), options: z.array(z.string()).length(3) }).strict()).length(5) }).strict());
export const resultSchema = z.object({ skill: z.string(), version: z.number(), score: z.number(), passed: z.boolean(), taken_at: z.string() });
export const submissionResultSchema = z.object({
  skill: skillName, version: bankVersion,
  score: z.number().int().min(0).max(5), total: z.literal(5),
  passed: z.boolean(), takenAt: z.iso.datetime({ offset: true }),
  retryAt: z.iso.datetime({ offset: true }).nullable().optional()
}).strict().refine(result => result.passed === (result.score >= PASS_MARK));
export type SkillBank = z.infer<typeof bankSchema>[number];
export type CheckResult = z.infer<typeof resultSchema>;
export type CheckOutcome = z.infer<typeof submissionResultSchema>;

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

/** Where a person stands with one skill's check. */
export type CheckStanding = { skill: string; passedAt: string | null; lastScore: number | null; retryAt: string | null };

/**
 * Per skill: the latest pass, the latest score, and when a failed skill can be taken again
 * (24 hours after a failed attempt, unless a later attempt passed). Pure, so it can be tested.
 */
export function checkStandings(attempts: readonly CheckResult[], now = Date.now()): Map<string, CheckStanding> {
  const byKey = new Map<string, CheckStanding>();
  const sorted = [...attempts].sort((a, b) => Date.parse(b.taken_at) - Date.parse(a.taken_at));
  for (const attempt of sorted) {
    const key = attempt.skill.toLowerCase();
    const standing = byKey.get(key) ?? { skill: attempt.skill, passedAt: null, lastScore: attempt.score, retryAt: null };
    if (!byKey.has(key) && !attempt.passed) {
      const retry = Date.parse(attempt.taken_at) + RETRY_HOURS * 3600000;
      if (retry > now) standing.retryAt = new Date(retry).toISOString();
    }
    if (attempt.passed && !standing.passedAt) standing.passedAt = attempt.taken_at;
    byKey.set(key, standing);
  }
  return byKey;
}
export async function readCheckStandings(client: SupabaseClient, userId: string) {
  const { data, error } = await client.from("skill_check_attempts").select("skill,version,score,passed,taken_at").eq("user_id", userId).order("taken_at", { ascending: false }).limit(300);
  if (error) throw new Error("Skill checks unavailable");
  return checkStandings(z.array(resultSchema).parse(data ?? []));
}

/** The skills that have a published check (names only), for links from other pages. */
export async function readCheckableSkills(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client.rpc("skill_check_catalog");
  if (error) return [];
  return z.array(z.object({ skill: skillName }).loose()).catch([]).parse(data ?? []).map(bank => bank.skill);
}

/** The address that opens one skill's check directly. */
export const checkHref = (skill: string) => `/skill-checks?skill=${encodeURIComponent(skill)}`;
/** The check for a skill name, ignoring case ("react" finds "React"), or null. */
export const findCheck = (checkable: readonly string[], skill: string) => checkable.find(name => name.toLowerCase() === skill.trim().toLowerCase()) ?? null;
