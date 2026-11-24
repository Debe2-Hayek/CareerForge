import { test } from "node:test";
import assert from "node:assert/strict";
import { certificateNumbers, checkText } from "./text-check";
import { textReadHandlers, ClaimError, type ReadAccess } from "./handlers";
import type { ClaimContext } from "./evidence-check";

const degree: ClaimContext = { kind: "degree", ownerName: "Rana Haddad", institution: "Lebanese American University", title: "Bachelor of Engineering in Computer Engineering", startDate: "2016-09-01", endDate: "2020-06-01", isCurrent: false };
const DIPLOMA = "Lebanese American University\nThis is to certify that\nRana Haddad\nhas been awarded the degree of\nBachelor of Engineering in Computer Engineering\nBeirut, June 2020\nRegistration No. LAU-2020-04417";

test("text check: finds the claim's facts in the text and never calls absence a mismatch", () => {
  const ok = checkText(degree, DIPLOMA);
  assert.equal(ok.status, "consistent");
  assert.deepEqual(ok.findings.map(finding => finding.result), ["match", "match", "match", "match"]);
  assert.deepEqual(ok.numbers, ["LAU-2020-04417"]);
  const other = checkText({ ...degree, ownerName: "Karim Nassar" }, DIPLOMA);
  assert.equal(other.status, "attention");
  assert.equal(other.findings[0].result, "missing", "a name not found is 'not found in the text', not a mismatch");
  const wrongYear = checkText({ ...degree, startDate: "2018-09-01", endDate: "2022-06-01" }, DIPLOMA);
  assert.equal(wrongYear.findings.find(finding => finding.field === "dates")?.result, "missing");
  assert.equal(checkText(degree, "   ").status, "unreadable");
  assert.equal(checkText(degree, "ok").findings.length, 0);
});

test("text check: other scripts are left to the reviewer; languages and skills skip what they do not have", () => {
  const arabic = checkText(degree, "الجامعة اللبنانية الأميركية\nشهادة\nرنا حداد\nبكالوريوس في هندسة الكمبيوتر 2020");
  assert.equal(arabic.findings[0].result, "check", "Latin name against Arabic text");
  const language = checkText({ kind: "language", ownerName: "Rana Haddad", institution: null, title: "English", startDate: null, endDate: "2025-03-01", isCurrent: false },
    "Test Report Form\nCandidate: Rana Haddad\nTest date 01 March 2025\nOverall band score 7.0\nEnglish");
  assert.deepEqual(language.findings.map(finding => [finding.label, finding.result]), [["Name", "match"], ["Language", "match"], ["Year", "match"]]);
  assert.equal(language.findings[2].claim, "Test taken 2025");
  const skill = checkText({ kind: "skill", ownerName: "Rana Haddad", institution: null, title: "SQL", startDate: null, endDate: null, isCurrent: false }, "Certificate of completion awarded to Rana Haddad for SQL basics");
  assert.equal(skill.findings.some(finding => finding.field === "dates"), false);
});

test("certificate numbers: labelled and coded numbers, not years or plain words", () => {
  assert.deepEqual(certificateNumbers("Certificate No: AB12345\nIssued 2021"), ["AB12345"]);
  assert.deepEqual(certificateNumbers("Ref. 2020/554-12 and code UL-2019-778"), ["2020/554-12", "UL-2019-778"]);
  assert.deepEqual(certificateNumbers("Registration 2020"), []);
  assert.deepEqual(certificateNumbers("No objection"), []);
});

const ORIGIN = "http://localhost:3000";
const post = (body: unknown, origin = ORIGIN) => new Request(`${ORIGIN}/api/v1/admin/claims/read`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("read endpoint: reviewers only, one file, clear failures", async () => {
  const ID = "8b0c1f4e-7d55-4c55-9a51-0b9a1d1f2c3e";
  let reads = 0;
  const access: ReadAccess = { userId: "a", async read(id) { reads++; if (id !== ID) throw new ClaimError("NOT_FOUND", "Gone", 404); return { status: "consistent" }; } };
  const { POST } = textReadHandlers(async () => access, () => 0);
  assert.equal((await textReadHandlers(async () => null, () => 0).POST(post({ evidenceId: ID }))).status, 403);
  assert.equal((await POST(post({ evidenceId: ID }, "https://evil.example"))).status, 403);
  assert.equal((await POST(post({ evidenceId: "x" }))).status, 400);
  assert.equal((await POST(post({ evidenceId: ID }))).status, 200);
  assert.equal((await POST(post({ evidenceId: "1b0c1f4e-7d55-4c55-9a51-0b9a1d1f2c3e" }))).status, 404);
  const broken: ReadAccess = { userId: "a", async read() { throw new Error("tesseract crashed: secret path"); } };
  const failed = await textReadHandlers(async () => broken, () => 0).POST(post({ evidenceId: ID }));
  assert.equal(failed.status, 503);
  assert.equal(JSON.stringify(await failed.json()).includes("secret"), false);
  assert.equal(reads, 2);
});
