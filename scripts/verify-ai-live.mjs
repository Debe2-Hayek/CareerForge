// Live check of AI autofill and builder generation on DEVELOPMENT only.
// Creates one temporary confirmed account, uploads a fictional CV (rendered to
// PDF here), reviews and saves the suggestions, repeats the same CV to prove the
// cache (no second AI call), runs one builder generation, then deletes the account.
// Spends at most two DeepSeek calls. Usage (with `next dev -p 3100` running):
//   PLAYWRIGHT_BASE_URL=http://localhost:3100 node --env-file=.env scripts/verify-ai-live.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { Client } from "pg";
import { chromium, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const expectedRef = process.env.EXPECTED_SUPABASE_PROJECT_REF;
const user = { id: randomUUID(), password: `Test-${randomUUID()}!` };
user.email = `${user.id}@careerforge.invalid`;
const db = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
const shots = "test-results/ai-live";
const CV_HTML = `<!doctype html><html><body style="font-family:Arial;padding:40px;line-height:1.5">
<h1>Rana Haddad</h1><p>Backend Developer · Beirut, Lebanon · rana.haddad@example.com</p>
<h2>Summary</h2><p>Backend developer who builds payment APIs in Java and Spring Boot.</p>
<h2>Experience</h2><p><b>Backend Developer</b>, Murex — Sep 2020 – Present<br>Building payment APIs in Java and Spring Boot for banking clients.</p>
<p><b>Software Intern</b>, Areeba — Jun 2019 – Aug 2019<br>Wrote integration tests for card payment services.</p>
<h2>Education</h2><p><b>B.E. Computer Engineering</b>, Lebanese American University, 2016 – 2020</p>
<h2>Skills</h2><p>Java, Spring Boot, PostgreSQL, Docker, Git</p>
<h2>Projects</h2><p><b>Budget Tracker</b>: a personal budget tracker app built with Spring Boot.</p>
<h2>Languages</h2><p>Arabic, English, French</p></body></html>`;

let browser;
let stage = "connection";
try {
  if (!process.env.DATABASE_URL) throw new Error("MISSING_DATABASE_URL");
  if (!expectedRef) throw new Error("Set EXPECTED_SUPABASE_PROJECT_REF to the development project ref.");
  const url = new URL(process.env.DATABASE_URL.trim());
  if (!url.hostname.includes(expectedRef) && !decodeURIComponent(url.username).endsWith(`.${expectedRef}`)) throw new Error("DATABASE_PROJECT_MISMATCH");
  await db.connect();
  stage = "temporary test user";
  await db.query(`insert into auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
     raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
     confirmation_token, recovery_token, email_change_token_new, email_change,
     email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2,
     extensions.crypt($3, extensions.gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '')`, [user.id, user.email, user.password]);
  await db.query(`insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
    values ($1, $2::text, $2::uuid, $3, 'email', now(), now())`, [randomUUID(), user.id, JSON.stringify({ sub: user.id, email: user.email, email_verified: true })]);

  browser = await chromium.launch({ channel: process.platform === "win32" ? "msedge" : "chromium", headless: true });
  await mkdir(shots, { recursive: true });
  stage = "render fictional CV to PDF";
  const pdfPage = await browser.newPage();
  await pdfPage.setContent(CV_HTML);
  const cvPath = `${shots}/rana-haddad-cv.pdf`;
  await pdfPage.pdf({ path: cvPath, format: "A4" });
  await pdfPage.close();

  stage = "sign in";
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(`${baseURL}/account`, { timeout: 30000 });

  stage = "upload CV";
  const read = page.getByRole("button", { name: "Read my CV with AI" });
  await expect(read).toBeDisabled();
  await page.locator("#profile-cv-file").setInputFiles(cvPath);
  await expect(page.getByText("rana-haddad-cv.pdf")).toBeVisible();
  await page.screenshot({ path: `${shots}/1-ready.png` });
  await read.click();
  await expect(page.locator(".profile-ai-error")).toContainText("Tick the box");
  await page.getByRole("checkbox", { name: /I agree to send my CV text/ }).check();

  stage = "AI read (live DeepSeek call 1)";
  const started = Date.now();
  await read.click();
  await expect(page.getByText(/Reading your CV|Finding your education|Checking every fact/)).toBeVisible();
  const review = page.getByRole("heading", { name: "Check what the AI found" });
  await expect(review).toBeVisible({ timeout: 90000 });
  console.log(`AI answer in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  await expect(review).toBeFocused();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${shots}/2-review.png`, fullPage: true });
  const reviewText = await page.locator(".profile-ai-review").innerText();
  console.log("Review:\n" + reviewText.split("\n").filter(Boolean).slice(0, 60).join(" | "));
  for (const fact of ["Rana Haddad", "Murex", "Lebanese American University", "Java"]) assert.ok(reviewText.includes(fact), `review shows ${fact}`);

  stage = "save";
  await page.getByRole("button", { name: /^Save \d+ to my profile$/ }).click();
  await expect(page.locator(".profile-ai-done")).toContainText("Saved", { timeout: 30000 });
  await expect(page.locator("#account-name")).toHaveValue("Rana Haddad");
  await page.screenshot({ path: `${shots}/3-saved.png`, fullPage: true });
  const education = await (await page.request.get("/api/v1/education")).json();
  const experience = await (await page.request.get("/api/v1/experience")).json();
  console.log("Saved education:", education.records.map(r => `${r.degree} @ ${r.institution} (${r.evidenceStatus})`));
  console.log("Saved experience:", experience.records.map(r => `${r.role} @ ${r.company} ${r.startDate ?? "?"}..${r.isCurrent ? "now" : r.endDate ?? "?"}`));
  assert.ok(education.records.length >= 1 && experience.records.length >= 1);

  stage = "same CV again (must be cached, no AI call)";
  await page.getByRole("button", { name: "Close" }).click();
  await page.locator("#profile-cv-file").setInputFiles(cvPath);
  await read.click();
  await expect(page.getByText("did not use an AI request")).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/Nothing new was found|Check what the AI found/).first()).toBeVisible();

  stage = "builder generation (live DeepSeek call 2)";
  await page.goto("/documents");
  const notes = page.locator("#raw");
  await expect(notes).toBeVisible({ timeout: 30000 });
  await notes.fill("i'm rana haddad, backend developer. worked at Murex for 3 years building payment APIs in Java. studied Computer Engineering at Lebanese American University. know Java, Spring Boot, PostgreSQL. built a budget tracker app.");
  await page.getByRole("button", { name: "Generate with AI" }).click();
  await expect(page.getByText(/Done\. Click any text|Couldn't generate/)).toBeVisible({ timeout: 90000 });
  const note = await page.getByText(/Done\. Click any text|Couldn't generate/).innerText();
  console.log("Builder:", note);
  assert.match(note, /Done/);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${shots}/4-builder.png`, fullPage: false });

  const runs = await db.query("select feature, status, model, prompt_version from public.ai_runs where user_id = $1 order by created_at", [user.id]);
  console.log("AI ledger:", runs.rows.map(r => `${r.feature}:${r.status}:${r.model}:${r.prompt_version}`));
  assert.equal(runs.rows.length, 2, "exactly two AI calls: one CV read, one builder generation");
  assert.deepEqual(errors, []);
  console.log("AI live check passed.");
} catch (error) {
  console.error(`AI live check failed at: ${stage}`);
  console.error(error.message);
  process.exitCode = 1;
} finally {
  try {
    await db.query("delete from auth.users where id = $1", [user.id]);
    console.log("Temporary account, profile, records and AI runs removed.");
  } catch { console.error("Cleanup failed; inspect @careerforge.invalid test accounts."); process.exitCode = 1; }
  await db.end().catch(() => {});
  await browser?.close();
}
