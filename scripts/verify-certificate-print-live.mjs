// Live check of the printable workshop certificate on DEVELOPMENT only (no AI). A temporary
// holder opens "Download" from their certificates: the page shows their name, the result, the
// workshop and a QR code that opens the public check; saved as PDF it is exactly one A4
// landscape page (also with an Arabic name). Another student cannot open it; a revoked
// certificate cannot be printed. Then everything is deleted.
//   PLAYWRIGHT_BASE_URL=http://localhost:3100 EXPECTED_SUPABASE_PROJECT_REF=<dev ref> node --env-file=.env scripts/verify-certificate-print-live.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { Client } from "pg";
import { chromium, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const expectedRef = process.env.EXPECTED_SUPABASE_PROJECT_REF;
const connection = (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();
const shots = "test-results/certificate-print-live";
const make = name => { const id = randomUUID(); return { id, name, email: `${id}@careerforge.invalid`, password: `Test-${randomUUID()}!` }; };
const [holder, other] = [make("Rana Haddad"), make("Karim Nassar")];
const db = new Client({ connectionString: connection, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
let browser;
let stage = "setup";
let workshopId;

async function createUser(user) {
  await db.query(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, extensions.crypt($3, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '')`, [user.id, user.email, user.password]);
  await db.query(`insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at) values ($1, $2::text, $2::uuid, $3, 'email', now(), now())`,
    [randomUUID(), user.id, JSON.stringify({ sub: user.id, email: user.email, email_verified: true })]);
  await db.query("update public.profiles set full_name = $2, headline = 'Test' where id = $1", [user.id, user.name]);
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
const pdfPages = pdf => (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

try {
  if (!expectedRef || !connection) throw new Error("Set EXPECTED_SUPABASE_PROJECT_REF and a database URL.");
  const url = new URL(connection);
  if (!url.hostname.includes(expectedRef) && !decodeURIComponent(url.username).endsWith(`.${expectedRef}`)) throw new Error("DATABASE_PROJECT_MISMATCH");
  if (expectedRef === "gmrribyxcpcmqlqhdwea") throw new Error("Never run this against production.");
  await db.connect();
  for (const user of [holder, other]) await createUser(user);
  // A finished assessed workshop with one issued certificate (the issuing flow itself is covered by verify-workshop-certificates-live.mjs).
  workshopId = (await db.query(`insert into public.certified_workshops (title, summary, mode, starts_at, ends_at, capacity, certificate_kind, pass_mark, trainer_display, agreement_note, status)
    values ('Docker in a Day', 'Hands on', 'online', now() - interval '3 days', now() - interval '3 days' + interval '6 hours', 20, 'assessed', 70, 'Nadia Khalil', 'Agreement TR-TEST', 'closed') returning id`)).rows[0].id;
  const enrollment = (await db.query("insert into public.workshop_enrollments (workshop_id, user_id, show_name, attended, score) values ($1, $2, false, true, 88) returning id", [workshopId, holder.id])).rows[0].id;
  const certificateId = (await db.query("insert into public.workshop_certificates (enrollment_id, workshop_id, user_id, kind, scope, holder_name) values ($1, $2, $3, 'assessed', 'Passed the workshop assessment: 88/100 (pass mark 70)', null) returning id", [enrollment, workshopId, holder.id])).rows[0].id;
  browser = await chromium.launch({ channel: process.platform === "win32" ? "msedge" : "chromium", headless: true });
  await mkdir(shots, { recursive: true });

  stage = "the holder downloads the certificate";
  const s = await signIn(holder);
  await s.page.goto("/account/certificates");
  await s.page.getByRole("link", { name: "Download" }).click();
  await expect(s.page).toHaveURL(new RegExp(`/account/certificates/${certificateId}/print$`), { timeout: 60000 });
  const paper = s.page.locator(".certificate-paper");
  await expect(paper.locator(".certificate-name")).toHaveText("Rana Haddad");
  await expect(paper).toContainText("passed the workshop assessment: 88/100 (pass mark 70)");
  await expect(paper).toContainText("Docker in a Day");
  await expect(paper).toContainText("Nadia Khalil");
  await expect(paper).toContainText(`/certificates/${certificateId}`);
  await expect(paper).toContainText("not an accredited qualification");
  assert.equal(await paper.locator(".certificate-qr svg path").count() > 0, true, "the QR code is drawn");
  await s.page.waitForTimeout(800);
  await s.page.screenshot({ path: `${shots}/1-print-page-dark.png`, fullPage: true });

  stage = "saved as PDF it is exactly one A4 landscape page";
  await s.page.emulateMedia({ media: "print" });
  await s.page.screenshot({ path: `${shots}/2-print-preview.png`, fullPage: true });
  const pdf = await s.page.pdf({ preferCSSPageSize: true, printBackground: true });
  await writeFile(`${shots}/certificate.pdf`, pdf);
  assert.equal(pdfPages(pdf), 1, "one page");
  const [, , width, height] = pdf.toString("latin1").match(/\/MediaBox\s*\[([^\]]+)\]/)[1].trim().split(/\s+/).map(Number);
  assert.ok(Math.abs(width - 841.9) < 2 && Math.abs(height - 595.3) < 2, `A4 landscape (${width} x ${height})`);
  await s.page.emulateMedia({ media: "screen" });

  stage = "an Arabic name prints on one page too";
  await db.query("update public.profiles set full_name = 'رنا حداد' where id = $1", [holder.id]);
  await s.page.reload();
  await expect(s.page.locator(".certificate-name")).toHaveText("رنا حداد");
  await s.page.emulateMedia({ media: "print" });
  const arabic = await s.page.pdf({ preferCSSPageSize: true, printBackground: true });
  assert.equal(pdfPages(arabic), 1);
  await s.page.screenshot({ path: `${shots}/3-arabic-print.png`, fullPage: true });
  await s.page.emulateMedia({ media: "screen" });

  stage = "another student cannot open it";
  const o = await signIn(other);
  await o.page.goto(`/account/certificates/${certificateId}/print`);
  await expect(o.page.locator(".certificate-paper")).toHaveCount(0);
  assert.equal((await o.page.locator("body").innerText()).includes("حداد"), false);
  await o.context.close();

  stage = "a revoked certificate cannot be printed";
  await db.query("update public.workshop_certificates set revoked_at = now(), revoke_reason = 'test' where id = $1", [certificateId]);
  await s.page.reload();
  await expect(s.page.locator(".certificate-paper")).toHaveCount(0);
  await expect(s.page.locator(".certificate-print-tools .form-error")).toContainText("revoked");
  await s.page.goto("/account/certificates");
  await expect(s.page.getByRole("link", { name: "Download" })).toHaveCount(0);
  await s.context.close();

  stage = "phone and light theme";
  await db.query("update public.workshop_certificates set revoked_at = null, revoke_reason = null where id = $1", [certificateId]);
  for (const [name, options] of [["phone", { viewport: { width: 390, height: 844 } }], ["light", { colorScheme: "light" }]]) {
    const v = await signIn(holder, options);
    if (name === "light") await v.page.evaluate(() => localStorage.setItem("careerforge-theme", "light"));
    await v.page.goto(`/account/certificates/${certificateId}/print`);
    await v.page.waitForTimeout(800);
    const wide = await v.page.evaluate(() => [...document.querySelectorAll("body *")].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 5).map(el => el.tagName + "." + el.className + " " + Math.round(el.getBoundingClientRect().right)));
    if (wide.length) console.log(name, "too wide:", wide.join(" | "));
    assert.equal(await v.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "no sideways scrolling");
    await v.page.screenshot({ path: `${shots}/4-${name}.png`, fullPage: true });
    await v.context.close();
  }
  console.log("Certificate print live test passed.");
} catch (error) {
  console.error(`Certificate print live test failed at: ${stage}`);
  console.error(error.message);
  process.exitCode = 1;
} finally {
  try {
    if (workshopId) await db.query("delete from public.certified_workshops where id = $1", [workshopId]);
    await db.query("delete from auth.users where id = any($1::uuid[])", [[holder.id, other.id]]);
    console.log("Temporary workshop, accounts and certificate removed.");
  } catch (error) { console.error("Cleanup failed:", error.message); process.exitCode = 1; }
  await db.end().catch(() => {});
  await browser?.close();
}
