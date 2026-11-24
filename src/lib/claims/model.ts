import { z } from "zod";
import type { ProfileHistory } from "../profile-history";
import { formatHistoryPeriod } from "../profile-history-format";
import { levelInfo, levelLabel, testResultText, type ProfileLanguage } from "../languages";

/**
 * Trust level of one profile fact. Stored claim rows hold only
 * evidence_submitted / reviewed / rejected; the rest is derived:
 * - self_declared: no proof submitted
 * - changed: the record was edited after its proof was submitted or reviewed
 * - verified: confirmed by CareerForge itself (a passed skill check)
 */
export type ClaimStatus = "self_declared" | "evidence_submitted" | "reviewed" | "verified" | "rejected" | "changed";
export type ClaimKind = "degree" | "employment" | "skill" | "language";

export const claimStatusInfo: Record<ClaimStatus, { label: string; tone: "neutral" | "pending" | "reviewed" | "verified" | "rejected"; help: string }> = {
  self_declared: { label: "Self-declared", tone: "neutral", help: "Added by you, no proof yet." },
  evidence_submitted: { label: "Proof submitted", tone: "pending", help: "Waiting for a CareerForge reviewer." },
  reviewed: { label: "Reviewed", tone: "reviewed", help: "A CareerForge reviewer checked your proof." },
  verified: { label: "Verified", tone: "verified", help: "Confirmed by CareerForge." },
  rejected: { label: "Not accepted", tone: "rejected", help: "The proof was not accepted. See the reason and try again." },
  changed: { label: "Changed since proof", tone: "neutral", help: "You edited this after sending proof. Send proof for the new version." }
};

export const claimRowSchema = z.object({
  id: z.uuid(), kind: z.enum(["degree", "employment", "skill", "language"]),
  education_id: z.uuid().nullable(), experience_id: z.uuid().nullable(), skill: z.string().nullable(), language_id: z.uuid().nullable().default(null),
  source_revision: z.uuid().nullable(), subject: z.string(),
  status: z.enum(["evidence_submitted", "reviewed", "rejected"]), status_note: z.string().nullable(),
  decided_at: z.string().nullable(), updated_at: z.string()
});
export type ClaimRow = z.input<typeof claimRowSchema>;

export type ClaimItem = {
  key: string; kind: ClaimKind; recordId: string | null; skill: string | null;
  title: string; detail: string; status: ClaimStatus; note: string | null;
  date: string | null; method: string | null; evidenceCount: number;
  /** Verification links on issuer sites (Coursera, Credly...). */
  linkCount: number;
  /** A CareerForge check exists for this skill but has not been passed. */
  checkAvailable: boolean;
};

export type PassedCheck = { skill: string; takenAt: string };
export const checkableSkills = ["React", "SQL"] as const;

function fromRow(row: ClaimRow | undefined, revision: string | null): Pick<ClaimItem, "status" | "note" | "date"> {
  if (!row) return { status: "self_declared", note: null, date: null };
  if (revision !== null && row.source_revision !== revision && row.status !== "rejected") return { status: "changed", note: null, date: null };
  return { status: row.status, note: row.status === "rejected" ? row.status_note : null, date: row.decided_at ?? row.updated_at };
}

/** Every education record, job and self-reported skill, with its current trust level. */
export function buildClaimItems(history: ProfileHistory, skills: string[], passed: PassedCheck[], rows: ClaimRow[], evidenceCounts: Record<string, number>, checkable: readonly string[] = checkableSkills, linkCounts: Record<string, number> = {}, languages: ProfileLanguage[] = []): ClaimItem[] {
  const byEducation = new Map(rows.filter(row => row.education_id).map(row => [row.education_id, row]));
  const byExperience = new Map(rows.filter(row => row.experience_id).map(row => [row.experience_id, row]));
  const byLanguage = new Map(rows.filter(row => row.language_id).map(row => [row.language_id, row]));
  const bySkill = new Map(rows.filter(row => row.skill).map(row => [row.skill!.toLowerCase(), row]));
  const count = (row?: ClaimRow) => row ? evidenceCounts[row.id] ?? 0 : 0;
  const linkCount = (row?: ClaimRow) => row ? linkCounts[row.id] ?? 0 : 0;
  const education = history.education.map(record => {
    const row = byEducation.get(record.id);
    return { key: `degree:${record.id}`, kind: "degree" as const, recordId: record.id, skill: null, title: record.degree, detail: `${record.institution} · ${formatHistoryPeriod(record)}`, method: row?.status === "reviewed" ? "Reviewer" : null, evidenceCount: count(row), linkCount: linkCount(row), checkAvailable: false, ...fromRow(row, record.revision) };
  });
  const experience = history.experience.map(record => {
    const row = byExperience.get(record.id);
    return { key: `employment:${record.id}`, kind: "employment" as const, recordId: record.id, skill: null, title: record.role, detail: `${record.company} · ${formatHistoryPeriod(record)}`, method: row?.status === "reviewed" ? "Reviewer" : null, evidenceCount: count(row), linkCount: linkCount(row), checkAvailable: false, ...fromRow(row, record.revision) };
  });
  const languageItems = languages.map(record => {
    const row = byLanguage.get(record.id);
    const test = record.test ? ` · ${testResultText(record.test, record.score)}` : "";
    return { key: `language:${record.id}`, kind: "language" as const, recordId: record.id, skill: null, title: record.language, detail: `${levelLabel(record.level)} · ${levelInfo[record.level]}${test}`, method: row?.status === "reviewed" ? "Reviewer" : null, evidenceCount: count(row), linkCount: linkCount(row), checkAvailable: false, ...fromRow(row, record.revision) };
  });
  const skillItems = skills.map(skill => {
    const check = passed.find(item => item.skill.toLowerCase() === skill.toLowerCase());
    const row = bySkill.get(skill.toLowerCase());
    const checkAvailable = checkable.some(name => name.toLowerCase() === skill.toLowerCase());
    const base = { key: `skill:${skill.toLowerCase()}`, kind: "skill" as const, recordId: null, skill, title: skill, evidenceCount: count(row), linkCount: linkCount(row), checkAvailable: checkAvailable && !check };
    if (check) return { ...base, detail: "Skill", status: "verified" as const, note: null, date: check.takenAt, method: "CareerForge check" };
    return { ...base, detail: "Skill", method: row?.status === "reviewed" ? "Reviewer" : null, ...fromRow(row, null) };
  });
  return [...education, ...experience, ...languageItems, ...skillItems];
}

/** Share of facts backed by proof that was reviewed or verified. */
export function trustSummary(items: ClaimItem[]) {
  const total = items.length;
  const confirmed = items.filter(item => item.status === "reviewed" || item.status === "verified").length;
  const pending = items.filter(item => item.status === "evidence_submitted").length;
  return { total, confirmed, pending, selfDeclared: total - confirmed - pending };
}

export const EVIDENCE_MAX_BYTES = 4 * 1024 * 1024;
/** Detects the real file type from its first bytes; the name and browser type are not trusted. */
export function evidenceType(bytes: Uint8Array): { mime: "application/pdf" | "image/png" | "image/jpeg"; ext: "pdf" | "png" | "jpg" } | null {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return { mime: "application/pdf", ext: "pdf" };
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  return null;
}
