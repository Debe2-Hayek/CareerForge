// Live check of the skill checks studio on DEVELOPMENT only. A temporary admin drafts a
// check with the AI (or the development test AI: dev server started with AI_FAKE=1), edits
// it, publishes it; a temporary student who lists that skill takes the timed check, passes,
// and sees the skill Verified. A second publication must retire the first version.
//   PLAYWRIGHT_BASE_URL=http://localhost:3100 EXPECTED_SUPABASE_PROJECT_REF=<dev ref> node --env-file=.env scripts/verify-skill-checks-live.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { Client } from "pg";
import { chromium, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const expectedRef = process.env.EXPECTED_SUPABASE_PROJECT_REF;
const connection = (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();
const shots = "test-results/skill-checks-live";
const skill = `Testskill${randomUUID().slice(0, 6)}`;
const make = role => { const id = randomUUID(); return { id, role, email: `${id}@careerforge.invalid`, password: `Test-${randomUUID()}!` }; };
const [admin, student] = [make("admin"), make("student")];
const db = new Client({ connectionString: connection, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
let browser;
let stage = "setup";

async function createUser(user, name, skills) {
  await db.query(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, extensions.crypt($3, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '')`, [user.id, user.email, user.password]);
  await db.query(`insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at) values ($1, $2::text, $2::uuid, $3, 'email', now(), now())`,
    [randomUUID(), user.id, JSON.stringify({ sub: user.id, email: user.email, email_verified: true })]);
  await db.query("update public.profiles set full_name = $2, headline = 'Test', self_reported_skills = $3, role = $4 where id = $1", [user.id, name, skills, user.role]);
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

try {
  if (!expectedRef || !connection) throw new Error("Set EXPECTED_SUPABASE_PROJECT_REF and a database URL.");
  const url = new URL(connection);
  if (!url.hostname.includes(expectedRef) && !decodeURIComponent(url.username).endsWith(`.${expectedRef}`)) throw new Error("DATABASE_PROJECT_MISMATCH");
  if (expectedRef === "gmrribyxcpcmqlqhdwea") throw new Error("Never run this against production.");
  await db.connect();
  await createUser(admin, "Claims Reviewer", []);
  await createUser(student, "Rana Haddad", [skill, "Java"]);
  browser = await chromium.launch({ channel: process.platform === "win32" ? "msedge" : "chromium", headless: true });
  await mkdir(shots, { recursive: true });

  stage = "admin drafts with AI";
  const a = await signIn(admin);
  await a.page.goto("/admin/skill-checks");
  await expect(a.page.getByRole("navigation", { name: "Admin pages" }).getByRole("link", { name: "Skill checks studio" })).toHaveAttribute("aria-current", "page");
  await a.page.getByRole("textbox", { name: "Skill", exact: true }).fill(skill);
  await a.page.getByLabel(/Focus/).fill("fundamentals");
  await a.page.getByRole("button", { name: /Draft with AI/ }).click();
  const card = a.page.locator(".draft-card", { hasText: skill });
  await expect(card).toBeVisible({ timeout: 90000 });
  const test = /TEST AI/.test(await card.locator(".eyebrow").first().innerText());
  console.log(test ? "Mode: development test AI (no credits used)" : "Mode: real AI");
  await expect(card.locator(".draft-question")).toHaveCount(5);
  await a.page.waitForTimeout(1200);
  await noOverflow(a.page);
  await a.page.screenshot({ path: `${shots}/1-studio-draft-dark.png`, fullPage: true });

  stage = "admin edits: a broken question blocks publishing, then is fixed";
  const first = card.locator(".draft-question").first();
  await first.getByLabel("Option B for question 1").fill(await first.getByLabel("Option A for question 1").inputValue());
  await expect(first.locator(".draft-issues .error")).toContainText("Two options are the same");
  await expect(card.getByRole("button", { name: "Publish check" })).toBeDisabled();
  await first.getByLabel("Option B for question 1").fill("A clearly different option");
  await first.locator("textarea").first().fill(`Reviewed question about ${skill}: which option is correct?`);
  await card.getByRole("button", { name: "Save draft" }).click();
  await expect(card.getByText("All changes saved")).toBeVisible({ timeout: 15000 });

  stage = "admin publishes";
  a.page.once("dialog", dialog => dialog.accept());
  await card.getByRole("button", { name: "Publish check" }).click();
  await expect(a.page.getByText(new RegExp(`Published: ${skill} version 1`))).toBeVisible({ timeout: 15000 });
  await expect(a.page.locator(".studio-live")).toContainText(skill, { timeout: 30000 });
  const bank = await db.query("select version, questions from careerforge_internal.skill_check_banks where skill = $1 order by version desc limit 1", [skill]);
  assert.equal(bank.rows[0].version, 1);
  assert.equal(bank.rows[0].questions.length, 5);
  assert.equal(JSON.stringify(bank.rows[0].questions).includes("explanation"), false, "explanations are not published");

  stage = "student sees the check without answers, takes it and passes";
  const s = await signIn(student);
  const catalog = await s.page.evaluate(async () => (await fetch("/skill-checks")).ok);
  assert.ok(catalog);
  await s.page.goto("/skill-checks");
  const checkCard = s.page.locator(".check-card", { hasText: skill });
  await expect(checkCard).toBeVisible();
  await checkCard.getByRole("button", { name: "Start check" }).click();
  await expect(s.page.getByRole("heading", { name: `${skill} basics` })).toBeVisible({ timeout: 15000 });
  const html = await s.page.content();
  assert.equal(/"answer"\s*:/.test(html), false, "no answer key in the page");
  for (const [index, question] of bank.rows[0].questions.entries()) {
    await s.page.locator(`input[name="${question.id}"]`).nth(question.answer).check();
    assert.ok(index < 5);
  }
  await s.page.getByRole("button", { name: "Submit answers" }).click();
  await expect(s.page.getByText(new RegExp(`${skill}: 5/5. Basics check passed`))).toBeVisible({ timeout: 15000 });
  await s.page.goto("/account/verification");
  await expect(s.page.locator(".claim-row", { hasText: skill }).locator(".claim-badge")).toHaveText("Verified");
  await expect(s.page.locator(".claim-row", { hasText: "Java" })).not.toContainText("Take the");

  stage = "a second publication retires version 1";
  await a.page.reload();
  await a.page.getByRole("textbox", { name: "Skill", exact: true }).fill(skill);
  await a.page.getByRole("button", { name: "Write them myself" }).click();
  const blank = a.page.locator(".draft-card", { hasText: skill });
  await expect(blank).toBeVisible({ timeout: 15000 });
  for (let n = 1; n <= 5; n++) {
    const question = blank.locator(".draft-question").nth(n - 1);
    await question.locator("textarea").first().fill(`Second version question ${n} about ${skill}: pick the right one.`);
    for (const [i, letter] of ["A", "B", "C"].entries()) await question.getByLabel(`Option ${letter} for question ${n}`).fill(`Answer ${letter}${n}${i}`);
  }
  await blank.getByRole("button", { name: "Save draft" }).click();
  await expect(blank.getByText("All changes saved")).toBeVisible({ timeout: 15000 });
  a.page.once("dialog", dialog => dialog.accept());
  await blank.getByRole("button", { name: "Publish check" }).click();
  await expect(a.page.getByText(new RegExp(`Published: ${skill} version 2`))).toBeVisible({ timeout: 15000 });
  await s.page.waitForTimeout(61000); // the existing one-minute cooldown between attempts
  const old = await s.page.request.post("/api/v1/skill-checks/sessions", { headers: { Origin: baseURL }, data: { action: "start", skill, version: 1, timingMode: "standard" } });
  assert.equal(old.status(), 400, "version 1 can no longer be started");
  await s.page.goto("/account/verification");
  await expect(s.page.locator(".claim-row", { hasText: skill }).locator(".claim-badge")).toHaveText("Verified", { timeout: 15000 });

  stage = "non-admins cannot use the studio";
  const denied = await s.page.request.post("/api/v1/admin/skill-checks", { headers: { Origin: baseURL }, data: { action: "generate", skill: "Python" } });
  assert.equal(denied.status(), 403);
  await s.page.goto("/admin/skill-checks");
  await expect(s.page.getByRole("heading", { level: 1 })).toContainText("A detour, not a dead end");

  stage = "screenshots: phone and light theme";
  for (const [name, options] of [["phone", { viewport: { width: 390, height: 844 } }], ["light", { colorScheme: "light" }]]) {
    const v = await signIn(admin, options);
    if (name === "light") await v.page.evaluate(() => localStorage.setItem("careerforge-theme", "light"));
    await v.page.goto("/admin/skill-checks");
    await v.page.getByRole("textbox", { name: "Skill", exact: true }).fill(`${skill}x`);
    await v.page.getByRole("button", { name: /Draft with AI/ }).click();
    // Wait for this run's own confirmation, so no request is still running when the test cleans up.
    await expect(v.page.getByText(/Drafted 5 questions for/)).toBeVisible({ timeout: 90000 });
    await v.page.waitForTimeout(1200);
    await noOverflow(v.page);
    await v.page.screenshot({ path: `${shots}/2-studio-${name}.png`, fullPage: true });
    await v.context.close();
  }
  console.log("Skill checks studio live test passed.");
} catch (error) {
  console.error(`Skill checks live test failed at: ${stage}`);
  console.error(error.message);
  process.exitCode = 1;
} finally {
  try {
    await db.query("delete from careerforge_internal.skill_check_banks where lower(skill) like lower($1)", [`${skill}%`]);
    await db.query("delete from public.skill_check_drafts where lower(skill) like lower($1)", [`${skill}%`]);
    await db.query("delete from auth.users where id = any($1::uuid[])", [[admin.id, student.id]]);
    console.log("Temporary accounts, drafts, checks and results removed.");
  } catch (error) { console.error("Cleanup failed:", error.message); process.exitCode = 1; }
  await db.end().catch(() => {});
  await browser?.close();
}
