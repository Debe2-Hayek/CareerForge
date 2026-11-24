import { z } from "zod";

/**
 * Language proficiency on a profile: a CEFR level (A1 to C2) or native, plus the external
 * test behind it. Code (never AI) converts a test score into the CEFR level it supports, so
 * a reviewer sees "IELTS 7.0 = C1, claims C1". The conversions follow each test's published
 * alignment (checked on 24 November 2026): IELTS bands, TOEFL iBT (the 1 to 6 scale used
 * since 21 January 2026, and the older 0 to 120 total), Duolingo English Test, the Cambridge
 * English Scale and TCF; DELF/DALF and Goethe certificates are issued at a level. They are
 * guides for the reviewer, who confirms the score on the report itself.
 */
export const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type Cefr = (typeof CEFR)[number];
export const LEVELS = [...CEFR, "native"] as const;
export type LanguageLevel = (typeof LEVELS)[number];

export const levelInfo: Record<LanguageLevel, string> = {
  A1: "Beginner", A2: "Elementary", B1: "Intermediate", B2: "Upper intermediate", C1: "Advanced", C2: "Proficient", native: "Native or bilingual"
};
export const levelLabel = (level: LanguageLevel) => level === "native" ? "Native" : level;

export const TESTS = {
  ielts: { label: "IELTS", hint: "Overall band, for example 7.0", validYears: 2 },
  toefl: { label: "TOEFL iBT", hint: "Overall 1–6 band (from 2026) or 0–120 total", validYears: 2 },
  det: { label: "Duolingo English Test", hint: "Overall score, 10–160", validYears: 2 },
  cambridge: { label: "Cambridge English", hint: "Cambridge English Scale score, 80–230", validYears: null },
  delf_dalf: { label: "DELF / DALF", hint: "Level of the diploma, for example B2", validYears: null },
  tcf: { label: "TCF", hint: "Overall score, 100–699", validYears: 2 },
  goethe: { label: "Goethe-Zertifikat", hint: "Level of the certificate, for example B1", validYears: null },
  other: { label: "Other test or certificate", hint: "As written on it", validYears: null }
} as const;
export type LanguageTest = keyof typeof TESTS;
export const TEST_IDS = Object.keys(TESTS) as LanguageTest[];

/** "IELTS 7.0", or just "DELF B2" when the score already names the test. */
export function testResultText(test: LanguageTest, score: string | null): string {
  const value = (score ?? "").trim();
  const words = TESTS[test].label.toLowerCase().split(/[^a-z]+/).filter(word => word.length > 2);
  return words.some(word => value.toLowerCase().includes(word)) ? value : `${TESTS[test].label} ${value}`.trim();
}

export type ScoreReading = { level: Cefr | "below" | null; text: string };

const number = (score: string) => {
  const match = /^\s*(\d{1,3}(?:[.,]\d)?)\s*(?:\/\s*\d{1,3})?\s*$/.exec(score);
  return match ? Number(match[1].replace(",", ".")) : null;
};
const step = (value: number, cuts: [number, Cefr][], floor: Cefr | "below"): Cefr | "below" => cuts.find(([min]) => value >= min)?.[1] ?? floor;
const levelIn = (score: string) => (/\b([ABC][12])\b/i.exec(score)?.[1].toUpperCase() as Cefr | undefined) ?? null;

/** The CEFR level a test score supports, or null when it cannot be read (the reviewer decides). */
export function levelFromScore(test: LanguageTest, score: string): ScoreReading {
  const value = number(score);
  const unreadable = { level: null, text: "Score not in the expected format: check the report." };
  switch (test) {
    case "ielts":
      if (value === null || value < 0 || value > 9 || (value * 2) % 1) return unreadable;
      return { level: step(value, [[8.5, "C2"], [7, "C1"], [5.5, "B2"], [4, "B1"]], "below"), text: `IELTS band ${value.toFixed(1)}` };
    case "toefl":
      if (value === null) return unreadable;
      if (value >= 1 && value <= 6 && !((value * 2) % 1)) return { level: step(value, [[6, "C2"], [5, "C1"], [4, "B2"], [3, "B1"], [2, "A2"], [1, "A1"]], "below"), text: `TOEFL band ${value.toFixed(1)} (1–6 scale)` };
      if (value >= 0 && value <= 120 && Number.isInteger(value)) return { level: step(value, [[95, "C1"], [72, "B2"], [42, "B1"]], "below"), text: `TOEFL total ${value} (0–120 scale, which does not measure C2)` };
      return unreadable;
    case "det":
      if (value === null || value < 10 || value > 160 || !Number.isInteger(value)) return unreadable;
      return { level: step(value, [[155, "C2"], [130, "C1"], [100, "B2"], [60, "B1"]], "below"), text: `Duolingo English Test ${value}` };
    case "cambridge":
      if (value === null || value < 80 || value > 230 || !Number.isInteger(value)) return unreadable;
      return { level: step(value, [[200, "C2"], [180, "C1"], [160, "B2"], [140, "B1"], [120, "A2"], [100, "A1"]], "below"), text: `Cambridge English Scale ${value}` };
    case "tcf":
      if (value === null || value < 100 || value > 699 || !Number.isInteger(value)) return unreadable;
      return { level: step(value, [[600, "C2"], [500, "C1"], [400, "B2"], [300, "B1"], [200, "A2"], [100, "A1"]], "below"), text: `TCF ${value}` };
    case "delf_dalf":
    case "goethe": {
      const level = levelIn(score);
      return level ? { level, text: `${TESTS[test].label} ${level} diploma` } : unreadable;
    }
    default:
      return { level: null, text: "Other test: compare the level on the certificate yourself." };
  }
}

export type LevelComparison = "supports" | "below" | "unknown";
/** Whether the score supports the claimed level. Native needs C1 or above. */
export function compareLevel(claimed: LanguageLevel, reading: ScoreReading): LevelComparison {
  if (!reading.level) return "unknown";
  if (reading.level === "below") return "below";
  const needed = claimed === "native" ? "C1" : claimed;
  return CEFR.indexOf(reading.level) >= CEFR.indexOf(needed) ? "supports" : "below";
}

/** Results of some tests are accepted for two years only. */
export function resultAge(test: LanguageTest, testDate: string | null, today = new Date()): { expired: boolean; text: string } | null {
  const years = TESTS[test].validYears;
  if (!years || !testDate) return null;
  const taken = new Date(`${testDate}T00:00:00Z`);
  if (Number.isNaN(taken.getTime())) return null;
  const limit = new Date(taken);
  limit.setUTCFullYear(limit.getUTCFullYear() + years);
  return limit < today
    ? { expired: true, text: `Taken more than ${years} years ago: ${TESTS[test].label} results are usually accepted for ${years} years.` }
    : { expired: false, text: `Within the ${years}-year validity of ${TESTS[test].label} results.` };
}

const today = () => new Date().toISOString().slice(0, 10);
export const languageFieldsSchema = z.object({
  language: z.string().trim().min(2).max(40).regex(/^\p{L}[\p{L} ().'-]*$/u, "Use letters only, for example English."),
  level: z.enum(LEVELS),
  test: z.enum(TEST_IDS as [LanguageTest, ...LanguageTest[]]).nullable().default(null),
  score: z.string().trim().max(20).regex(/^[A-Za-z0-9 .,/+-]*$/).nullable().default(null),
  testDate: z.iso.date().nullable().default(null)
}).strict().superRefine((value, context) => {
  if (value.test && !value.score) context.addIssue({ code: "custom", path: ["score"], message: "Enter the score or level shown on the result." });
  if (value.testDate && value.testDate > today()) context.addIssue({ code: "custom", path: ["testDate"], message: "The test date cannot be in the future." });
}).transform(value => value.test ? value : { ...value, score: null, testDate: null });
export type LanguageFields = z.infer<typeof languageFieldsSchema>;

export const languageRowSchema = z.object({
  id: z.uuid(), language: z.string(), level: z.enum(LEVELS), test: z.enum(TEST_IDS as [LanguageTest, ...LanguageTest[]]).nullable(),
  score: z.string().nullable(), test_date: z.string().nullable(), revision: z.uuid()
}).transform(row => ({ id: row.id, language: row.language, level: row.level, test: row.test, score: row.score, testDate: row.test_date, revision: row.revision }));
export type ProfileLanguage = z.output<typeof languageRowSchema>;
