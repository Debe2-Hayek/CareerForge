// Live check of career analysis on DEVELOPMENT only. A temporary student with web skills
// (React proven by a passed check) opens /career-analysis: the closest careers are ranked,
// gaps and covered topics are listed by priority, the AI coach answers (test AI with
// AI_FAKE=1, or the real AI: 1 call), and any career can be chosen. Then the account is deleted.
//   PLAYWRIGHT_BASE_URL=http://localhost:3100 EXPECTED_SUPABASE_PROJECT_REF=<dev ref> node --env-file=.env scripts/verify-career-analysis-live.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { Client } from "pg";
import { chromium, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const expectedRef = process.env.EXPECTED_SUPABASE_PROJECT_REF;
const connection = (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();
const shots = "test-results/career-analysis-live";
const user = { id: randomUUID(), password: `Test-${randomUUID()}!` };
user.email = `${user.id}@careerforge.invalid`;
const db = new Client({ connectionString: connection, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
let browser;
let stage = "setup";

async function signIn(options = {}) {
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 }, ...options });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`^${baseURL}/(account|admin)$`), { timeout: 30000 });
  return { context, page };
}
const noOverflow = async page => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "no sideways scrolling");
const percentOf = async locator => Number((await locator.getAttribute("aria-label")).match(/(\d+)%/)[1]);

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
  await db.query("update public.profiles set full_name = 'Rana Haddad', headline = 'Aspiring frontend developer', self_reported_skills = $2 where id = $1", [user.id, ["HTML", "CSS", "JavaScript", "React", "Git"]]);
  await db.query("insert into public.skill_check_attempts (user_id, skill, version, score, passed) values ($1, 'React', 1, 5, true)", [user.id]);
  browser = await chromium.launch({ channel: process.platform === "win32" ? "msedge" : "chromium", headless: true });
  await mkdir(shots, { recursive: true });

  stage = "closest careers are ranked";
  const s = await signIn();
  await s.page.goto("/career-analysis");
  await expect(s.page.getByRole("heading", { level: 1 })).toContainText("Find the career you are closest to");
  const cards = s.page.locator(".career-card");
  await expect(cards).toHaveCount(3);
  const firstTitle = await cards.first().locator(".career-card-copy strong").innerText();
  const scores = [];
  for (let i = 0; i < 3; i++) scores.push(await percentOf(cards.nth(i).getByRole("img")));
  console.log("Closest careers:", (await cards.locator(".career-card-copy strong").allInnerTexts()).map((title, i) => `${title} ${scores[i]}%`).join(" | "));
  assert.ok(scores[0] >= scores[1] && scores[1] >= scores[2], "best first");
  assert.ok(/Frontend|Full Stack|Web/i.test(firstTitle), `a web career ranks first (got ${firstTitle})`);
  await expect(s.page.locator(".career-detail h2")).toHaveText(firstTitle);

  stage = "gaps and covered topics";
  await expect(s.page.locator(".career-group").first()).toBeVisible();
  await s.page.getByRole("tab", { name: /Covered/ }).click();
  await expect(s.page.locator(".career-topic", { hasText: "React" }).locator(".evidence-chip")).toHaveText("Proven");
  await expect(s.page.locator(".career-topic", { hasText: "CSS" }).first().locator(".evidence-chip")).toHaveText("On your profile");
  await s.page.getByRole("tab", { name: /Gaps/ }).click();

  stage = "AI coach";
  await s.page.getByRole("button", { name: "Explain with AI" }).click();
  await expect(s.page.locator(".career-priorities li").first()).toBeVisible({ timeout: 90000 });
  const coach = await s.page.locator(".fit-ai").innerText();
  console.log(/test AI/i.test(coach) ? "Mode: development test AI (no credits used)" : "Mode: real AI");
  assert.equal(/basket/i.test(coach), false, "invented priorities are removed");
  await s.page.waitForTimeout(1200);
  await noOverflow(s.page);
  await s.page.screenshot({ path: `${shots}/1-career-dark.png`, fullPage: true });

  stage = "any career can be chosen";
  await s.page.getByLabel("Any career").selectOption("data-analyst").catch(async () => {
    const options = await s.page.locator(".career-select option").evaluateAll(list => list.map(option => option.value));
    await s.page.getByLabel("Any career").selectOption(options[options.length - 1]);
  });
  await expect(s.page).toHaveURL(/career=/, { timeout: 15000 });
  await expect(s.page.locator(".career-detail h2")).not.toHaveText(firstTitle, { timeout: 15000 });
  console.log("Chosen career:", await s.page.locator(".career-detail h2").innerText(), await percentOf(s.page.locator(".career-detail").getByRole("img")) + "%");

  stage = "signed-out API is refused";
  const anonymous = await browser.newContext({ baseURL });
  const refused = await anonymous.request.post("/api/v1/career-analysis/explain", { headers: { Origin: baseURL }, data: { careerId: "frontend" } });
  assert.equal(refused.status(), 401);
  await anonymous.close();

  stage = "phone and light theme";
  for (const [name, options] of [["phone", { viewport: { width: 390, height: 844 } }], ["light", { colorScheme: "light" }]]) {
    const v = await signIn(options);
    if (name === "light") await v.page.evaluate(() => localStorage.setItem("careerforge-theme", "light"));
    await v.page.goto("/career-analysis");
    await expect(v.page.locator(".career-detail")).toBeVisible();
    await v.page.waitForTimeout(1300);
    await noOverflow(v.page);
    await v.page.screenshot({ path: `${shots}/2-${name}.png`, fullPage: true });
    await v.context.close();
  }
  console.log("Career analysis live test passed.");
} catch (error) {
  console.error(`Career analysis live test failed at: ${stage}`);
  console.error(error.message);
  process.exitCode = 1;
} finally {
  try {
    await db.query("delete from auth.users where id = $1", [user.id]);
    console.log("Temporary account and its data removed.");
  } catch (error) { console.error("Cleanup failed:", error.message); process.exitCode = 1; }
  await db.end().catch(() => {});
  await browser?.close();
}
