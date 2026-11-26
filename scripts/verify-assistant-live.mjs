// Live check of the career assistant on DEVELOPMENT only. A temporary student with a profile
// asks a starter question and a follow-up (test AI with AI_FAKE=1, or the real AI: 2 calls),
// with only some context shared; links to CareerForge pages work; the chat is saved to the account (kept
// after a refresh and after signing out, renamed, deleted); then the account is deleted.
//   PLAYWRIGHT_BASE_URL=http://localhost:3100 EXPECTED_SUPABASE_PROJECT_REF=<dev ref> node --env-file=.env scripts/verify-assistant-live.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { Client } from "pg";
import { chromium, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const expectedRef = process.env.EXPECTED_SUPABASE_PROJECT_REF;
const connection = (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();
const shots = "test-results/assistant-live";
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
  await db.query(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, extensions.crypt($3, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '')`, [user.id, user.email, user.password]);
  await db.query(`insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at) values ($1, $2::text, $2::uuid, $3, 'email', now(), now())`,
    [randomUUID(), user.id, JSON.stringify({ sub: user.id, email: user.email, email_verified: true })]);
  await db.query("update public.profiles set full_name = 'Rana Haddad', headline = 'Aspiring backend developer', self_reported_skills = $2 where id = $1", [user.id, ["Java", "SQL", "Docker"]]);
  browser = await chromium.launch({ channel: process.platform === "win32" ? "msedge" : "chromium", headless: true });
  await mkdir(shots, { recursive: true });

  stage = "the assistant answers with only the shared context";
  const s = await signIn();
  await s.page.goto("/career-assistant");
  await expect(s.page.getByRole("heading", { level: 1 })).toContainText("Career assistant");
  await expect(s.page.getByRole("checkbox", { name: /Profile & skills/ })).toBeChecked();
  await s.page.getByRole("checkbox", { name: /Work & education/ }).uncheck();
  await s.page.getByRole("button", { name: "What should I learn next?" }).click();
  const replies = s.page.locator(".assistant-message.from-assistant:not(.typing)");
  await expect(replies).toHaveCount(1, { timeout: 90000 });
  const first = await replies.first().innerText();
  console.log(/test AI/i.test(first) ? "Mode: development test AI (no credits used)" : "Mode: real AI");
  console.log("Reply 1:", first.replace(/\s+/g, " ").slice(0, 200));
  if (/test AI/i.test(first)) {
    assert.match(first, /Profile and skills/);
    assert.equal(/Work and education/.test(first), false, "unticked context was not sent");
    await expect(replies.first().getByRole("link", { name: "Skill checks" })).toHaveAttribute("href", "/skill-checks");
  }

  stage = "a follow-up keeps the conversation";
  await s.page.getByLabel("Your message").fill("And how do I prove Docker?");
  await s.page.getByLabel("Your message").press("Enter");
  await expect(replies).toHaveCount(2, { timeout: 90000 });
  await expect(s.page.locator(".assistant-message.from-user")).toHaveCount(2);
  await s.page.waitForTimeout(1000);
  await noOverflow(s.page);
  await s.page.screenshot({ path: `${shots}/1-chat-dark.png`, fullPage: true });

  stage = "the chat is saved to the account: kept after a refresh and a visit to another page";
  await expect(s.page).toHaveURL(/\?chat=[0-9a-f-]{36}$/);
  await s.page.reload();
  await expect(replies).toHaveCount(2, { timeout: 15000 });
  await s.page.goto("/account");
  await s.page.goto("/career-assistant");
  await expect(s.page.locator(".chat-welcome")).toBeVisible();
  await expect(s.page.locator(".chat-history-item")).toHaveCount(1);
  await expect(s.page.locator(".chat-history-item")).toContainText("What should I learn next?");
  await s.page.locator(".chat-history-item").first().click();
  await expect(replies).toHaveCount(2, { timeout: 15000 });

  stage = "a chat can be renamed";
  await s.page.getByRole("button", { name: /^Rename chat:/ }).click();
  await s.page.getByLabel("Chat name").fill("My learning plan");
  await s.page.getByLabel("Chat name").press("Enter");
  await expect(s.page.locator(".chat-history-item")).toContainText("My learning plan");

  stage = "a link opens the page inside CareerForge";
  const link = replies.first().getByRole("link").first();
  if (await link.count()) {
    const href = await link.getAttribute("href");
    await link.click();
    await expect(s.page).toHaveURL(`${baseURL}${href}`);
  }

  stage = "chats stay after signing out, on another browser, and only for their owner";
  await s.page.goto("/account");
  await s.page.getByRole("button", { name: "Sign out" }).click();
  await expect(s.page).toHaveURL(/\/login/, { timeout: 30000 });
  await s.context.close();
  const again = await signIn();
  await again.page.goto("/career-assistant");
  await expect(again.page.locator(".chat-history-item")).toHaveCount(1);
  await expect(again.page.locator(".chat-history-item")).toContainText("My learning plan");
  await again.page.locator(".chat-history-item").first().click();
  await expect(again.page.locator(".assistant-message.from-assistant:not(.typing)")).toHaveCount(2, { timeout: 15000 });
  const rows = await db.query("select count(*)::int n, sum(jsonb_array_length(messages))::int m from public.assistant_chats where user_id = $1", [user.id]);
  assert.deepEqual(rows.rows[0], { n: 1, m: 4 }, "one saved chat with two questions and two answers");

  stage = "deleting a chat removes it from the account";
  again.page.once("dialog", dialog => dialog.accept());
  await again.page.getByRole("button", { name: /^Delete chat:/ }).click();
  await expect(again.page.locator(".chat-history-item")).toHaveCount(0);
  await expect.poll(async () => (await db.query("select count(*)::int n from public.assistant_chats where user_id = $1", [user.id])).rows[0].n).toBe(0);
  await again.context.close();

  stage = "signed out is refused";
  const anonymous = await browser.newContext({ baseURL });
  assert.equal((await anonymous.request.get("/api/v1/assistant/chats")).status(), 401);
  assert.equal((await anonymous.request.post("/api/v1/assistant", { headers: { Origin: baseURL }, data: { messages: [{ role: "user", content: "Hi" }], context: { profile: true, history: true, careers: true } } })).status(), 401);
  await anonymous.close();

  stage = "phone and light theme";
  for (const [name, options] of [["phone", { viewport: { width: 390, height: 844 } }], ["light", { colorScheme: "light" }]]) {
    const v = await signIn(options);
    if (name === "light") await v.page.evaluate(() => localStorage.setItem("careerforge-theme", "light"));
    await v.page.goto("/career-assistant");
    await v.page.locator(".chat-starters button", { hasText: "Which career fits me best, and why?" }).click();
    await expect(v.page.locator(".assistant-message.from-assistant:not(.typing)")).toHaveCount(1, { timeout: 90000 });
    await v.page.waitForTimeout(1000);
    await noOverflow(v.page);
    await v.page.screenshot({ path: `${shots}/2-${name}.png`, fullPage: true });
    await v.context.close();
  }
  console.log("Assistant live test passed.");
} catch (error) {
  console.error(`Assistant live test failed at: ${stage}`);
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
