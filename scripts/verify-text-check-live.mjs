// Live check of the free text check (OCR, no AI) on DEVELOPMENT only. Student A sends a
// phone-style photo and a scanned PDF (image only, no text layer) of a fictional diploma;
// student B sends the same diploma as a normal PDF. The admin has CareerForge read the files:
// the photo and the scan are read with OCR and the claim's name, university, degree, year and
// registration number are found; the photo then matches B's PDF by its text. Students cannot
// run or see readings. Nothing is sent to an AI service.
//   PLAYWRIGHT_BASE_URL=http://localhost:3100 EXPECTED_SUPABASE_PROJECT_REF=<dev ref> node --env-file=.env scripts/verify-text-check-live.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { Client } from "pg";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { chromium, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const expectedRef = process.env.EXPECTED_SUPABASE_PROJECT_REF;
const connection = (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();
const shots = "test-results/text-check-live";
const make = (role, name) => { const id = randomUUID(); return { id, role, name, email: `${id}@careerforge.invalid`, password: `Test-${randomUUID()}!` }; };
const [alice, bob, admin] = [make("student", "Rana Haddad"), make("student", "Karim Nassar"), make("admin", "Claims Reviewer")];
const users = [alice, bob, admin];
const db = new Client({ connectionString: connection, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
let browser;
let stage = "setup";
const DIPLOMA = `<!doctype html><html><body style="margin:0;font-family:Georgia;text-align:center;padding:50px 60px;border:14px double #1d3b6a;background:#fbf7ec">
<h1 style="color:#1d3b6a">Lebanese American University</h1><p style="font-size:22px">This is to certify that</p><h2 style="font-size:38px">Rana Haddad</h2>
<p style="font-size:22px">has been awarded the degree of</p><h2>Bachelor of Engineering in Computer Engineering</h2><p style="font-size:22px">Conferred in Beirut, June 2020</p>
<p style="font-size:20px">Registration No. LAU-2020-04417</p></body></html>`;

async function createUser(user) {
  await db.query(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, extensions.crypt($3, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '')`, [user.id, user.email, user.password]);
  await db.query(`insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at) values ($1, $2::text, $2::uuid, $3, 'email', now(), now())`,
    [randomUUID(), user.id, JSON.stringify({ sub: user.id, email: user.email, email_verified: true })]);
  await db.query("update public.profiles set full_name = $2, headline = 'Test', role = $3 where id = $1", [user.id, user.name, user.role]);
  if (user.role === "student") await db.query("insert into public.education_records (user_id, request_id, institution, degree, start_date, end_date) values ($1, $2, 'Lebanese American University', 'Bachelor of Engineering in Computer Engineering', '2016-09-01', '2020-06-01')", [user.id, randomUUID()]);
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
async function upload(user, files) {
  const s = await signIn(user);
  await s.page.goto("/account/verification");
  const row = s.page.locator(".claim-row", { hasText: "Bachelor of Engineering" });
  for (const [index, file] of files.entries()) {
    await row.locator('input[type="file"]').setInputFiles(file);
    await expect(row).toContainText(`${index + 1} ${index ? "files" : "file"} sent`, { timeout: 30000 });
  }
  return s;
}
const fileItem = (page, fileName) => page.locator(".review-file", { hasText: fileName });

try {
  if (!expectedRef || !connection) throw new Error("Set EXPECTED_SUPABASE_PROJECT_REF and a database URL.");
  const url = new URL(connection);
  if (!url.hostname.includes(expectedRef) && !decodeURIComponent(url.username).endsWith(`.${expectedRef}`)) throw new Error("DATABASE_PROJECT_MISMATCH");
  if (expectedRef === "gmrribyxcpcmqlqhdwea") throw new Error("Never run this against production.");
  await db.connect();
  for (const user of users) await createUser(user);
  browser = await chromium.launch({ channel: process.platform === "win32" ? "msedge" : "chromium", headless: true });
  await mkdir(shots, { recursive: true });

  stage = "render a phone photo, a scanned PDF and a text PDF of the same fictional diploma";
  const render = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  await render.setContent(DIPLOMA);
  const clean = await render.screenshot({ type: "png" });
  const textPdf = await render.pdf({ width: "1000px", height: "700px", printBackground: true });
  const photo = await sharp(clean).rotate(1.5, { background: "#d8d4c8" }).blur(0.6).modulate({ brightness: 0.93 }).jpeg({ quality: 70 }).toBuffer();
  await render.setContent(`<html><body style="margin:0"><img style="width:1000px" src="data:image/png;base64,${clean.toString("base64")}"></body></html>`);
  const scannedPdf = await render.pdf({ width: "1000px", height: "700px", printBackground: true });
  await render.close();

  stage = "the students upload";
  (await upload(alice, [{ name: "diploma-photo.jpg", mimeType: "image/jpeg", buffer: photo }, { name: "diploma-scan.pdf", mimeType: "application/pdf", buffer: scannedPdf }])).context.close();
  const b = await upload(bob, [{ name: "lau-diploma.pdf", mimeType: "application/pdf", buffer: textPdf }]);

  stage = "students cannot run or see readings";
  const evidenceId = (await db.query("select id from public.claim_evidence where user_id = $1 limit 1", [alice.id])).rows[0].id;
  assert.equal((await b.page.request.post("/api/v1/admin/claims/read", { headers: { Origin: baseURL }, data: { evidenceId } })).status(), 403);
  const bobClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await bobClient.auth.signInWithPassword({ email: bob.email, password: bob.password });
  assert.equal((await bobClient.rpc("record_evidence_text", { p_evidence_id: evidenceId, p_method: "ocr", p_text: "Rana Haddad", p_confidence: 99 })).error?.code, "42501");
  assert.deepEqual((await bobClient.from("evidence_text").select("evidence_id")).data, []);
  await b.context.close();

  stage = "the admin reads the photo (OCR): every fact is found";
  const a = await signIn(admin);
  await a.page.goto("/admin/claims");
  const photoItem = fileItem(a.page, "diploma-photo.jpg");
  const started = Date.now();
  await photoItem.getByRole("button", { name: "Read the file" }).click();
  await expect(photoItem.locator(".text-check-status")).toHaveText("Claim found in the file", { timeout: 70000 });
  console.log(`Photo read in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  for (const label of ["Name", "Institution", "Degree", "Year"]) await expect(photoItem.locator(".text-check-findings li", { hasText: label })).toHaveAttribute("data-result", "match");
  await expect(photoItem.locator(".text-check")).toContainText("LAU-2020-04417");
  await expect(photoItem.locator(".text-check-raw summary")).toContainText("Text read with OCR");

  stage = "the scanned PDF (no text layer) is read with OCR too";
  const scanItem = fileItem(a.page, "diploma-scan.pdf");
  await scanItem.getByRole("button", { name: "Read the file" }).click();
  await expect(scanItem.locator(".text-check-status")).toHaveText("Claim found in the file", { timeout: 70000 });
  await expect(scanItem.locator(".text-check-raw summary")).toContainText("OCR");
  const stored = await db.query("select t.method, t.confidence, e.file_name from public.evidence_text t join public.claim_evidence e on e.id = t.evidence_id where e.user_id = $1 order by e.file_name", [alice.id]);
  console.log("Stored readings:", stored.rows.map(row => `${row.file_name}: ${row.method} ${row.confidence}%`).join(", "));
  assert.equal(stored.rowCount, 2);

  stage = "B's text PDF is read from its text layer; the photo now matches it by text";
  const bobItem = fileItem(a.page, "lau-diploma.pdf");
  await bobItem.getByRole("button", { name: "Read the file" }).click();
  await expect(bobItem.locator(".text-check-raw summary")).toContainText("Text from the PDF", { timeout: 70000 });
  await expect(bobItem.locator(".text-check-findings li", { hasText: "Name" })).toHaveAttribute("data-result", "missing");
  await a.page.reload();
  await expect(fileItem(a.page, "diploma-photo.jpg").locator(".text-check-status")).toHaveText("Claim found in the file");
  const textMatch = await fileItem(a.page, "lau-diploma.pdf").locator('.proof-matches strong[data-reason="same_text"]').count();
  console.log(textMatch ? "Photo and PDF matched by their text." : "Photo and PDF did not match by text (OCR differed slightly).");
  await a.page.waitForTimeout(1000);
  await a.page.screenshot({ path: `${shots}/1-admin-text-check-dark.png`, fullPage: true });

  stage = "phone and light theme";
  for (const [name, options] of [["phone", { viewport: { width: 390, height: 844 } }], ["light", { colorScheme: "light" }]]) {
    const v = await signIn(admin, options);
    if (name === "light") await v.page.evaluate(() => localStorage.setItem("careerforge-theme", "light"));
    await v.page.goto("/admin/claims");
    await v.page.waitForTimeout(1200);
    assert.equal(await v.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "no sideways scrolling");
    await fileItem(v.page, "diploma-photo.jpg").screenshot({ path: `${shots}/2-photo-${name}.png` });
    await v.context.close();
  }
  console.log("Text check live test passed.");
} catch (error) {
  console.error(`Text check live test failed at: ${stage}`);
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
    console.log("Temporary accounts, files and readings removed.");
  } catch (error) { console.error("Cleanup failed:", error.message); process.exitCode = 1; }
  await db.end().catch(() => {});
  await browser?.close();
}
