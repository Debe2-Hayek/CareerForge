// Live check of related-skill matching on DEVELOPMENT only (no AI). A temporary student whose
// profile lists Django, MySQL and Next.js pastes a backend job asking for Python, SQL, PostgreSQL,
// JavaScript and Docker: Python, SQL and JavaScript count through the skills that show them,
// PostgreSQL earns half credit as close to MySQL, Docker is missing. Then the account is deleted.
//   PLAYWRIGHT_BASE_URL=http://localhost:3100 EXPECTED_SUPABASE_PROJECT_REF=<dev ref> node --env-file=.env scripts/verify-skill-relations-live.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { Client } from "pg";
import { chromium, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const expectedRef = process.env.EXPECTED_SUPABASE_PROJECT_REF;
const connection = (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();
const shots = "test-results/skill-relations-live";
const id = randomUUID();
const user = { id, email: `${id}@careerforge.invalid`, password: `Test-${randomUUID()}!` };
const db = new Client({ connectionString: connection, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
let browser;
let stage = "setup";

try {
  if (!expectedRef || !connection) throw new Error("Set EXPECTED_SUPABASE_PROJECT_REF and a database URL.");
  const url = new URL(connection);
  if (!url.hostname.includes(expectedRef) && !decodeURIComponent(url.username).endsWith(`.${expectedRef}`)) throw new Error("DATABASE_PROJECT_MISMATCH");
  if (expectedRef === "gmrribyxcpcmqlqhdwea") throw new Error("Never run this against production.");
  await db.connect();
  await db.query(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, extensions.crypt($3, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '')`, [user.id, user.email, user.password]);
  await db.query(`insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at) values ($1, $2::text, $2::uuid, $3, 'email', now(), now())`,
    [randomUUID(), user.id, JSON.stringify({ sub: user.id, email: user.email, email_verified: true })]);
  await db.query("update public.profiles set full_name = 'Rana Haddad', headline = 'Backend developer', self_reported_skills = $2 where id = $1", [user.id, ["Django", "MySQL", "Next.js"]]);
  browser = await chromium.launch({ channel: process.platform === "win32" ? "msedge" : "chromium", headless: true });
  await mkdir(shots, { recursive: true });

  stage = "a pasted backend job is analysed with related skills";
  for (const [name, options] of [["dark", {}], ["phone", { viewport: { width: 390, height: 844 } }], ["light", { colorScheme: "light" }]]) {
    const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 }, ...options });
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("Email address").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(`${baseURL}/account`, { timeout: 30000 });
    if (name === "light") await page.evaluate(() => localStorage.setItem("careerforge-theme", "light"));
    await page.goto("/cv-analysis");
    await page.getByRole("tab", { name: "Paste a job" }).click();
    await page.getByLabel("Job title").fill("Backend Engineer");
    await page.getByLabel("Job description").fill("We build APIs in Python with PostgreSQL. You know SQL, some JavaScript for internal tools, and Docker.");
    await page.getByRole("button", { name: "Analyse this job" }).click();
    await expect(page.getByRole("heading", { name: /Backend Engineer/ })).toBeVisible();
    const list = page.locator(".fit-skill-list");
    await expect(list.locator("li.have", { hasText: "Python" })).toContainText("via Django");
    await expect(list.locator("li.have", { hasText: "SQL" }).first()).toContainText("via MySQL");
    await expect(list.locator("li.have", { hasText: "JavaScript" })).toContainText("via Next.js");
    await expect(list.locator("li.related", { hasText: "PostgreSQL" })).toContainText("close to your MySQL");
    await expect(list.locator("li.missing", { hasText: "Docker" })).toBeVisible();
    if (name === "dark") {
      const score = Number((await page.getByRole("img", { name: /Match \d+%/ }).getAttribute("aria-label")).match(/(\d+)%/)[1]);
      console.log(`Backend Engineer with Django, MySQL, Next.js: ${score}%`);
      await expect(page.locator("body")).toContainText("your MySQL is a head start");
    }
    await page.waitForTimeout(900);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "no sideways scrolling");
    await page.screenshot({ path: `${shots}/analysis-${name}.png`, fullPage: true });
    await context.close();
  }
  console.log("Related skills live test passed.");
} catch (error) {
  console.error(`Related skills live test failed at: ${stage}`);
  console.error(error.message);
  process.exitCode = 1;
} finally {
  try { await db.query("delete from auth.users where id = $1", [user.id]); console.log("Temporary account removed."); }
  catch (error) { console.error("Cleanup failed:", error.message); process.exitCode = 1; }
  await db.end().catch(() => {});
  await browser?.close();
}
