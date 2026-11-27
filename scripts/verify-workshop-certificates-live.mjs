// Live check of CareerForge workshops and certificates on DEVELOPMENT only (no AI). An admin
// creates an assessed workshop (pass mark 70) and assigns a trainer; three learners enroll (one
// hides their name); an outsider tries to issue or write certificates and is refused. The
// session times are then moved into the past in the database (to simulate the workshop taking
// place). The trainer records attendance and scores, is blocked until the admin records the
// trainer agreement, then issues certificates: only the two who passed get one, and only once.
// Public checks show the name only with consent; the admin revokes one and its check says so;
// the certificate appears on the holder's checked-profile page.
//   PLAYWRIGHT_BASE_URL=http://localhost:3100 EXPECTED_SUPABASE_PROJECT_REF=<dev ref> node --env-file=.env scripts/verify-workshop-certificates-live.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { chromium, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const expectedRef = process.env.EXPECTED_SUPABASE_PROJECT_REF;
const connection = (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();
const shots = "test-results/workshop-certificates-live";
const make = (role, name) => { const id = randomUUID(); return { id, role, name, email: `${id}@careerforge.invalid`, password: `Test-${randomUUID()}!` }; };
const admin = make("admin", "Workshop Admin");
const trainer = make("student", "Nadia Trainer");
const alice = make("student", "Rana Haddad");
const bob = make("student", "Karim Nassar");
const carol = make("student", "Maya Khoury");
const outsider = make("student", "Outside User");
const users = [admin, trainer, alice, bob, carol, outsider];
const db = new Client({ connectionString: connection, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
const TITLE = `Docker in a day ${randomUUID().slice(0, 6)}`;
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
  await db.query("update public.profiles set full_name = $2, headline = 'Test', role = $3 where id = $1", [user.id, user.name, user.role]);
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
const direct = async user => {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email: user.email, password: user.password });
  return client;
};
const local = date => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const noOverflow = async page => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "no sideways scrolling");
const learnerRow = (page, name) => page.locator(".roster-list > li", { hasText: name });

try {
  if (!expectedRef || !connection) throw new Error("Set EXPECTED_SUPABASE_PROJECT_REF and a database URL.");
  const url = new URL(connection);
  if (!url.hostname.includes(expectedRef) && !decodeURIComponent(url.username).endsWith(`.${expectedRef}`)) throw new Error("DATABASE_PROJECT_MISMATCH");
  if (expectedRef === "gmrribyxcpcmqlqhdwea") throw new Error("Never run this against production.");
  await db.connect();
  for (const user of users) await createUser(user);
  browser = await chromium.launch({ channel: process.platform === "win32" ? "msedge" : "chromium", headless: true });
  await mkdir(shots, { recursive: true });

  stage = "the admin creates an assessed workshop and assigns the trainer (no agreement yet)";
  const a = await signIn(admin);
  await a.page.goto("/admin/workshops");
  await a.page.locator(".workshop-new summary").click();
  const form = a.page.locator(".workshop-new");
  await form.getByLabel("Title").fill(TITLE);
  await form.getByLabel("Summary").fill("Build, run and ship a container, hands on.");
  const start = new Date(Date.now() + 3 * 86400000);
  await form.getByLabel("Starts").fill(local(start));
  await form.getByLabel("Ends").fill(local(new Date(start.getTime() + 2 * 3600000)));
  await form.getByLabel("Seats").fill("3");
  await form.getByLabel("Status").selectOption("open");
  await form.getByLabel("Certificate type").selectOption("assessed");
  await form.getByLabel("Pass mark (out of 100)").fill("70");
  await form.getByLabel("Trainer name on certificates").fill("Nadia Trainer");
  await form.getByLabel("Trainer's account email").fill(trainer.email);
  await form.getByRole("button", { name: "Create workshop" }).click();
  await expect(a.page.locator(".workshop-roster", { hasText: TITLE })).toBeVisible({ timeout: 20000 });
  workshopId = (await db.query("select id, trainer_id from public.certified_workshops where title = $1", [TITLE])).rows[0].id;
  assert.equal((await db.query("select trainer_id from public.certified_workshops where id = $1", [workshopId])).rows[0].trainer_id, trainer.id);

  stage = "three learners enroll; one hides their name; the fourth seat does not exist";
  for (const [user, showName] of [[alice, true], [bob, false]]) {
    const s = await signIn(user);
    await s.page.goto("/account/certificates");
    const card = s.page.locator(".learner-workshop", { hasText: TITLE });
    if (!showName) await card.getByLabel("Show my name when someone checks my certificate").uncheck();
    await card.getByRole("button", { name: "Enroll" }).click();
    await expect(card.locator(".learner-enrolled")).toHaveText("✓ Enrolled", { timeout: 20000 });
    if (user === alice) { await s.page.waitForTimeout(600); await s.page.screenshot({ path: `${shots}/1-learner-enrolled-dark.png`, fullPage: true }); }
    await s.context.close();
  }
  assert.equal((await (await direct(carol)).rpc("enroll_certified_workshop", { p_workshop: workshopId, p_show_name: true })).error, null);
  assert.equal((await (await direct(outsider)).rpc("enroll_certified_workshop", { p_workshop: workshopId, p_show_name: true })).error?.code, "23514", "full");

  stage = "an outsider cannot mark, issue, revoke, write or read other learners' records";
  const out = await direct(outsider);
  const enrollmentOfAlice = (await db.query("select id from public.workshop_enrollments where workshop_id = $1 and user_id = $2", [workshopId, alice.id])).rows[0].id;
  assert.equal((await out.rpc("mark_workshop_completion", { p_enrollment: enrollmentOfAlice, p_attended: true, p_score: 100 })).error?.code, "42501");
  assert.equal((await out.rpc("issue_workshop_certificates", { p_workshop: workshopId })).error?.code, "42501");
  assert.equal((await out.rpc("certified_workshop_roster", { p_workshop: workshopId })).error?.code, "42501");
  assert.ok((await out.from("workshop_certificates").insert({ enrollment_id: enrollmentOfAlice, workshop_id: workshopId, user_id: outsider.id, kind: "assessed", scope: "Fake" })).error, "no direct inserts");
  assert.deepEqual((await out.from("workshop_enrollments").select("id").eq("workshop_id", workshopId)).data, [], "other learners are invisible");
  assert.ok((await out.from("certified_workshops").select("agreement_note").eq("id", workshopId)).error, "the agreement note is staff-only");
  const al = await direct(alice);
  assert.equal((await al.rpc("issue_workshop_certificates", { p_workshop: workshopId })).error?.code, "42501", "learners cannot self-issue");
  assert.equal((await al.rpc("mark_workshop_completion", { p_enrollment: enrollmentOfAlice, p_attended: true, p_score: 100 })).error?.code, "42501");

  stage = "the session takes place (times moved into the past); the trainer records results";
  const t = await signIn(trainer);
  await t.page.goto("/account/certificates");
  await expect(t.page.locator(".teaching .workshop-roster", { hasText: TITLE }).getByText("Attendance can be recorded once the workshop starts.")).toBeVisible();
  await db.query("update public.certified_workshops set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour' where id = $1", [workshopId]);
  await t.page.reload();
  const roster = t.page.locator(".teaching .workshop-roster", { hasText: TITLE });
  for (const [person, score] of [[alice, "85"], [bob, "72"], [carol, "50"]]) {
    const row = learnerRow(t.page, person.name);
    await row.getByLabel(`Score for ${person.name}`).fill(score);
    await row.getByRole("button", { name: "Present" }).click();
    await expect(row).toContainText(`score ${score}`, { timeout: 20000 });
  }
  await expect(roster.locator(".workshop-warning")).toContainText("trainer agreement");
  await expect(roster.getByRole("button", { name: /Issue certificates/ })).toBeDisabled();
  assert.equal((await (await direct(trainer)).rpc("issue_workshop_certificates", { p_workshop: workshopId })).error?.code, "55000", "blocked without an agreement");
  await t.page.waitForTimeout(500);
  await roster.screenshot({ path: `${shots}/2-trainer-roster-dark.png` });

  stage = "the admin records the trainer agreement; the trainer issues certificates once";
  await a.page.reload();
  const edit = a.page.locator(".workshop-edit", { hasText: TITLE });
  await edit.locator("summary").click();
  await edit.getByLabel("Trainer agreement reference").fill("Agreement TR-TEST-01 signed, kept by the test director");
  await edit.getByRole("button", { name: "Save workshop" }).click();
  await expect(edit.locator(".notice, .form-error")).toBeVisible({ timeout: 20000 });
  if (await edit.locator(".form-error").count()) throw new Error(`Save failed: ${await edit.locator(".form-error").innerText()}`);
  await expect(edit.locator(".notice")).toContainText("Workshop saved");
  await t.page.reload();
  await expect(roster.getByRole("button", { name: "Issue certificates (2)" })).toBeEnabled();
  await roster.getByRole("button", { name: "Issue certificates (2)" }).click();
  await expect(roster.locator(".notice")).toContainText("2 certificate(s) issued", { timeout: 20000 });
  await expect(learnerRow(t.page, carol.name)).not.toContainText("Certificate issued");
  const certs = await db.query("select c.id, c.user_id, c.holder_name, c.scope from public.workshop_certificates c where c.workshop_id = $1", [workshopId]);
  assert.equal(certs.rowCount, 2);
  const aliceCert = certs.rows.find(row => row.user_id === alice.id);
  const bobCert = certs.rows.find(row => row.user_id === bob.id);
  assert.equal(aliceCert.holder_name, "Rana Haddad");
  assert.equal(bobCert.holder_name, null, "no name without consent");
  assert.equal((await (await direct(trainer)).rpc("issue_workshop_certificates", { p_workshop: workshopId })).data, 0, "never issued twice");
  assert.equal((await (await direct(trainer)).rpc("mark_workshop_completion", { p_enrollment: enrollmentOfAlice, p_attended: false, p_score: null })).error?.code, "55000", "issued results are locked");

  stage = "anyone can check a certificate; the name shows only with consent";
  const visitor = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } });
  const v = await visitor.newPage();
  await v.goto(`/certificates/${aliceCert.id}`);
  await expect(v.locator(".trust-seal")).toContainText("Valid certificate");
  await expect(v.locator(".trust-headline")).toContainText("Issued to Rana Haddad");
  await expect(v.locator(".certificate-fields")).toContainText("Passed the workshop assessment: 85/100 (pass mark 70)");
  await expect(v.locator(".trust-footer")).toContainText("not an accredited qualification");
  assert.equal(await v.locator('meta[name="robots"]').getAttribute("content"), "noindex, nofollow");
  await v.waitForTimeout(600);
  await v.screenshot({ path: `${shots}/3-check-valid-dark.png`, fullPage: true });
  await v.goto(`/certificates/${bobCert.id}`);
  await expect(v.locator(".trust-headline")).toContainText("chose not to show their name");
  assert.equal((await v.locator("body").innerText()).includes("Karim"), false);
  await v.goto(`/certificates/${randomUUID()}`);
  await expect(v.locator(".trust-sheet")).toHaveCount(0);

  stage = "the certificate shows for its holder and on the checked-profile page";
  const s = await signIn(alice);
  await s.page.goto("/account/certificates");
  await expect(s.page.locator(".certificate-list")).toContainText(TITLE);
  await s.page.screenshot({ path: `${shots}/4-learner-certificate-dark.png`, fullPage: true });
  const turnedOn = await s.page.request.post("/api/v1/trust-page", { headers: { Origin: baseURL }, data: { enabled: true } });
  const trustSlug = (await turnedOn.json()).slug;
  await v.goto(`/v/${trustSlug}`);
  await expect(v.locator(".trust-facts")).toContainText("CareerForge certificates");
  await expect(v.locator(".trust-facts")).toContainText(TITLE);

  stage = "the admin revokes a certificate; its check and the profile page update at once";
  await a.page.reload();
  a.page.once("dialog", dialog => dialog.accept("Score entered for the wrong learner (test)"));
  await learnerRow(a.page, alice.name).getByRole("button", { name: "Revoke…" }).click();
  await expect(learnerRow(a.page, alice.name)).toContainText("Certificate revoked", { timeout: 20000 });
  await a.page.waitForTimeout(600);
  await a.page.screenshot({ path: `${shots}/5-admin-dark.png`, fullPage: true });
  assert.equal((await (await direct(trainer)).rpc("revoke_workshop_certificate", { p_certificate: bobCert.id, p_reason: "x" })).error?.code, "42501", "only admins revoke");
  await v.goto(`/certificates/${aliceCert.id}`);
  await expect(v.locator(".trust-seal")).toContainText("Revoked");
  await expect(v.locator(".certificate-revoked")).toContainText("no longer valid");
  await v.screenshot({ path: `${shots}/6-check-revoked-dark.png`, fullPage: true });
  await v.goto(`/v/${trustSlug}`);
  await expect(v.locator(".trust-page")).not.toContainText(TITLE);

  stage = "phone and light theme";
  for (const [name, options] of [["phone", { viewport: { width: 390, height: 844 } }], ["light", { colorScheme: "light" }]]) {
    const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 }, ...options });
    const page = await context.newPage();
    if (name === "light") { await page.goto("/"); await page.evaluate(() => localStorage.setItem("careerforge-theme", "light")); }
    await page.goto(`/certificates/${bobCert.id}`);
    await page.waitForTimeout(700);
    await noOverflow(page);
    await page.screenshot({ path: `${shots}/7-check-${name}.png`, fullPage: true });
    await context.close();
    const tp = await signIn(trainer, options);
    if (name === "light") await tp.page.evaluate(() => localStorage.setItem("careerforge-theme", "light"));
    await tp.page.goto("/account/certificates");
    await tp.page.waitForTimeout(700);
    await noOverflow(tp.page);
    await tp.page.screenshot({ path: `${shots}/8-trainer-${name}.png`, fullPage: true });
    await tp.context.close();
  }
  await visitor.close();
  console.log("Workshop certificates live test passed.");
} catch (error) {
  console.error(`Workshop certificates live test failed at: ${stage}`);
  console.error(error.message);
  process.exitCode = 1;
} finally {
  try {
    if (workshopId) await db.query("delete from public.certified_workshops where id = $1", [workshopId]);
    await db.query("delete from auth.users where id = any($1::uuid[])", [users.map(u => u.id)]);
    console.log("Temporary workshop, accounts, enrollments and certificates removed.");
  } catch (error) { console.error("Cleanup failed:", error.message); process.exitCode = 1; }
  await db.end().catch(() => {});
  await browser?.close();
}
