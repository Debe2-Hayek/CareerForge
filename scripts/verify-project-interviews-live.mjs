// Live check of project interviews on DEVELOPMENT only (dev server with AI_FAKE=1: test AI and
// test GitHub). A temporary student proves a repository, takes the 20-minute interview and
// submits; an admin runs the AI review and approves. Two attacks are checked: answers after the
// deadline are refused, and questions a student forged directly in the database are flagged
// as not found in the repository. Then everything is deleted.
//   PLAYWRIGHT_BASE_URL=http://localhost:3100 EXPECTED_SUPABASE_PROJECT_REF=<dev ref> node --env-file=.env scripts/verify-project-interviews-live.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { chromium, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const expectedRef = process.env.EXPECTED_SUPABASE_PROJECT_REF;
const connection = (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();
const shots = "test-results/project-interviews-live";
const make = role => { const id = randomUUID(); return { id, role, email: `${id}@careerforge.invalid`, password: `Test-${randomUUID()}!` }; };
const [student, admin] = [make("student"), make("admin")];
const db = new Client({ connectionString: connection, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
let browser;
let stage = "setup";

async function createUser(user, name) {
  await db.query(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, extensions.crypt($3, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '')`, [user.id, user.email, user.password]);
  await db.query(`insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at) values ($1, $2::text, $2::uuid, $3, 'email', now(), now())`,
    [randomUUID(), user.id, JSON.stringify({ sub: user.id, email: user.email, email_verified: true })]);
  await db.query("update public.profiles set full_name = $2, headline = 'Test', role = $3 where id = $1", [user.id, name, user.role]);
}
async function signIn(user, options = {}) {
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 }, ...options });
  const page = await context.newPage();
  page.on("dialog", dialog => dialog.accept());
  await page.goto("/login");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(`${baseURL}/account`, { timeout: 30000 });
  return { context, page };
}
const noOverflow = async page => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "no sideways scrolling");
const api = (page, body) => page.request.post("/api/v1/project-interviews", { headers: { Origin: baseURL }, data: body });

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

  stage = "student proves the repository and prepares questions";
  const s = await signIn(student);
  await s.page.goto("/account/projects");
  await s.page.getByLabel("Public GitHub repository").fill("https://github.com/rana-test/budget-app");
  await s.page.getByRole("button", { name: "Start a project interview" }).click();
  const card = s.page.locator(".interview-card").first();
  await expect(card).toContainText("PROVE IT IS YOUR REPOSITORY", { timeout: 15000 });
  await expect(card.locator(".interview-code code")).toHaveText(/^careerforge-[0-9a-f]{12}$/);
  await card.getByRole("button", { name: "Check my repository" }).click();
  await expect(s.page.locator(".interview-card").first()).toContainText("READY TO START", { timeout: 60000 });

  stage = "the 20-minute interview";
  await s.page.locator(".interview-card").first().getByRole("button", { name: "Start the 20-minute interview" }).click();
  const live = s.page.locator(".interview-card[data-status='in_progress']");
  await expect(live.getByRole("timer")).toBeVisible({ timeout: 15000 });
  const row = await db.query("select id, started_at, deadline_at, extract(epoch from deadline_at - started_at)::int as seconds from public.project_interviews where user_id = $1 and status = 'in_progress'", [student.id]);
  assert.equal(row.rows[0].seconds, 1200, "the database set a 20-minute deadline");
  const firstId = row.rows[0].id;
  const questions = live.locator(".interview-question");
  await expect(questions).toHaveCount(4);
  await expect(questions.first().locator(".interview-quote")).not.toBeEmpty();
  const answers = ["The token is checked first so an unauthenticated caller never reads cached user data; otherwise the cache would leak another person's record.", "Expired entries are deleted when read, so the map does not grow with stale data and callers get undefined.", "The cancelled flag stops setState after the component unmounts, which avoids a React warning and a memory leak.", "Not sure."];
  for (const [index, text] of answers.entries()) await questions.nth(index).locator("textarea").fill(text);
  await s.page.waitForTimeout(800);
  await noOverflow(s.page);
  await s.page.screenshot({ path: `${shots}/1-student-interview-dark.png`, fullPage: true });
  await live.getByRole("button", { name: "Send my answers" }).click();
  await expect(s.page.getByText("Answers sent")).toBeVisible({ timeout: 15000 });

  stage = "answers after the deadline are refused by the server";
  const second = await (await api(s.page, { action: "create", repoUrl: "https://github.com/rana-test/second" })).json();
  assert.ok((await api(s.page, { action: "prepare", id: second.id })).ok());
  assert.ok((await api(s.page, { action: "start", id: second.id })).ok());
  await db.query("update public.project_interviews set started_at = now() - interval '30 minutes', deadline_at = now() - interval '10 minutes' where id = $1", [second.id]);
  const late = await (await api(s.page, { action: "submit", id: second.id, answers: { q1: "Late answer." } })).json();
  assert.equal(late.status, "expired");

  stage = "questions forged directly in the database";
  const third = await (await api(s.page, { action: "create", repoUrl: "https://github.com/rana-test/third" })).json();
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await supa.auth.signInWithPassword({ email: student.email, password: student.password });
  const forged = [1, 2, 3].map(n => ({ id: `q${n}`, file: "src/api/users.ts", startLine: 1, endLine: 1, quote: `console.log("easy question ${n}")`, question: `What does console.log do in question ${n}?` }));
  const forgedPrepare = await supa.rpc("prepare_project_interview", { p_id: third.id, p_commit: "0123456789abcdef0123456789abcdef01234567", p_questions: forged });
  assert.equal(forgedPrepare.error, null, "the owner can technically write questions; the reviewer must catch it");
  const hidden = await supa.from("project_interviews").select("ai_review").eq("id", third.id);
  assert.ok(hidden.error, "owners cannot read the AI review column");
  assert.ok((await api(s.page, { action: "start", id: third.id })).ok());
  assert.equal((await (await api(s.page, { action: "submit", id: third.id, answers: { q1: "It prints.", q2: "It prints.", q3: "It prints." } })).json()).status, "submitted");

  stage = "admin reviews both submitted interviews";
  const a = await signIn(admin);
  await a.page.goto("/admin/interviews");
  await expect(a.page.getByRole("navigation", { name: "Admin pages" }).getByRole("link", { name: "Project interviews" })).toHaveAttribute("aria-current", "page");
  const cards = a.page.locator(".interview-review");
  await expect(cards).toHaveCount(2);
  for (const index of [0, 1]) {
    await cards.nth(index).getByRole("button", { name: /Run AI review/ }).click();
    await expect(cards.nth(index).locator(".interview-summary")).toBeVisible({ timeout: 90000 });
  }
  const genuine = a.page.locator(".interview-review", { hasText: "rana-test/budget-app" });
  const fake = a.page.locator(".interview-review", { hasText: "rana-test/third" });
  await expect(genuine.locator(".interview-summary")).toContainText("Ownership code found");
  await expect(genuine.getByText("quote matches the repository")).toHaveCount(4);
  await expect(fake.getByText("quote not found in the repository")).toHaveCount(3);
  console.log("Genuine:", (await genuine.locator(".interview-summary").innerText()).replace(/\s+/g, " "));
  console.log("Forged:", (await fake.locator(".interview-summary").innerText()).replace(/\s+/g, " "));
  await a.page.waitForTimeout(1000);
  await noOverflow(a.page);
  await a.page.screenshot({ path: `${shots}/2-admin-review-dark.png`, fullPage: true });
  await genuine.getByRole("button", { name: /Approve/ }).click();
  await expect(a.page.getByText(/Approved: rana-test\/budget-app/)).toBeVisible({ timeout: 15000 });
  await fake.getByRole("button", { name: "Reject…" }).click();
  await fake.getByLabel("Reason the student will see").fill("The questions do not match your repository.");
  await fake.getByRole("button", { name: "Reject with reason" }).click();
  await expect(a.page.getByText("No interviews to review.")).toBeVisible({ timeout: 15000 });

  stage = "student sees the outcomes";
  await s.page.goto("/account/projects");
  await expect(s.page.locator(".interview-card[data-status='approved']")).toContainText("A reviewer confirmed");
  await expect(s.page.locator(".interview-card[data-status='rejected']")).toContainText("do not match your repository");
  await expect(s.page.locator(".interview-card[data-status='expired']")).toHaveCount(1);
  const status = await db.query("select status from public.project_interviews where id = $1", [firstId]);
  assert.equal(status.rows[0].status, "approved");

  stage = "screenshots: phone and light theme";
  for (const [name, options, who, path] of [["student-phone", { viewport: { width: 390, height: 844 } }, student, "/account/projects"], ["student-light", { colorScheme: "light" }, student, "/account/projects"]]) {
    const v = await signIn(who, options);
    if (name.includes("light")) await v.page.evaluate(() => localStorage.setItem("careerforge-theme", "light"));
    await v.page.goto(path);
    await v.page.waitForTimeout(1300);
    await noOverflow(v.page);
    await v.page.screenshot({ path: `${shots}/3-${name}.png`, fullPage: true });
    await v.context.close();
  }
  console.log("Project interviews live test passed.");
} catch (error) {
  console.error(`Project interviews live test failed at: ${stage}`);
  console.error(error.message);
  process.exitCode = 1;
} finally {
  try {
    await db.query("delete from auth.users where id = any($1::uuid[])", [[student.id, admin.id]]);
    console.log("Temporary accounts, interviews and AI runs removed.");
  } catch (error) { console.error("Cleanup failed:", error.message); process.exitCode = 1; }
  await db.end().catch(() => {});
  await browser?.close();
}
