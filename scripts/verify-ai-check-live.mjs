// Live check of the admin AI proof check on DEVELOPMENT only. A temporary student uploads
// a diploma PDF and a photo; a temporary admin runs the AI check on both and sees the
// field-by-field comparison. Works with the development test AI (dev server started with
// AI_FAKE=1, no credits) or with the real AI (key with credits; 2 AI calls).
//   PLAYWRIGHT_BASE_URL=http://localhost:3100 EXPECTED_SUPABASE_PROJECT_REF=<dev ref> node --env-file=.env scripts/verify-ai-check-live.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { chromium, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const expectedRef = process.env.EXPECTED_SUPABASE_PROJECT_REF;
const connection = (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();
const shots = "test-results/ai-check-live";
// The free text check (OCR) panel shares the ai-check styles; only the AI panels count here.
const AI_PANEL = ".ai-check:not(.text-check)";
const make = role => { const id = randomUUID(); return { id, role, email: `${id}@careerforge.invalid`, password: `Test-${randomUUID()}!` }; };
const [student, admin] = [make("student"), make("admin")];
const users = [student, admin];
const db = new Client({ connectionString: connection, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
let browser;
let stage = "setup";
const DIPLOMA = `<!doctype html><html><body style="font-family:Georgia;text-align:center;padding:60px;border:12px double #333">
<h1>Lebanese American University</h1><p>This is to certify that</p><h2>Rana Haddad</h2>
<p>has been awarded the degree of</p><h2>Bachelor of Engineering in Computer Engineering</h2>
<p>Conferred in Beirut, June 2020</p><p>Registration No. LAU-2020-04417</p><p>Verify at https://verify.example.edu/LAU-2020-04417</p></body></html>`;

async function createUser(user, name) {
  await db.query(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, extensions.crypt($3, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '')`, [user.id, user.email, user.password]);
  await db.query(`insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at) values ($1, $2::text, $2::uuid, $3, 'email', now(), now())`,
    [randomUUID(), user.id, JSON.stringify({ sub: user.id, email: user.email, email_verified: true })]);
  await db.query("update public.profiles set full_name = $2, headline = 'Test', role = $3 where id = $1", [user.id, name, user.role]);
  if (user.role === "student") await db.query("insert into public.education_records (user_id, request_id, institution, degree, start_date, end_date) values ($1, $2, 'Lebanese American University', 'B.E. Computer Engineering', '2016-09-01', '2020-06-01')", [user.id, randomUUID()]);
}
async function signIn(user, options = {}) {
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 }, ...options });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`^${baseURL}/(account|admin)$`), { timeout: 30000 });
  return { context, page };
}

try {
  if (!expectedRef || !connection) throw new Error("Set EXPECTED_SUPABASE_PROJECT_REF and a database URL.");
  const url = new URL(connection);
  if (!url.hostname.includes(expectedRef) && !decodeURIComponent(url.username).endsWith(`.${expectedRef}`)) throw new Error("DATABASE_PROJECT_MISMATCH");
  if (expectedRef === "gmrribyxcpcmqlqhdwea") throw new Error("Never run this against production.");
  await db.connect();
  await createUser(student, "Rana Haddad");
  await createUser(admin, "Claims Reviewer");
  browser = await chromium.launch({ channel: process.platform === "win32" ? "msedge" : "chromium", headless: true });
  await mkdir(shots, { recursive: true });

  stage = "render the fictional diploma as PDF and PNG";
  const render = await browser.newPage({ viewport: { width: 900, height: 640 } });
  await render.setContent(DIPLOMA);
  const pdf = await render.pdf({ format: "A4", landscape: true });
  const png = await render.screenshot({ type: "png" });
  await render.close();

  stage = "student uploads both files";
  const s = await signIn(student);
  await s.page.goto("/account/verification");
  const row = s.page.locator(".claim-row", { hasText: "B.E. Computer Engineering" });
  await row.locator('input[type="file"]').setInputFiles({ name: "diploma.pdf", mimeType: "application/pdf", buffer: pdf });
  await expect(row.locator(".claim-badge")).toHaveText("Proof submitted", { timeout: 30000 });
  await row.locator('input[type="file"]').setInputFiles({ name: "diploma-photo.png", mimeType: "image/png", buffer: png });
  await expect(row).toContainText("2 files sent", { timeout: 30000 });

  stage = "admin runs the AI check on both files";
  const a = await signIn(admin);
  await a.page.goto("/admin/claims");
  const card = a.page.locator(".review-card").first();
  await expect(card.locator(AI_PANEL)).toHaveCount(2);
  for (const index of [0, 1]) {
    const panel = card.locator(AI_PANEL).nth(index);
    await panel.getByRole("button", { name: "Run AI check" }).click();
    await expect(panel.locator(".ai-check-table")).toBeVisible({ timeout: 90000 });
  }
  const tableText = await card.locator(".ai-check-table").first().innerText();
  console.log("AI check (file 1):\n" + tableText.split("\n").filter(Boolean).join(" | "));
  const test = await card.locator(`${AI_PANEL} .ai-check-title em`).count();
  console.log(test ? "Mode: development test AI (no credits used)" : "Mode: real AI");
  await expect(card.locator(".ai-check-status").first()).toHaveText(/Consistent|Needs your attention/);
  await a.page.waitForTimeout(1200);
  await a.page.screenshot({ path: `${shots}/admin-ai-check-dark.png`, fullPage: true });

  stage = "the result is stored and survives a reload";
  await a.page.reload();
  await expect(card.locator(".ai-check-table")).toHaveCount(2);
  const stored = await db.query("select status, model from public.evidence_checks k join public.claim_evidence e on e.id = k.evidence_id where e.user_id = $1", [student.id]);
  console.log("Stored checks:", stored.rows.map(r => `${r.status}/${r.model}`));
  assert.equal(stored.rowCount, 2);

  stage = "the student cannot run checks";
  const denied = await s.page.request.post("/api/v1/admin/claims/check", { data: { evidenceId: randomUUID() }, headers: { Origin: baseURL } });
  assert.equal(denied.status(), 403);

  stage = "phone and light theme screenshots";
  for (const [name, options] of [["phone", { viewport: { width: 390, height: 844 } }], ["light", { colorScheme: "light" }]]) {
    const v = await signIn(admin, options);
    if (name === "light") await v.page.evaluate(() => localStorage.setItem("careerforge-theme", "light"));
    await v.page.goto("/admin/claims");
    await v.page.waitForTimeout(1300);
    assert.equal(await v.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "no sideways scrolling");
    await v.page.screenshot({ path: `${shots}/admin-ai-check-${name}.png`, fullPage: true });
    await v.context.close();
  }
  console.log("AI check live test passed.");
} catch (error) {
  console.error(`AI check live test failed at: ${stage}`);
  console.error(error.message);
  process.exitCode = 1;
} finally {
  try {
    const paths = await db.query("select user_id, storage_path from public.claim_evidence where user_id = any($1::uuid[])", [users.map(u => u.id)]);
    await db.query("delete from public.claim_evidence where user_id = any($1::uuid[])", [users.map(u => u.id)]);
    for (const user of users) {
      const mine = paths.rows.filter(row => row.user_id === user.id).map(row => row.storage_path);
      if (!mine.length) continue;
      const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
      await client.auth.signInWithPassword({ email: user.email, password: user.password });
      await client.storage.from("claim-evidence").remove(mine);
    }
    await db.query("delete from auth.users where id = any($1::uuid[])", [users.map(u => u.id)]);
    console.log("Temporary accounts, claims, checks and files removed.");
  } catch (error) { console.error("Cleanup failed:", error.message); process.exitCode = 1; }
  await db.end().catch(() => {});
  await browser?.close();
}
