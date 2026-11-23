// Live check of CV analysis on DEVELOPMENT only. A temporary student with a profile, work
// history, a passed React check and a saved demo job opens /cv-analysis, sees the score and
// next steps, asks for the AI explanation (test AI with AI_FAKE=1, or the real AI: 1-2 calls),
// analyses a pasted job and opens a direct link to another job. Then everything is deleted.
//   PLAYWRIGHT_BASE_URL=http://localhost:3100 EXPECTED_SUPABASE_PROJECT_REF=<dev ref> node --env-file=.env scripts/verify-cv-analysis-live.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { Client } from "pg";
import { chromium, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const expectedRef = process.env.EXPECTED_SUPABASE_PROJECT_REF;
const connection = (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();
const shots = "test-results/cv-analysis-live";
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
  await db.query("update public.profiles set full_name = 'Rana Haddad', headline = 'Frontend developer', self_reported_skills = $2, project_summary = 'Weather app in React' where id = $1", [user.id, ["React", "JavaScript", "CSS", "Git"]]);
  await db.query("insert into public.experience_records (user_id, request_id, company, role, description, start_date, is_current) values ($1, $2, 'Areeba', 'Frontend Developer', 'Building web apps in React.', '2024-09-01', true)", [user.id, randomUUID()]);
  await db.query("insert into public.education_records (user_id, request_id, institution, degree, start_date, end_date) values ($1, $2, 'Lebanese American University', 'B.S. Computer Science', '2020-09-01', '2024-06-01')", [user.id, randomUUID()]);
  await db.query("insert into public.skill_check_attempts (user_id, skill, version, score, passed) values ($1, 'React', 1, 5, true)", [user.id]);
  const demo = await db.query("select id, title from public.job_postings where is_fictional and is_active and cardinality(skills) >= 3 order by id limit 2");
  assert.ok(demo.rowCount >= 2, "two demo jobs are needed");
  const [saved, other] = demo.rows;
  await db.query("insert into public.saved_jobs (user_id, job_id) values ($1, $2)", [user.id, saved.id]);
  browser = await chromium.launch({ channel: process.platform === "win32" ? "msedge" : "chromium", headless: true });
  await mkdir(shots, { recursive: true });

  stage = "the saved job is analysed";
  const s = await signIn();
  await s.page.goto("/cv-analysis");
  await expect(s.page.getByRole("heading", { level: 1 })).toContainText("Will your CV land this job");
  await expect(s.page.getByRole("radio", { name: new RegExp(saved.title) })).toBeChecked();
  const ring = s.page.getByRole("img", { name: /Match \d+%/ });
  await expect(ring).toBeVisible();
  const score = Number((await ring.getAttribute("aria-label")).match(/(\d+)%/)[1]);
  console.log(`${saved.title}: ${score}%`);
  await expect(s.page.locator(".fit-factors li")).toHaveCount(4);
  await expect(s.page.locator(".fit-steps")).toBeVisible();

  stage = "AI explanation";
  await s.page.getByRole("button", { name: "Explain with AI" }).click();
  await expect(s.page.locator(".fit-ai-body")).toBeVisible({ timeout: 90000 });
  const aiText = await s.page.locator(".fit-ai").innerText();
  console.log(/test AI/i.test(aiText) ? "Mode: development test AI (no credits used)" : "Mode: real AI");
  console.log("AI explanation:", aiText.split("\n").filter(Boolean).slice(0, 8).join(" | "));
  await s.page.waitForTimeout(1200);
  await noOverflow(s.page);
  await s.page.screenshot({ path: `${shots}/1-saved-job-dark.png`, fullPage: true });

  stage = "a pasted job";
  await s.page.getByRole("tab", { name: "Paste a job" }).click();
  await s.page.getByLabel("Job title").fill("Data Analyst");
  await s.page.getByLabel("Job description").fill("You will use SQL, Python and Power BI every day. 3 years of experience in data analysis. A bachelor's degree is required.");
  await s.page.getByRole("button", { name: "Analyse this job" }).click();
  await expect(s.page.getByRole("heading", { name: /Data Analyst/ })).toBeVisible();
  await expect(s.page.locator(".fit-skill-list li.missing")).toContainText(["SQL"]);
  const pastedScore = Number((await s.page.getByRole("img", { name: /Match \d+%/ }).getAttribute("aria-label")).match(/(\d+)%/)[1]);
  console.log(`Pasted Data Analyst: ${pastedScore}%`);
  assert.ok(pastedScore < score, "a job outside the profile scores lower");
  await s.page.waitForTimeout(800);
  await s.page.screenshot({ path: `${shots}/2-pasted-job-dark.png`, fullPage: true });

  stage = "a direct link to another job";
  await s.page.goto(`/cv-analysis?job=${encodeURIComponent(other.id)}`);
  await expect(s.page.getByRole("radio", { name: new RegExp(other.title) })).toBeChecked();
  const denied = await s.page.request.post("/api/v1/cv-analysis/explain", { headers: { Origin: "https://evil.example" }, data: { jobId: saved.id } });
  assert.equal(denied.status(), 403);

  stage = "phone and light theme";
  for (const [name, options] of [["phone", { viewport: { width: 390, height: 844 } }], ["light", { colorScheme: "light" }]]) {
    const v = await signIn(options);
    if (name === "light") await v.page.evaluate(() => localStorage.setItem("careerforge-theme", "light"));
    await v.page.goto("/cv-analysis");
    await expect(v.page.getByRole("img", { name: /Match \d+%/ })).toBeVisible();
    await v.page.waitForTimeout(1300);
    await noOverflow(v.page);
    await v.page.screenshot({ path: `${shots}/3-${name}.png`, fullPage: true });
    await v.context.close();
  }
  console.log("CV analysis live test passed.");
} catch (error) {
  console.error(`CV analysis live test failed at: ${stage}`);
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
