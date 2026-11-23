import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { documentGenerateHandlers, profileAutofillHandlers, type AiAccess } from "./handlers";
import type { AiProvider, AiRequest } from "./provider";
import type { AiRunStore, Reservation } from "./runner";
import { docxText } from "./document-text";

const ORIGIN = "http://localhost:3000";
const jsonRequest = (body: unknown, origin = ORIGIN) => new Request(`${ORIGIN}/api/generate`, {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body)
});

/** In-memory ledger mirroring the SQL RPC contract: cache, per-user limit, failures count. */
function memoryStore(limit = 5) {
  const runs: { id: string; hash: string; version: string; status: string; output: unknown }[] = [];
  const store: AiRunStore = {
    async reserve(_feature, hash, version): Promise<Reservation> {
      const hit = runs.find(run => run.hash === hash && run.version === version && run.status === "complete");
      if (hit) return { status: "cached", output: hit.output };
      if (runs.length >= limit) return { status: "limited", retryAfter: 3600 };
      const id = `run-${runs.length}`;
      runs.push({ id, hash, version, status: "pending", output: null });
      return { status: "reserved", runId: id, remaining: limit - runs.length };
    },
    async finish(id, _model, output) {
      const run = runs.find(item => item.id === id && item.status === "pending");
      if (!run) throw new Error("not found");
      run.status = output === null ? "failed" : "complete"; run.output = output;
    }
  };
  return { store, runs };
}
function fakeProvider(answers: unknown[]) {
  const calls: AiRequest[] = [];
  const provider: AiProvider = {
    async complete(request) {
      calls.push(request);
      const next = answers.length > 1 ? answers.shift() : answers[0];
      if (next instanceof Error) throw next;
      return { content: typeof next === "string" ? next : JSON.stringify(next), model: "fake-model" };
    }
  };
  return { provider, calls };
}
const access = (store: AiRunStore): AiAccess => ({ userId: "user-1", runs: store });

// --- Builder generation (/api/generate and /api/v1/documents/generate) ---

test("generation rejects foreign origins before auth and denies unsigned users", async () => {
  let calls = 0;
  const handlers = documentGenerateHandlers(async () => { calls++; return null; }, () => null);
  assert.equal((await handlers.POST(jsonRequest({ text: "notes" }, "https://foreign.example"))).status, 403);
  assert.equal(calls, 0);
  assert.equal((await handlers.POST(jsonRequest({ text: "notes" }))).status, 401);
  assert.equal(calls, 1);
});

test("generation validates bounded notes without accepting arbitrary fields", async () => {
  const { POST } = documentGenerateHandlers(async () => access(memoryStore().store), () => null);
  for (const body of [null, {}, { text: "   " }, { text: 12 }, { text: "x".repeat(8001) }, { text: "notes", ownerId: "someone-else" }]) {
    assert.equal((await POST(jsonRequest(body))).status, 400);
  }
  const oversized = new Request(`${ORIGIN}/api/generate`, { method: "POST", headers: { "content-length": "65537" }, body: JSON.stringify({ text: "notes" }) });
  assert.equal((await POST(oversized)).status, 400);
});

test("without a configured provider generation keeps the 501 demo fallback and does not echo notes", async () => {
  const { POST } = documentGenerateHandlers(async () => access(memoryStore().store), () => null);
  const response = await POST(jsonRequest({ text: "private applicant notes" }));
  assert.equal(response.status, 501);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json() as { error: { code: string; message: string } };
  assert.equal(body.error.code, "NOT_IMPLEMENTED");
  assert.equal(body.error.message.includes("private applicant notes"), false);
});

const NOTES = "i'm rana haddad, backend developer. worked at Murex for 3 years building payment APIs in Java. studied Computer Engineering at Lebanese American University 2016-2020. know Java, Spring Boot, PostgreSQL. built a budget tracker app.";

test("generation returns grounded builder data and removes invented facts", async () => {
  const { store } = memoryStore();
  const { provider } = fakeProvider([{
    name: "Rana Haddad", role: "Backend Developer", email: "rana@invented.com", phone: "", linkedin: "", github: "", website: "", location: "Beirut",
    summary: "Backend developer who builds payment APIs in Java.",
    experience: [
      { company: "Murex", title: "Backend Developer", period: "3 years", bullets: ["Built payment APIs in Java.", "Cut latency by 40%."] },
      { company: "Google", title: "Engineer", period: "2 years", bullets: ["Invented role."] }
    ],
    skills: ["Java", "Spring Boot", "PostgreSQL", "Kubernetes"],
    projects: [{ name: "budget tracker app", description: "A budget tracker app." }],
    education: [{ school: "Lebanese University", degree: "Computer Engineering", period: "2016-2020" }, { school: "Lebanese American University", degree: "Computer Engineering", period: "2016-2020" }],
    languages: []
  }]);
  const { POST, compatibilityPOST } = documentGenerateHandlers(async () => access(store), () => provider);
  const response = await POST(jsonRequest({ text: NOTES }));
  assert.equal(response.status, 200);
  const { document } = await response.json() as { document: Record<string, unknown> & { experience: { company: string; bullets: string[] }[]; education: { school: string }[]; skills: string[] } };
  assert.equal(document.name, "Rana Haddad");
  assert.equal(document.email, "", "contacts must appear verbatim in the notes");
  assert.equal(document.location, "", "an unstated location is removed");
  assert.deepEqual(document.experience.map(item => item.company), ["Murex"]);
  assert.deepEqual(document.experience[0].bullets, ["Built payment APIs in Java."], "an invented metric is removed");
  // "Lebanese University" is not "Lebanese American University".
  assert.deepEqual(document.education.map(item => item.school), ["Lebanese American University"]);
  assert.deepEqual(document.skills, ["Java", "Spring Boot", "PostgreSQL"]);
  // The compatibility alias returns the data object itself; the same notes are served from cache.
  const alias = await compatibilityPOST(jsonRequest({ text: NOTES }));
  assert.equal(alias.status, 200);
  assert.equal((await alias.json() as { name: string }).name, "Rana Haddad");
});

test("generation enforces the daily limit with Retry-After and a string error on the alias", async () => {
  const { store } = memoryStore(1);
  const { provider } = fakeProvider([{ name: "Rana Haddad" }]);
  const { compatibilityPOST } = documentGenerateHandlers(async () => access(store), () => provider);
  assert.equal((await compatibilityPOST(jsonRequest({ text: NOTES }))).status, 200);
  const limited = await compatibilityPOST(jsonRequest({ text: `${NOTES} more` }));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "3600");
  assert.match((await limited.json() as { error: string }).error, /today/);
});

test("invalid AI output is retried once, then fails without caching and still counts", async () => {
  const { store, runs } = memoryStore();
  const { provider, calls } = fakeProvider(["   "]);
  const { POST } = documentGenerateHandlers(async () => access(store), () => provider);
  const response = await POST(jsonRequest({ text: NOTES }));
  assert.equal(response.status, 503);
  assert.equal(calls.length, 2);
  assert.match(calls[1].user, /valid JSON only/);
  assert.deepEqual(runs.map(run => run.status), ["failed"]);
  assert.equal((await response.text()).includes("Murex"), false);
});

// --- Profile autofill (/api/v1/profile/autofill) ---

function formRequest(fields: Record<string, string | File>, origin = ORIGIN) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  const request = new Request(`${ORIGIN}/api/v1/profile/autofill`, { method: "POST", headers: { Origin: origin }, body: form });
  return request;
}
async function sized(request: Request) {
  // undici computes the multipart body lazily; give it an explicit length like a browser does.
  const body = await request.arrayBuffer();
  return new Request(request.url, { method: "POST", headers: { Origin: request.headers.get("origin") ?? ORIGIN, "content-type": request.headers.get("content-type") ?? "", "content-length": String(body.byteLength) }, body });
}

const AI_PROFILE = {
  name: "Rana Haddad", headline: "Backend developer", location: "", summary: "Backend developer who builds payment APIs in Java.",
  education: [{ institution: "Lebanese American University", degree: "Computer Engineering", startYear: 2016, startMonth: null, endYear: 2020, endMonth: null, current: false },
    { institution: "Harvard University", degree: "MBA", startYear: 2021, startMonth: 9, endYear: 2022, endMonth: 6, current: false }],
  experience: [{ company: "Murex", role: "backend developer", startYear: 2020, startMonth: 9, endYear: null, endMonth: null, current: true, description: "Building payment APIs in Java." }],
  skills: ["Java", "Spring Boot", "Rust"], projects: [{ name: "budget tracker app", description: "" }], languages: ["Arabic"]
};

test("autofill requires same origin, a session, consent and bounded input", async () => {
  const { store } = memoryStore();
  const { provider, calls } = fakeProvider([AI_PROFILE]);
  let authCalls = 0;
  const signedOut = profileAutofillHandlers(async () => { authCalls++; return null; }, () => provider);
  assert.equal((await signedOut.POST(await sized(formRequest({ source: "notes", text: NOTES, consent: "yes" }, "https://foreign.example")))).status, 403);
  assert.equal(authCalls, 0);
  assert.equal((await signedOut.POST(await sized(formRequest({ source: "notes", text: NOTES, consent: "yes" })))).status, 401);
  const { POST } = profileAutofillHandlers(async () => access(store), () => provider);
  assert.equal((await POST(await sized(formRequest({ source: "notes", text: NOTES })))).status, 400, "consent is required");
  assert.equal((await POST(await sized(formRequest({ source: "notes", text: "too short", consent: "yes" })))).status, 400);
  assert.equal((await POST(await sized(formRequest({ source: "other", text: NOTES, consent: "yes" })))).status, 400);
  assert.equal((await POST(jsonRequest({ source: "notes", text: NOTES }))).status, 400, "JSON bodies are not accepted");
  const huge = new Request(`${ORIGIN}/api/v1/profile/autofill`, { method: "POST", headers: { Origin: ORIGIN, "content-type": "multipart/form-data; boundary=x", "content-length": String(6 * 1024 * 1024) }, body: "x" });
  assert.equal((await POST(huge)).status, 400);
  assert.equal(calls.length, 0, "no AI call for rejected requests");
});

test("autofill from notes returns grounded suggestions only and serves repeats from cache", async () => {
  const { store, runs } = memoryStore();
  const { provider, calls } = fakeProvider([AI_PROFILE]);
  const { POST } = profileAutofillHandlers(async () => access(store), () => provider);
  const response = await POST(await sized(formRequest({ source: "notes", text: NOTES, consent: "yes" })));
  assert.equal(response.status, 200);
  const body = await response.json() as { result: { profile: { name: string; skills: string[]; education: string; project: string }; education: { institution: string; years: string; startDate: string | null }[]; experience: { company: string; isCurrent: boolean; startDate: string | null }[]; languages: string[]; removed: { field: string; value: string }[] }; cached: boolean; remaining: number };
  assert.equal(body.cached, false);
  assert.equal(body.remaining, 4);
  assert.equal(body.result.profile.name, "Rana Haddad");
  assert.deepEqual(body.result.profile.skills, ["Java", "Spring Boot"]);
  assert.equal(body.result.profile.education, "Computer Engineering, Lebanese American University");
  assert.equal(body.result.profile.project, "budget tracker app");
  assert.deepEqual(body.result.education.map(item => item.institution), ["Lebanese American University"]);
  assert.equal(body.result.education[0].startDate, null, "a year alone is not stored as January");
  assert.equal(body.result.education[0].years, "2016 – 2020");
  assert.equal(body.result.experience[0].isCurrent, true);
  assert.equal(body.result.experience[0].startDate, null, "2020-09 is not in the notes, so no month is invented");
  assert.deepEqual(body.result.languages, [], "Arabic is not in the notes");
  for (const value of ["Harvard University", "Rust", "Arabic"]) assert.ok(body.result.removed.some(item => item.value === value), value);
  // Same notes again: cached, no second provider call, no quota used.
  const again = await POST(await sized(formRequest({ source: "notes", text: NOTES, consent: "yes" })));
  assert.equal((await again.json() as { cached: boolean }).cached, true);
  assert.equal(calls.length, 1);
  assert.equal(runs.length, 1);
  // The CV text is wrapped as untrusted data.
  assert.match(calls[0].user, /^<source>\n/);
  assert.match(calls[0].system, /untrusted data/);
});

test("autofill without a provider is explicit and spends nothing", async () => {
  const { store, runs } = memoryStore();
  const { POST } = profileAutofillHandlers(async () => access(store), () => null);
  const response = await POST(await sized(formRequest({ source: "notes", text: NOTES, consent: "yes" })));
  assert.equal(response.status, 501);
  assert.equal(runs.length, 0);
});

test("autofill rejects files that are not PDF or Word and unreadable Word files", async () => {
  const { store } = memoryStore();
  const { provider, calls } = fakeProvider([AI_PROFILE]);
  const { POST } = profileAutofillHandlers(async () => access(store), () => provider);
  const text = new File(["hello"], "cv.txt", { type: "text/plain" });
  assert.equal((await POST(await sized(formRequest({ source: "cv", file: text, consent: "yes" })))).status, 400);
  const fakeDocx = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0])], "cv.docx");
  assert.equal((await POST(await sized(formRequest({ source: "cv", file: fakeDocx, consent: "yes" })))).status, 422);
  assert.equal(calls.length, 0);
});

/** Minimal stored/deflated ZIP with one entry, as Word writes it. */
function zip(name: string, content: string) {
  const data = deflateRawSync(Buffer.from(content, "utf8"));
  const nameBytes = Buffer.from(name);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(content.length, 22); local.writeUInt16LE(nameBytes.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(Buffer.byteLength(content), 24); central.writeUInt16LE(nameBytes.length, 28); central.writeUInt32LE(0, 42);
  const centralStart = local.length + nameBytes.length + data.length;
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(central.length + nameBytes.length, 12); end.writeUInt32LE(centralStart, 16);
  return Buffer.concat([local, nameBytes, data, central, nameBytes, end]);
}

test("Word CV text is read from word/document.xml with paragraphs and entities", async () => {
  const xml = `<w:document><w:body><w:p><w:r><w:t>Rana Haddad</w:t></w:r></w:p><w:p><w:r><w:t>Java &amp; Spring Boot</w:t></w:r><w:tab/><w:r><w:t>2020</w:t></w:r></w:p></w:body></w:document>`;
  const text = docxText(zip("word/document.xml", xml));
  assert.equal(text.trim(), "Rana Haddad\nJava & Spring Boot 2020");
  assert.throws(() => docxText(zip("other.xml", xml)), /could not be read/);
});

test("a Word CV goes through extraction, the AI and grounding end to end", async () => {
  const { store } = memoryStore();
  const { provider, calls } = fakeProvider([AI_PROFILE]);
  const { POST } = profileAutofillHandlers(async () => access(store), () => provider);
  const xml = `<w:document><w:body>${NOTES.split(". ").map(line => `<w:p><w:r><w:t>${line}</w:t></w:r></w:p>`).join("")}</w:body></w:document>`;
  const file = new File([zip("word/document.xml", xml)], "Rana CV.docx");
  const response = await POST(await sized(formRequest({ source: "cv", file, consent: "yes" })));
  assert.equal(response.status, 200);
  assert.match(calls[0].system, /the text of a CV/);
  assert.equal((await response.json() as { result: { profile: { name: string } } }).result.profile.name, "Rana Haddad");
});
