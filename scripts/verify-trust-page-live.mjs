// Live check of the checked-profile page on DEVELOPMENT only (no AI, no credits). A temporary
// student has a reviewed degree, a reviewed language, a passed SQL check, an approved project
// interview, a job still waiting for review and a reviewed job edited since. They turn the page
// on; a signed-out visitor sees only the checked facts; the CV prints the link; the published
// portfolio links to it; editing a reviewed record removes it; a new link replaces the old one;
// turning the page off makes the link stop working.
//   PLAYWRIGHT_BASE_URL=http://localhost:3100 EXPECTED_SUPABASE_PROJECT_REF=<dev ref> node --env-file=.env scripts/verify-trust-page-live.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { chromium, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const expectedRef = process.env.EXPECTED_SUPABASE_PROJECT_REF;
const connection = (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();
const shots = "test-results/trust-page-live";
const id = randomUUID();
const student = { id, email: `${id}@careerforge.invalid`, password: `Test-${randomUUID()}!` };
const db = new Client({ connectionString: connection, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
let browser;
let stage = "setup";

async function signIn(options = {}) {
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 }, ...options });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(student.email);
  await page.getByLabel("Password", { exact: true }).fill(student.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`^${baseURL}/(account|admin)$`), { timeout: 30000 });
  return { context, page };
}
const noOverflow = async page => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "no sideways scrolling");
async function reviewed(kind, column, recordId, subject) {
  await db.query(`insert into public.claims (user_id, kind, ${column}, source_revision, subject, status, decided_at)
    values ($1, $2, $3, (select revision from public.${kind === "degree" ? "education_records" : kind === "employment" ? "experience_records" : "profile_languages"} where id = $3), $4, 'reviewed', now())`, [student.id, kind, recordId, subject]);
}

try {
  if (!expectedRef || !connection) throw new Error("Set EXPECTED_SUPABASE_PROJECT_REF and a database URL.");
  const url = new URL(connection);
  if (!url.hostname.includes(expectedRef) && !decodeURIComponent(url.username).endsWith(`.${expectedRef}`)) throw new Error("DATABASE_PROJECT_MISMATCH");
  if (expectedRef === "gmrribyxcpcmqlqhdwea") throw new Error("Never run this against production.");
  await db.connect();

  stage = "a student with checked, pending and edited facts";
  await db.query(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, extensions.crypt($3, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '')`, [student.id, student.email, student.password]);
  await db.query(`insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at) values ($1, $2::text, $2::uuid, $3, 'email', now(), now())`,
    [randomUUID(), student.id, JSON.stringify({ sub: student.id, email: student.email, email_verified: true })]);
  await db.query("update public.profiles set full_name = 'Rana Haddad', headline = 'Backend developer', self_reported_skills = $2 where id = $1", [student.id, ["SQL", "Docker"]]);
  const degree = (await db.query("insert into public.education_records (user_id, request_id, institution, degree, start_date, end_date) values ($1, $2, 'Lebanese American University', 'B.E. Computer Engineering', '2016-09-01', '2020-06-01') returning id", [student.id, randomUUID()])).rows[0].id;
  const pendingJob = (await db.query("insert into public.experience_records (user_id, request_id, company, role, description, start_date, end_date) values ($1, $2, 'Pending Corp', 'Data Analyst', '', '2021-01-01', '2022-01-01') returning id", [student.id, randomUUID()])).rows[0].id;
  const editedJob = (await db.query("insert into public.experience_records (user_id, request_id, company, role, description, start_date, end_date) values ($1, $2, 'Areeba', 'Backend Intern', '', '2024-06-01', '2024-08-01') returning id", [student.id, randomUUID()])).rows[0].id;
  const french = (await db.query("insert into public.profile_languages (user_id, language, level, test, score, test_date) values ($1, 'French', 'B2', 'delf_dalf', 'DELF B2', '2019-06-15') returning id", [student.id])).rows[0].id;
  await reviewed("degree", "education_id", degree, "B.E. Computer Engineering · Lebanese American University");
  await reviewed("language", "language_id", french, "French · B2");
  await reviewed("employment", "experience_id", editedJob, "Backend Intern · Areeba");
  await db.query("insert into public.claims (user_id, kind, experience_id, source_revision, subject) values ($1, 'employment', $2, (select revision from public.experience_records where id = $2), 'Data Analyst · Pending Corp')", [student.id, pendingJob]);
  await db.query("update public.experience_records set role = 'Senior Backend Engineer' where id = $1", [editedJob]);
  await db.query("insert into public.skill_check_attempts (user_id, skill, version, score, passed) values ($1, 'SQL', 1, 5, true)", [student.id]);
  await db.query("insert into public.project_interviews (user_id, repo_owner, repo_name, status, decided_at) values ($1, 'rana-haddad', 'orders-api', 'approved', now())", [student.id]);
  browser = await chromium.launch({ channel: process.platform === "win32" ? "msedge" : "chromium", headless: true });
  await mkdir(shots, { recursive: true });

  stage = "the page is off by default and the preview shows only checked facts";
  const s = await signIn();
  await s.page.goto("/account/verification");
  const panel = s.page.locator(".trust-share");
  await expect(panel.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  await expect(panel).toContainText("4 facts CareerForge checked");
  await panel.locator("summary").click();
  const preview = panel.locator(".trust-facts");
  for (const text of ["B.E. Computer Engineering", "French", "SQL", "rana-haddad/orders-api"]) await expect(preview).toContainText(text);
  for (const text of ["Pending Corp", "Areeba", "Docker"]) await expect(preview).not.toContainText(text);

  stage = "turning it on gives a link a signed-out visitor can open";
  await panel.getByRole("switch").click();
  await expect(panel.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  const link = await panel.locator("#trust-link").inputValue();
  const slug = link.split("/v/")[1];
  assert.match(slug, /^[0-9a-f-]{36}$/);
  await s.page.waitForTimeout(600);
  await panel.scrollIntoViewIfNeeded();
  await panel.screenshot({ path: `${shots}/1-share-panel-dark.png` });
  const visitor = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } });
  const v = await visitor.newPage();
  await v.goto(`/v/${slug}`);
  await expect(v.getByRole("heading", { level: 1 })).toHaveText("Rana Haddad");
  await expect(v.locator(".trust-lede")).toContainText("4 facts");
  for (const text of ["B.E. Computer Engineering", "Lebanese American University · Sep 2016 – Jun 2020", "B2 · DELF B2", "Passed a timed CareerForge skill check", "Passed a timed CareerForge interview"]) await expect(v.locator(".trust-facts")).toContainText(text);
  const body = await v.locator("body").innerText();
  for (const hidden of ["Pending Corp", "Areeba", "Senior Backend Engineer", "Docker", student.email]) assert.equal(body.includes(hidden), false, `${hidden} is not shown`);
  assert.equal(await v.locator('meta[name="robots"]').getAttribute("content"), "noindex, nofollow");
  await v.waitForTimeout(800);
  await noOverflow(v);
  await v.screenshot({ path: `${shots}/2-public-page-dark.png`, fullPage: true });

  stage = "the visitor cannot read anything else";
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  assert.ok((await anon.from("trust_pages").select("slug")).error || !(await anon.from("trust_pages").select("slug")).data?.length, "the table is not readable");
  assert.ok((await anon.rpc("my_confirmed_facts")).error, "no owner preview without a session");
  assert.equal((await anon.rpc("get_trust_page", { p_slug: randomUUID() })).data, null, "unknown links show nothing");

  stage = "the CV prints the link and marks only checked entries";
  await s.page.goto("/cv/saved");
  const cv = s.page.locator(".cv-sheet");
  await expect(cv.locator(".cv-trust")).toContainText(`/v/${slug}`);
  await expect(cv.locator(".cv-check")).toHaveCount(1);
  await expect(cv.locator(".cv-languages")).toContainText("French — B2 · Upper intermediate · DELF B2 ✓ reviewed");
  await cv.screenshot({ path: `${shots}/3-cv.png` });

  stage = "a published portfolio links to the page";
  const siteSlug = `trust-test-${student.id.slice(0, 8)}`;
  await db.query("insert into public.portfolio_sites (user_id, draft, slug, published, is_public, published_at) values ($1, '{}', $2, '{}', true, now())", [student.id, siteSlug]);
  assert.equal((await anon.rpc("get_public_portfolio_site", { p_slug: siteSlug })).data?.trustSlug, slug);

  stage = "editing a checked record removes it from the page";
  await db.query("update public.education_records set degree = 'M.E. Computer Engineering' where id = $1", [degree]);
  await v.reload();
  await expect(v.locator(".trust-lede")).toContainText("3 facts");
  await expect(v.locator(".trust-facts")).not.toContainText("Computer Engineering");

  stage = "a new link replaces the old one; turning it off stops it";
  s.page.once("dialog", dialog => dialog.accept());
  await s.page.goto("/account/verification");
  await s.page.locator(".trust-share").getByRole("button", { name: "Make a new link" }).click();
  await expect(s.page.locator(".trust-share-note")).toContainText("New link ready");
  const newSlug = (await s.page.locator("#trust-link").inputValue()).split("/v/")[1];
  assert.notEqual(newSlug, slug);
  await v.goto(`/v/${slug}`);
  await expect(v.locator(".trust-sheet")).toHaveCount(0);
  await v.goto(`/v/${newSlug}`);
  await expect(v.getByRole("heading", { level: 1 })).toHaveText("Rana Haddad");
  await s.page.locator(".trust-share").getByRole("switch").click();
  await expect(s.page.locator(".trust-share").getByRole("switch")).toHaveAttribute("aria-checked", "false");
  await v.reload();
  await expect(v.locator(".trust-sheet")).toHaveCount(0);
  assert.equal((await anon.rpc("get_public_portfolio_site", { p_slug: siteSlug })).data?.trustSlug, null, "the portfolio stops linking too");

  stage = "phone and light theme";
  await s.page.locator(".trust-share").getByRole("switch").click();
  await expect(s.page.locator(".trust-share").getByRole("switch")).toHaveAttribute("aria-checked", "true");
  const liveSlug = (await s.page.locator("#trust-link").inputValue()).split("/v/")[1];
  for (const [name, options] of [["phone", { viewport: { width: 390, height: 844 } }], ["light", { colorScheme: "light" }]]) {
    const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 }, ...options });
    const page = await context.newPage();
    if (name === "light") { await page.goto("/"); await page.evaluate(() => localStorage.setItem("careerforge-theme", "light")); }
    await page.goto(`/v/${liveSlug}`);
    await page.waitForTimeout(800);
    await noOverflow(page);
    await page.screenshot({ path: `${shots}/4-public-${name}.png`, fullPage: true });
    await context.close();
  }
  const phone = await signIn({ viewport: { width: 390, height: 844 } });
  await phone.page.goto("/account/verification");
  await phone.page.locator(".trust-share").scrollIntoViewIfNeeded();
  await phone.page.waitForTimeout(600);
  await noOverflow(phone.page);
  await phone.page.locator(".trust-share").screenshot({ path: `${shots}/5-share-panel-phone.png` });
  await phone.context.close();
  await visitor.close();
  console.log("Trust page live test passed.");
} catch (error) {
  console.error(`Trust page live test failed at: ${stage}`);
  console.error(error.message);
  process.exitCode = 1;
} finally {
  try {
    await db.query("delete from auth.users where id = $1", [student.id]);
    console.log("Temporary account and its data removed.");
  } catch (error) { console.error("Cleanup failed:", error.message); process.exitCode = 1; }
  await db.end().catch(() => {});
  await browser?.close();
}
