import { z } from "zod";
import { LEVELS, TEST_IDS, levelLabel, testResultText, type LanguageTest } from "./languages";

/**
 * The public trust page (/v/<id>): only facts CareerForge checked, with how and when.
 * Data comes from careerforge_confirmed_facts (migration 202611250004); a reviewed fact counts
 * only while its record is unchanged since the review.
 */
const date = z.string().nullable().catch(null);
const record = z.object({ title: z.string(), organisation: z.string(), startDate: date, endDate: date, isCurrent: z.boolean().catch(false), checkedAt: date });
export const confirmedFactsSchema = z.object({
  name: z.string(), headline: z.string().nullable().catch(null),
  education: z.array(record).catch([]), experience: z.array(record).catch([]),
  languages: z.array(z.object({
    language: z.string(), level: z.enum(LEVELS), test: z.enum(TEST_IDS as [LanguageTest, ...LanguageTest[]]).nullable().catch(null),
    score: z.string().nullable().catch(null), testDate: date, checkedAt: date
  })).catch([]),
  skills: z.array(z.object({ skill: z.string(), method: z.enum(["check", "reviewed"]), checkedAt: date })).catch([]),
  projects: z.array(z.object({ repository: z.string(), checkedAt: date })).catch([]),
  certificates: z.array(z.object({ id: z.uuid(), title: z.string(), kind: z.enum(["attendance", "assessed"]), scope: z.string(), checkedAt: date })).catch([]),
  updatedAt: z.string().optional()
});
export type ConfirmedFacts = z.infer<typeof confirmedFactsSchema>;

export const factCount = (facts: ConfirmedFacts) =>
  facts.education.length + facts.experience.length + facts.languages.length + facts.skills.length + facts.projects.length + facts.certificates.length;

const monthYear = new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" });
export function formatMonth(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(parsed.getTime()) ? null : monthYear.format(parsed);
}
export function formatPeriod(item: { startDate: string | null; endDate: string | null; isCurrent: boolean }): string {
  const start = formatMonth(item.startDate);
  const end = item.isCurrent ? "present" : formatMonth(item.endDate);
  return start && end ? `${start} – ${end}` : end ?? start ?? "";
}
/** One plain line saying how a fact was checked. */
export function methodText(method: "reviewed" | "check" | "interview" | "issued", checkedAt: string | null, extra?: string): string {
  const when = formatMonth(checkedAt);
  const how = method === "check" ? "Passed a CareerForge skill check"
    : method === "interview" ? "Passed a timed CareerForge interview about this code"
    : method === "issued" ? `Certificate issued by CareerForge${extra ? ` (${extra})` : ""}`
    : `Proof reviewed by CareerForge${extra ? ` (${extra})` : ""}`;
  return when ? `${how} · ${when}` : how;
}
export const languageLine = (item: ConfirmedFacts["languages"][number]) =>
  `${levelLabel(item.level)}${item.test ? ` · ${testResultText(item.test, item.score)}` : ""}`;
