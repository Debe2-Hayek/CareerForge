import { test } from "node:test";
import assert from "node:assert/strict";
import { compareLevel, languageFieldsSchema, levelFromScore, resultAge, testResultText, type LanguageFields, type ProfileLanguage } from "./languages";
import { languageHandlers, LanguageError, type LanguageAccess } from "./languages-handlers";
import { buildClaimItems } from "./claims/model";

const level = (testName: Parameters<typeof levelFromScore>[0], score: string) => levelFromScore(testName, score).level;

test("test scores convert to the CEFR level they support", () => {
  assert.deepEqual(["9", "8.5", "8.0", "7", "6.5", "5.5", "5.0", "4", "3.5"].map(score => level("ielts", score)), ["C2", "C2", "C1", "C1", "B2", "B2", "B1", "B1", "below"]);
  assert.equal(level("ielts", "7.25"), null, "IELTS bands go in halves");
  assert.equal(level("ielts", "10"), null);
  assert.deepEqual(["6", "5.5", "5", "4", "3", "2", "1"].map(score => level("toefl", score)), ["C2", "C1", "C1", "B2", "B1", "A2", "A1"], "TOEFL 1-6 scale (2026)");
  assert.deepEqual(["120", "95", "94", "72", "42", "41"].map(score => level("toefl", score)), ["C1", "C1", "B2", "B2", "B1", "below"], "TOEFL 0-120 total never reaches C2");
  assert.match(levelFromScore("toefl", "100").text, /does not measure C2/);
  assert.deepEqual(["160", "155", "130", "125", "100", "60", "55"].map(score => level("det", score)), ["C2", "C2", "C1", "B2", "B2", "B1", "below"]);
  assert.deepEqual(["210", "185", "170", "150", "125", "105"].map(score => level("cambridge", score)), ["C2", "C1", "B2", "B1", "A2", "A1"]);
  assert.deepEqual(["650", "520", "450", "350", "250", "150"].map(score => level("tcf", score)), ["C2", "C1", "B2", "B1", "A2", "A1"]);
  assert.equal(level("delf_dalf", "DALF C1"), "C1");
  assert.equal(level("goethe", "b2"), "B2");
  assert.equal(level("delf_dalf", "passed"), null);
  assert.equal(level("other", "C2"), null, "unknown tests are left to the reviewer");
  assert.equal(level("ielts", "7,5"), "C1", "a comma decimal is read");
  assert.equal(level("toefl", "100/120"), "C1", "a written maximum is ignored");
  assert.equal(testResultText("ielts", "7.0"), "IELTS 7.0");
  assert.equal(testResultText("delf_dalf", "DELF B2"), "DELF B2", "the test name is not repeated");
  assert.equal(testResultText("goethe", "B1"), "Goethe-Zertifikat B1");
});

test("claimed level against the score; native needs C1; some results expire after two years", () => {
  assert.equal(compareLevel("C1", levelFromScore("ielts", "7.0")), "supports");
  assert.equal(compareLevel("B2", levelFromScore("ielts", "7.0")), "supports", "a higher score supports a lower claim");
  assert.equal(compareLevel("C2", levelFromScore("ielts", "7.0")), "below");
  assert.equal(compareLevel("B1", levelFromScore("ielts", "3.5")), "below");
  assert.equal(compareLevel("native", levelFromScore("det", "135")), "supports");
  assert.equal(compareLevel("native", levelFromScore("det", "110")), "below");
  assert.equal(compareLevel("B2", levelFromScore("other", "B2")), "unknown");
  const now = new Date("2026-11-24T00:00:00Z");
  assert.equal(resultAge("ielts", "2024-12-01", now)?.expired, false);
  assert.equal(resultAge("ielts", "2024-11-01", now)?.expired, true);
  assert.equal(resultAge("delf_dalf", "2010-06-01", now), null, "DELF and DALF do not expire");
  assert.equal(resultAge("ielts", null, now), null);
});

test("language form: letters only, a level, and a score whenever a test is chosen", () => {
  const ok = languageFieldsSchema.parse({ language: " French ", level: "B2", test: "delf_dalf", score: "B2", testDate: "2024-06-01" });
  assert.deepEqual(ok, { language: "French", level: "B2", test: "delf_dalf", score: "B2", testDate: "2024-06-01" });
  assert.deepEqual(languageFieldsSchema.parse({ language: "Arabic", level: "native", score: "ignored", testDate: "2020-01-01" }), { language: "Arabic", level: "native", test: null, score: null, testDate: null }, "no test, no score");
  assert.equal(languageFieldsSchema.parse({ language: "Español", level: "A2" }).language, "Español");
  for (const bad of [{ language: "E", level: "B1" }, { language: "<b>English</b>", level: "B1" }, { language: "English", level: "C3" },
    { language: "English", level: "C1", test: "ielts" }, { language: "English", level: "C1", test: "ielts", score: "7", testDate: "2999-01-01" },
    { language: "English", level: "C1", test: "ielts", score: "<7>" }, { language: "English", level: "C1", extra: true }]) {
    assert.equal(languageFieldsSchema.safeParse(bad).success, false, JSON.stringify(bad));
  }
});

const ORIGIN = "http://localhost:3000";
const ID = "8b0c1f4e-7d55-4c55-9a51-0b9a1d1f2c3e";
const REV = "1b0c1f4e-7d55-4c55-9a51-0b9a1d1f2c3f";
const request = (method: string, body: unknown, origin = ORIGIN) => new Request(`${ORIGIN}/api/v1/languages`, { method, headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const noLimit = () => 0;

test("languages endpoint: origin, session, validation, and clear refusals", async () => {
  const saved: { id: string | null; fields: LanguageFields }[] = [];
  const removed: string[] = [];
  const access: LanguageAccess = {
    userId: "u1",
    async save(id, fields) { saved.push({ id, fields }); return { id: id ?? ID, revision: REV, ...fields }; },
    async remove(id) { if (id !== ID) throw new LanguageError("NOT_FOUND", "Gone", 404); removed.push(id); }
  };
  const { POST, DELETE } = languageHandlers(async () => access, noLimit);
  const english = { fields: { language: "English", level: "C1", test: "ielts", score: "7.5", testDate: "2025-03-01" } };
  assert.equal((await POST(request("POST", english, "https://evil.example"))).status, 403);
  assert.equal((await languageHandlers(async () => null, noLimit).POST(request("POST", english))).status, 401);
  const missingScore = await POST(request("POST", { fields: { language: "English", level: "C1", test: "ielts" } }));
  assert.equal(missingScore.status, 400);
  assert.match(((await missingScore.json()) as { error: { message: string } }).error.message, /score/);
  assert.equal((await POST(request("POST", { fields: { language: "English", level: "Z9" } }))).status, 400);
  assert.equal(saved.length, 0);
  assert.equal((await POST(request("POST", english))).status, 201);
  assert.equal((await POST(request("POST", { id: ID, ...english }))).status, 200);
  assert.deepEqual(saved.map(entry => entry.id), [null, ID]);
  assert.equal((await DELETE(request("DELETE", { id: "not-an-id" }))).status, 400);
  assert.equal((await DELETE(request("DELETE", { id: REV }))).status, 404);
  assert.equal((await DELETE(request("DELETE", { id: ID }))).status, 204);
  const crash: LanguageAccess = { ...access, async save() { throw new Error("relation profile_languages: secret"); } };
  const failed = await languageHandlers(async () => crash, noLimit).POST(request("POST", english));
  assert.equal(failed.status, 503);
  assert.equal(JSON.stringify(await failed.json()).includes("secret"), false);
});

test("languages appear as claims with their level, and editing after proof needs new proof", () => {
  const english: ProfileLanguage = { id: ID, language: "English", level: "C1", test: "ielts", score: "7.0", testDate: "2025-03-01", revision: REV };
  const plain = buildClaimItems({ education: [], experience: [] }, [], [], [], {}, [], {}, [english]);
  assert.equal(plain[0].kind, "language");
  assert.equal(plain[0].status, "self_declared");
  assert.match(plain[0].detail, /C1 · Advanced · IELTS 7.0/);
  const row = { id: "c0c0c0c0-7d55-4c55-9a51-0b9a1d1f2c3e", kind: "language" as const, education_id: null, experience_id: null, skill: null, language_id: ID,
    source_revision: REV, subject: "English · C1", status: "reviewed" as const, status_note: null, decided_at: "2026-11-24T00:00:00.000Z", updated_at: "2026-11-24T00:00:00.000Z" };
  assert.equal(buildClaimItems({ education: [], experience: [] }, [], [], [row], { [row.id]: 1 }, [], {}, [english])[0].status, "reviewed");
  assert.equal(buildClaimItems({ education: [], experience: [] }, [], [], [row], {}, [], {}, [{ ...english, level: "C2", revision: ID }])[0].status, "changed");
});
