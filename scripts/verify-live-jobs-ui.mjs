// Focused browser check of live listings on /jobs against the development
// server and database. Creates one temporary confirmed identity (no mail),
// and deletes it afterwards. Requires imported live listings. Never run against production.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import nextEnv from "@next/env";
import { Client } from "pg";
import { chromium, expect } from "@playwright/test";

nextEnv.loadEnvConfig(process.cwd());
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const user = { id: randomUUID(), password: `Test-${randomUUID()}!` };
user.email = `${user.id}@careerforge.invalid`;
const db = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
let browser, stage = "setup";
try {
  await db.connect();
  // Count only current listings, as the app does (isCurrentListing: fetched within 7 days, not expired).
  const live = (await db.query("select count(*)::int n from public.job_postings where source <> 'fictional' and is_active and fetched_at > now() - interval '7 days' and (expires_at is null or expires_at > now())")).rows[0].n;
  assert.ok(live > 0, "run `npm run jobs:ingest` first");
  await db.query(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, extensions.crypt($3, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '')`, [user.id, user.email, user.password]);
  await db.query(`insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at) values ($1, $2::text, $2::uuid, $3, 'email', now(), now())`,
    [randomUUID(), user.id, JSON.stringify({ sub: user.id, email: user.email, email_verified: true })]);
  await db.query("update public.profiles set full_name='Live Jobs Tester', self_reported_skills=$2 where id=$1", [user.id, ["Python", "SQL", "React", "Git"]]);

  browser = await chromium.launch({ channel: process.platform === "win32" ? "msedge" : "chromium", headless: true });
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(`console: ${message.text().slice(0, 4000)} @ ${page.url()}`); });
  stage = "login";
  await page.goto("/login");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(`${baseURL}/account`, { timeout: 20000 });

  stage = "catalog counts and paging";
  await page.goto("/jobs");
  await expect(page.locator(".outline-label")).toHaveText(`${live} live · 6 demo`);
  await expect(page.locator(".job-card")).toHaveCount(24);
  await page.getByRole("button", { name: /^Show \d+ more$/ }).click();
  await expect(page.locator(".job-card")).toHaveCount(Math.min(48, live + 6));

  stage = "region and listing filters";
  for (const [region, label] of [["lebanon", "Lebanon"], ["mena", "Middle East & North Africa"], ["worldwide", "Worldwide remote"]]) {
    await page.getByLabel("Region", { exact: true }).selectOption(region);
    const expected = (await db.query("select count(*)::int n from public.job_postings where source <> 'fictional' and is_active and fetched_at > now() - interval '7 days' and (expires_at is null or expires_at > now()) and region=$1", [region])).rows[0].n;
    await expect(page.locator(".results-heading > span").first()).toContainText(`${expected} opportunities`);
    if (expected) await expect(page.locator(".job-card").first().locator(".tag", { hasText: label })).toBeVisible();
  }
  stage = "experience level filter";
  await page.getByLabel("Region", { exact: true }).selectOption("all");
  const levelCount = async level => (await db.query("select count(*)::int n from public.job_postings where is_active and experience_level=$1 and (source='fictional' or (fetched_at > now() - interval '7 days' and (expires_at is null or expires_at > now())))", [level])).rows[0].n;
  for (const [level, label] of [["entry", "Entry level"], ["senior", "Senior"]]) {
    await page.getByLabel("Experience level", { exact: true }).selectOption(level);
    await expect(page.locator(".results-heading > span").first()).toContainText(`${await levelCount(level)} opportunities`);
    await expect(page.locator(".job-card").first().locator(".tag", { hasText: label })).toBeVisible();
  }
  await page.getByLabel("Experience level", { exact: true }).selectOption("entry");
  const entryTitles = await page.locator(".job-card button.job-title").allTextContents();
  assert.ok(entryTitles.every(title => !/\b(senior|sr\.?|lead|principal|head of|director)\b/i.test(title)), `no senior-titled role under Entry level: ${entryTitles.filter(title => /senior|lead|director/i.test(title)).join(" | ")}`);
  assert.equal((await db.query("select count(*)::int n from public.job_postings where is_active and source <> 'fictional' and title ~* '\\m(senior|sr|principal|director|head of)\\M' and experience_level in ('entry','internship')")).rows[0].n, 0, "no senior-titled listing stored as entry level");
  await page.getByLabel("Experience level", { exact: true }).selectOption("all");

  await page.getByLabel("Region", { exact: true }).selectOption("lebanon");
  await page.getByLabel("Listing type", { exact: true }).selectOption("demo");
  await expect(page.locator(".empty-state")).toContainText("No opportunities found");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByLabel("Listing type", { exact: true }).selectOption("live");
  await expect(page.locator(".job-card small", { hasText: "Fictional company" })).toHaveCount(0);

  stage = "live dialog attribution and apply link";
  await page.getByLabel("Region", { exact: true }).selectOption("worldwide");
  const card = page.locator(".job-card").first();
  await expect(card.locator(".job-company small")).toHaveText("Live listing · via Himalayas");
  await card.locator("button.job-title").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".eyebrow")).toHaveText("LIVE LISTING · VIA HIMALAYAS");
  const apply = dialog.getByRole("link", { name: /^Apply on Himalayas/ });
  const title = await dialog.locator("h2").textContent();
  const row = (await db.query("select apply_url, source_url from public.job_postings where source='himalayas' and title=$1 limit 1", [title])).rows[0];
  await expect(apply).toHaveAttribute("href", row.apply_url);
  await expect(apply).toHaveAttribute("rel", "noopener noreferrer");
  await expect(dialog.getByRole("link", { name: /^Himalayas/ })).toHaveAttribute("href", row.source_url);
  await expect(dialog).not.toContainText("No live vacancy");

  stage = "save live listing to tracker";
  await dialog.getByRole("button", { name: "Save opportunity" }).click();
  await expect(page.getByRole("status")).toContainText("saved to your account tracker");
  await page.keyboard.press("Escape");
  await page.goto("/applications");
  await expect(page.locator(".tracker-row")).toHaveCount(1);
  await expect(page.locator(".tracker-row")).not.toContainText("No longer active");

  stage = "layout";
  await mkdir("test-results", { recursive: true });
  await page.goto("/jobs");
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator(".job-card").first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByLabel("Experience level", { exact: true })).toBeVisible();
    const wide = await page.evaluate(() => [...document.querySelectorAll("main *")].filter(el => el.getBoundingClientRect().right > innerWidth + 0.5).slice(0, 5).map(el => `${el.tagName}.${el.className} ${Math.round(el.getBoundingClientRect().right)}`));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `no horizontal overflow at ${width}px: ${wide.join(" | ")}`);
    await page.screenshot({ path: `test-results/live-jobs-${width}.png`, fullPage: false, animations: "disabled", caret: "initial" });
  }
  if (errors.length) { for (const error of errors) console.error(error); throw new Error(`${errors.length} browser error(s) logged`); }
  console.log(`PASS: ${live} live listings, counts/paging, region+level+listing filters, attribution, unchanged apply links, tracker save, 320/768/1440 layouts`);
} catch (error) {
  console.error("Live jobs UI verification failed at", stage, ":", error.message?.split("\n").slice(0, 6).join("\n"));
  process.exitCode = 1;
} finally {
  await db.query("delete from auth.users where id=$1", [user.id]).then(() => console.log("Temporary test account removed.")).catch(() => { console.error("Cleanup failed for", user.email); process.exitCode = 1; });
  await db.end().catch(() => {});
  await browser?.close();
}
