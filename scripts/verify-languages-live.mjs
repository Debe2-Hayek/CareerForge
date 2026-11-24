// Live check of language proficiency on DEVELOPMENT only (no AI, no credits). A temporary
// student adds languages with levels and test results (claiming C2 with an IELTS 7.0, which
// supports C1), sends a score report, edits the level after sending it, and sends it again.
// A temporary admin sees what the score supports, cannot approve the outdated version, then
// approves the corrected one. Database rules are checked directly too.
//   PLAYWRIGHT_BASE_URL=http://localhost:3100 EXPECTED_SUPABASE_PROJECT_REF=<dev ref> node --env-file=.env scripts/verify-languages-live.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { chromium, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const expectedRef = process.env.EXPECTED_SUPABASE_PROJECT_REF;
const connection = (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();
const shots = "test-results/languages-live";
const make = (role, name) => { const id = randomUUID(); return { id, role, name, email: `${id}@careerforge.invalid`, password: `Test-${randomUUID()}!` }; };
const [student, admin] = [make("student", "Rana Haddad"), make("admin", "Claims Reviewer")];
const users = [student, admin];
const db = new Client({ connectionString: connection, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
let browser;
let stage = "setup";
const debugPages = [];
const REPORT = `<!doctype html><html><body style="margin:0;font-family:Arial;padding:40px;background:#fff">
<h2 style="color:#c8102e">Test Report Form (fictional, for testing)</h2><p>Candidate: <b>Rana Haddad</b></p><p>Test date: 01 March 2025</p>
<table border="1" cellpadding="8" style="border-collapse:collapse"><tr><th>Listening</th><th>Reading</th><th>Writing</th><th>Speaking</th><th>Overall</th></tr>
<tr><td>7.5</td><td>7.0</td><td>6.5</td><td>7.0</td><td><b>7.0</b></td></tr></table><p>CEFR level: C1</p></body></html>`;

async function createUser(user) {
  await db.query(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, extensions.crypt($3, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '')`, [user.id, user.email, user.password]);
  await db.query(`insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at) values ($1, $2::text, $2::uuid, $3, 'email', now(), now())`,
    [randomUUID(), user.id, JSON.stringify({ sub: user.id, email: user.email, email_verified: true })]);
  await db.query("update public.profiles set full_name = $2, headline = 'Test', role = $3 where id = $1", [user.id, user.name, user.role]);
}
async function signIn(user, options = {}) {
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 }, ...options });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(`${baseURL}/account`, { timeout: 30000 });
  return { context, page };
}
const noOverflow = async page => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "no sideways scrolling");
async function addLanguage(page, { language, level, test, score, date }) {
  const panel = page.locator("#languages");
  await panel.getByRole("button", { name: "Add a language" }).click();
  await panel.getByLabel("Language", { exact: true }).fill(language);
  await panel.getByLabel("Your level").selectOption(level);
  if (test) {
    await panel.getByLabel("Test result").selectOption(test);
    await panel.getByLabel("Score or level").fill(score);
    if (date) await panel.getByLabel("Test date").fill(date);
  }
}
const languageCard = page => page.locator(".review-card").filter({ has: page.locator(".eyebrow", { hasText: "LANGUAGE · Rana Haddad" }) });

try {
  if (!expectedRef || !connection) throw new Error("Set EXPECTED_SUPABASE_PROJECT_REF and a database URL.");
  const url = new URL(connection);
  if (!url.hostname.includes(expectedRef) && !decodeURIComponent(url.username).endsWith(`.${expectedRef}`)) throw new Error("DATABASE_PROJECT_MISMATCH");
  if (expectedRef === "gmrribyxcpcmqlqhdwea") throw new Error("Never run this against production.");
  await db.connect();
  for (const user of users) await createUser(user);
  browser = await chromium.launch({ channel: process.platform === "win32" ? "msedge" : "chromium", headless: true });
  await mkdir(shots, { recursive: true });

  stage = "the student adds languages; the form shows what each score supports";
  const s = await signIn(student);
  debugPages.push(s.page);
  await s.page.goto("/account/history#languages");
  await expect(s.page.locator("#languages")).toContainText("No languages yet");
  await addLanguage(s.page, { language: "English", level: "C2", test: "ielts", score: "7.0", date: "2025-03-01" });
  await expect(s.page.locator("#languages .language-hint")).toContainText("lower than the C2 you claim");
  await s.page.locator("#languages").screenshot({ path: `${shots}/1-language-form-dark.png` });
  await s.page.getByRole("button", { name: "Add language" }).click();
  await expect(s.page.locator("#languages .notice")).toContainText("English added");
  await addLanguage(s.page, { language: "French", level: "B2", test: "delf_dalf", score: "DELF B2", date: "2019-06-15" });
  await expect(s.page.locator("#languages form .language-hint")).toContainText("supports B2");
  await s.page.getByRole("button", { name: "Add language" }).click();
  await expect(s.page.locator("#languages .notice")).toContainText("French added");
  await addLanguage(s.page, { language: "Arabic", level: "native" });
  await s.page.getByRole("button", { name: "Add language" }).click();
  await expect(s.page.locator(".language-list > li")).toHaveCount(3);
  await addLanguage(s.page, { language: "english", level: "B1" });
  await s.page.getByRole("button", { name: "Add language" }).click();
  await expect(s.page.locator("#languages .form-error")).toContainText("already on your profile");
  await s.page.getByRole("button", { name: "Cancel" }).click();
  await s.page.reload();
  await expect(s.page.locator(".language-list > li")).toHaveCount(3);
  await s.page.waitForTimeout(800);
  await noOverflow(s.page);
  await s.page.locator("#languages").screenshot({ path: `${shots}/2-languages-dark.png` });

  stage = "the database refuses direct writes and other users' rows";
  const direct = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await direct.auth.signInWithPassword({ email: student.email, password: student.password });
  assert.ok((await direct.from("profile_languages").insert({ user_id: student.id, language: "German", level: "C2" })).error, "no direct inserts");
  const englishId = (await db.query("select id from public.profile_languages where user_id = $1 and language = 'English'", [student.id])).rows[0].id;
  assert.ok((await direct.from("profile_languages").update({ level: "A1" }).eq("id", englishId).select()).data?.length !== 1, "no direct updates");
  const other = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await other.auth.signInWithPassword({ email: admin.email, password: admin.password });
  assert.equal((await other.rpc("save_profile_language", { p_id: englishId, p_language: "English", p_level: "A1", p_test: null, p_score: null, p_test_date: null })).error?.code, "P0002", "nobody edits someone else's language");
  assert.equal((await direct.rpc("save_profile_language", { p_id: null, p_language: "German", p_level: "B1", p_test: "ielts", p_score: null, p_test_date: null })).error?.code, "22023", "a test needs a score");

  stage = "the student sends the score report for English";
  const render = await browser.newPage({ viewport: { width: 820, height: 560 } });
  await render.setContent(REPORT);
  const report = await render.screenshot({ type: "png" });
  await render.close();
  await s.page.goto("/account/verification");
  const englishRow = s.page.locator(".claim-row", { hasText: "English" });
  await expect(englishRow).toContainText("C2 · Proficient · IELTS 7.0");
  await englishRow.locator('input[type="file"]').setInputFiles({ name: "ielts-report.png", mimeType: "image/png", buffer: report });
  await expect(englishRow.locator(".claim-badge")).toHaveText("Proof submitted", { timeout: 30000 });
  await expect(s.page.locator(".claims-group", { hasText: "Languages" }).locator(".claim-row")).toHaveCount(3);

  stage = "the admin sees that the score supports C1, not the claimed C2";
  const a = await signIn(admin);
  debugPages.push(a.page);
  await a.page.goto("/admin/claims");
  const card = languageCard(a.page);
  await expect(card.locator(".language-review")).toHaveAttribute("data-verdict", "below");
  await expect(card.locator(".language-review")).toContainText("lower than claimed");
  await expect(card.locator(".language-review")).toContainText("IELTS band 7.0");
  await a.page.waitForTimeout(1000);
  await card.screenshot({ path: `${shots}/3-admin-below-dark.png` });

  stage = "the student corrects the level; the old proof can no longer be approved";
  await s.page.goto("/account/history#languages");
  await s.page.locator(".language-list > li", { hasText: "English" }).getByRole("button", { name: "Edit" }).click();
  await s.page.locator("#languages").getByLabel("Your level").selectOption("C1");
  await s.page.getByRole("button", { name: "Save changes" }).click();
  await expect(s.page.locator("#languages .notice")).toContainText("English updated");
  await card.getByRole("button", { name: "Approve: proof matches" }).click();
  await expect(card.locator(".form-error")).toContainText("edited this record", { timeout: 30000 });
  await s.page.goto("/account/verification");
  await expect(s.page.locator(".claim-row", { hasText: "English" }).locator(".claim-badge")).toHaveText("Changed since proof");

  stage = "new proof for the corrected level is approved";
  await s.page.locator(".claim-row", { hasText: "English" }).locator('input[type="file"]').setInputFiles({ name: "ielts-report.png", mimeType: "image/png", buffer: report });
  await expect(s.page.locator(".claim-row", { hasText: "English" }).locator(".claim-badge")).toHaveText("Proof submitted", { timeout: 30000 });
  await a.page.reload();
  await expect(languageCard(a.page).locator(".language-review")).toHaveAttribute("data-verdict", "supports");
  await a.page.screenshot({ path: `${shots}/4-admin-supports-dark.png`, fullPage: true });
  await languageCard(a.page).getByRole("button", { name: "Approve: proof matches" }).click();
  await expect(a.page.getByText(/Approved: English · C1/)).toBeVisible({ timeout: 15000 });
  await s.page.reload();
  await expect(s.page.locator(".claim-row", { hasText: "English" }).locator(".claim-badge")).toHaveText("Reviewed");
  await noOverflow(s.page);
  await s.page.screenshot({ path: `${shots}/5-verification-dark.png`, fullPage: true });

  stage = "removing a language";
  await s.page.goto("/account/history#languages");
  s.page.once("dialog", dialog => dialog.accept());
  await s.page.locator(".language-list > li", { hasText: "Arabic" }).getByRole("button", { name: "Remove" }).click();
  await expect(s.page.locator(".language-list > li")).toHaveCount(2);

  stage = "phone and light theme";
  for (const [name, options] of [["phone", { viewport: { width: 390, height: 844 } }], ["light", { colorScheme: "light" }]]) {
    const v = await signIn(student, options);
    if (name === "light") await v.page.evaluate(() => localStorage.setItem("careerforge-theme", "light"));
    await v.page.goto("/account/history#languages");
    await v.page.locator(".language-list > li", { hasText: "French" }).getByRole("button", { name: "Edit" }).click();
    await v.page.waitForTimeout(900);
    await noOverflow(v.page);
    await v.page.locator("#languages").screenshot({ path: `${shots}/6-languages-${name}.png` });
    await v.context.close();
  }
  console.log("Languages live test passed.");
} catch (error) {
  console.error(`Languages live test failed at: ${stage}`);
  console.error(error.message);
  process.exitCode = 1;
  for (const [index, page] of debugPages.entries()) await page.screenshot({ path: `${shots}/failure-${index}.png`, fullPage: true }).catch(() => {});
  const state = await db.query("select c.status, c.source_revision = l.revision as same_revision, (select string_agg(action, ',' order by id) from public.claim_events e where e.claim_id = c.id) as events from public.claims c join public.profile_languages l on l.id = c.language_id where c.user_id = $1", [student.id]).catch(e => ({ rows: [e.message] }));
  console.error("Claim state:", JSON.stringify(state.rows));
} finally {
  try {
    const paths = await db.query("select storage_path from public.claim_evidence where user_id = $1", [student.id]);
    await db.query("delete from public.claim_evidence where user_id = $1", [student.id]);
    if (paths.rowCount) {
      const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
      await client.auth.signInWithPassword({ email: student.email, password: student.password });
      await client.storage.from("claim-evidence").remove(paths.rows.map(row => row.storage_path));
    }
    await db.query("delete from auth.users where id = any($1::uuid[])", [users.map(u => u.id)]);
    console.log("Temporary accounts, languages, claims and files removed.");
  } catch (error) { console.error("Cleanup failed:", error.message); process.exitCode = 1; }
  await db.end().catch(() => {});
  await browser?.close();
}
