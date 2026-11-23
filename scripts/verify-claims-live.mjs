// Live check of claims, proof uploads, the review queue and the profile strength ring
// on DEVELOPMENT only. Creates two temporary students and one temporary admin, runs the
// whole flow in a real browser, takes screenshots, then deletes accounts and files.
//   PLAYWRIGHT_BASE_URL=http://localhost:3100 EXPECTED_SUPABASE_PROJECT_REF=<dev ref> node --env-file=.env scripts/verify-claims-live.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { chromium, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const expectedRef = process.env.EXPECTED_SUPABASE_PROJECT_REF;
const connection = (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();
const shots = "test-results/claims-live";
const make = role => { const id = randomUUID(); return { id, role, email: `${id}@careerforge.invalid`, password: `Test-${randomUUID()}!` }; };
const [alice, bob, admin] = [make("student"), make("student"), make("admin")];
const users = [alice, bob, admin];
const db = new Client({ connectionString: connection, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
let browser;
let stage = "setup";

async function createUser(user, profile) {
  await db.query(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, extensions.crypt($3, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '')`, [user.id, user.email, user.password]);
  await db.query(`insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at) values ($1, $2::text, $2::uuid, $3, 'email', now(), now())`,
    [randomUUID(), user.id, JSON.stringify({ sub: user.id, email: user.email, email_verified: true })]);
  await db.query("update public.profiles set full_name = $2, headline = $3, self_reported_skills = $4, role = $5 where id = $1", [user.id, profile.name, profile.headline, profile.skills, user.role]);
  if (user.role === "student") {
    await db.query("insert into public.education_records (user_id, request_id, institution, degree, start_date, end_date) values ($1, $2, 'Lebanese American University', 'B.E. Computer Engineering', '2016-09-01', '2020-06-01')", [user.id, randomUUID()]);
    await db.query("insert into public.experience_records (user_id, request_id, company, role, description, start_date, is_current) values ($1, $2, 'Murex', 'Backend Developer', 'Building payment APIs in Java.', '2020-09-01', true)", [user.id, randomUUID()]);
  }
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
const settle = page => page.waitForTimeout(1300);
const noOverflow = async page => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "no sideways scrolling");

try {
  if (!expectedRef || !connection) throw new Error("Set EXPECTED_SUPABASE_PROJECT_REF and a database URL.");
  const url = new URL(connection);
  if (!url.hostname.includes(expectedRef) && !decodeURIComponent(url.username).endsWith(`.${expectedRef}`)) throw new Error("DATABASE_PROJECT_MISMATCH");
  if (expectedRef === "gmrribyxcpcmqlqhdwea") throw new Error("Never run this against production.");
  await db.connect();
  await createUser(alice, { name: "Rana Haddad", headline: "Backend developer", skills: ["React", "Java", "Docker"] });
  await createUser(bob, { name: "Copy Cat", headline: "Developer", skills: ["Java"] });
  await createUser(admin, { name: "Claims Reviewer", headline: "Reviewer", skills: [] });
  browser = await chromium.launch({ channel: process.platform === "win32" ? "msedge" : "chromium", headless: true });
  await mkdir(shots, { recursive: true });
  const proof = { name: "diploma.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% CareerForge test diploma " + randomUUID() + "\n%%EOF\n") };

  stage = "profile: strength ring";
  const a = await signIn(alice);
  const ring = a.page.getByRole("img", { name: /Profile strength \d+%/ });
  await expect(ring).toBeVisible();
  const before = Number((await ring.getAttribute("aria-label")).match(/(\d+)%/)[1]);
  console.log(`Ring before proof: ${before}%`);
  await settle(a.page); await noOverflow(a.page);
  await a.page.screenshot({ path: `${shots}/1-profile-dark.png`, fullPage: true });

  stage = "verification: upload proof (Alice)";
  await a.page.goto("/account/verification");
  await expect(a.page.getByRole("heading", { level: 1 })).toContainText("Verify your profile");
  const degree = a.page.locator(".claim-row", { hasText: "B.E. Computer Engineering" });
  await expect(degree.locator(".claim-badge")).toHaveText("Self-declared");
  await degree.locator('input[type="file"]').setInputFiles(proof);
  await expect(a.page.getByText(/Proof sent for/)).toBeVisible({ timeout: 30000 });
  await expect(degree.locator(".claim-badge")).toHaveText("Proof submitted", { timeout: 15000 });
  const bad = { name: "evil.pdf", mimeType: "application/pdf", buffer: Buffer.from("MZ not a pdf") };
  await a.page.locator(".claim-row", { hasText: "Backend Developer" }).locator('input[type="file"]').setInputFiles(bad);
  await expect(a.page.locator(".claim-row", { hasText: "Backend Developer" }).getByRole("alert")).toContainText("Only PDF, PNG and JPG");
  await expect(a.page.locator(".claim-row", { hasText: "React" })).toContainText("Take the React check");
  await settle(a.page); await noOverflow(a.page);
  await a.page.screenshot({ path: `${shots}/2-verification-dark.png`, fullPage: true });

  stage = "verification: same file from another account (Bob)";
  const b = await signIn(bob);
  await b.page.goto("/account/verification");
  await b.page.locator(".claim-row", { hasText: "B.E. Computer Engineering" }).locator('input[type="file"]').setInputFiles(proof);
  await expect(b.page.getByText(/Proof sent for/)).toBeVisible({ timeout: 30000 });

  stage = "non-admin cannot open the queue";
  // The site-wide loading boundary streams, so the status stays 200; the page is the not-found page and no queue data is loaded.
  await b.page.goto("/admin/claims");
  await expect(b.page.getByRole("heading", { level: 1 })).toContainText("A detour, not a dead end");
  await expect(b.page.locator(".review-card")).toHaveCount(0);
  const apiDenied = await b.page.request.post("/api/v1/admin/claims/review", { data: { claimId: randomUUID(), decision: "approve" }, headers: { Origin: baseURL } });
  assert.equal(apiDenied.status(), 403);

  stage = "admin: review queue";
  const r = await signIn(admin);
  await r.page.goto("/admin/claims");
  const cards = r.page.locator(".review-card");
  await expect(cards).toHaveCount(2);
  await expect(r.page.locator(".review-flag").first()).toContainText("Same file used by another account");
  await settle(r.page); await noOverflow(r.page);
  await r.page.screenshot({ path: `${shots}/3-admin-queue-dark.png`, fullPage: true });
  const fileLink = r.page.locator(".review-card").first().getByRole("link", { name: /Open/ });
  const href = await fileLink.getAttribute("href");
  const file = await r.page.request.get(href);
  assert.equal(file.status(), 200, "the signed link opens the private file");
  await r.page.locator(".review-card", { hasText: "Rana Haddad".toUpperCase() }).getByRole("button", { name: /Approve/ }).click();
  await expect(r.page.getByText(/Approved:/)).toBeVisible({ timeout: 15000 });
  const bobCard = r.page.locator(".review-card", { hasText: "COPY CAT" });
  await bobCard.getByRole("button", { name: "Reject…" }).click();
  await bobCard.getByRole("button", { name: "Reject with reason" }).click();
  await expect(bobCard.getByRole("alert")).toContainText("reason");
  await bobCard.getByLabel("Reason the user will see").fill("This diploma file was also submitted by another account.");
  await bobCard.getByRole("button", { name: "Reject with reason" }).click();
  await expect(r.page.getByText(/Rejected:/)).toBeVisible({ timeout: 15000 });
  await expect(r.page.getByText("Nothing to review.")).toBeVisible({ timeout: 15000 });

  stage = "student sees the outcome";
  await a.page.goto("/account/verification");
  await expect(a.page.locator(".claim-row", { hasText: "B.E. Computer Engineering" }).locator(".claim-badge")).toHaveText("Reviewed");
  await b.page.goto("/account/verification");
  const bobDegree = b.page.locator(".claim-row", { hasText: "B.E. Computer Engineering" });
  await expect(bobDegree.locator(".claim-badge")).toHaveText("Not accepted");
  await expect(bobDegree).toContainText("also submitted by another account");
  await a.page.goto("/account");
  const after = Number((await a.page.getByRole("img", { name: /Profile strength \d+%/ }).getAttribute("aria-label")).match(/(\d+)%/)[1]);
  console.log(`Ring after review: ${after}%`);
  assert.ok(after > before, "the ring grows when a fact is confirmed");
  await expect(a.page.locator(".toolkit-list")).toContainText("Java");

  stage = "editing a reviewed record drops the review";
  const history = await (await a.page.request.get("/api/v1/education")).json();
  const record = history.records[0];
  const edit = await a.page.request.put(`/api/v1/education/${record.id}`, { headers: { Origin: baseURL }, data: { revision: record.revision, institution: "Harvard University", degree: record.degree, startDate: record.startDate, endDate: record.endDate, isCurrent: record.isCurrent, gpa: null, gpaScale: null } });
  assert.ok(edit.ok(), `edit status ${edit.status()}`);
  await a.page.goto("/account/verification");
  await expect(a.page.locator(".claim-row", { hasText: "B.E. Computer Engineering" }).locator(".claim-badge")).toHaveText("Changed since proof");

  stage = "screenshots: light theme and phone";
  for (const [name, options, path] of [["profile-light", { colorScheme: "light" }, "/account"], ["verification-light", { colorScheme: "light" }, "/account/verification"], ["profile-phone", { viewport: { width: 390, height: 844 } }, "/account"], ["verification-phone", { viewport: { width: 390, height: 844 } }, "/account/verification"]]) {
    const s = await signIn(alice, options);
    if (name.includes("light")) await s.page.evaluate(() => { localStorage.setItem("careerforge-theme", "light"); });
    await s.page.goto(path);
    await settle(s.page); await noOverflow(s.page);
    await s.page.screenshot({ path: `${shots}/4-${name}.png`, fullPage: true });
    await s.context.close();
  }
  console.log("Claims live check passed.");
} catch (error) {
  console.error(`Claims live check failed at: ${stage}`);
  console.error(error.message);
  process.exitCode = 1;
} finally {
  try {
    // Files: remove evidence rows first, then each owner deletes its now-unreferenced files through the Storage API.
    const paths = await db.query("select user_id, storage_path from public.claim_evidence where user_id = any($1::uuid[])", [users.map(u => u.id)]);
    await db.query("delete from public.claim_evidence where user_id = any($1::uuid[])", [users.map(u => u.id)]);
    for (const user of users) {
      const mine = paths.rows.filter(row => row.user_id === user.id).map(row => row.storage_path);
      if (!mine.length) continue;
      const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
      await client.auth.signInWithPassword({ email: user.email, password: user.password });
      const removed = await client.storage.from("claim-evidence").remove(mine);
      if (removed.error) console.error("File cleanup failed for a test user.");
    }
    await db.query("delete from auth.users where id = any($1::uuid[])", [users.map(u => u.id)]);
    console.log("Temporary accounts, claims and files removed.");
  } catch (error) { console.error("Cleanup failed:", error.message); process.exitCode = 1; }
  await db.end().catch(() => {});
  await browser?.close();
}
