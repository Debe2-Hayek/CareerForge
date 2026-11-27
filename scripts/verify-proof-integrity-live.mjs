// Live check of proof integrity on DEVELOPMENT only (no AI, no credits). Student A uploads a
// diploma (PNG and PDF). Student B tries to reuse it: the identical PNG sent straight to the
// database with a forged fingerprint, the same design with B's name, and the same PDF
// re-exported. B also adds a real public Coursera certificate link that belongs to someone
// else. The admin sees every match, the forged fingerprint and the issuer's answer.
//   PLAYWRIGHT_BASE_URL=http://localhost:3100 EXPECTED_SUPABASE_PROJECT_REF=<dev ref> node --env-file=.env scripts/verify-proof-integrity-live.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { chromium, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const expectedRef = process.env.EXPECTED_SUPABASE_PROJECT_REF;
const connection = (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();
const shots = "test-results/proof-integrity-live";
// A public Coursera course certificate (found through a web search); its holder is not either test student.
const COURSERA_LINK = "https://www.coursera.org/verify/YTG6DFCAQS4N";
const make = (role, name) => { const id = randomUUID(); return { id, role, name, email: `${id}@careerforge.invalid`, password: `Test-${randomUUID()}!` }; };
const [alice, bob, admin] = [make("student", "Rana Haddad"), make("student", "Karim Nassar"), make("admin", "Claims Reviewer")];
const users = [alice, bob, admin];
const db = new Client({ connectionString: connection, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
let browser;
let stage = "setup";
const diploma = name => `<!doctype html><html><body style="margin:0;font-family:Georgia;text-align:center;padding:60px;border:14px double #1d3b6a;background:#fbf7ec">
<h1 style="color:#1d3b6a">Lebanese American University</h1><p>This is to certify that</p><h2 style="font-style:italic;font-size:42px">${name}</h2>
<p>has been awarded the degree of</p><h2>Bachelor of Engineering in Computer Engineering</h2><p>Conferred in Beirut, June 2020</p><p>Registration No. LAU-2020-04417</p></body></html>`;

async function createUser(user) {
  await db.query(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, extensions.crypt($3, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '')`, [user.id, user.email, user.password]);
  await db.query(`insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at) values ($1, $2::text, $2::uuid, $3, 'email', now(), now())`,
    [randomUUID(), user.id, JSON.stringify({ sub: user.id, email: user.email, email_verified: true })]);
  await db.query("update public.profiles set full_name = $2, headline = 'Test', role = $3, self_reported_skills = $4 where id = $1", [user.id, user.name, user.role, user.role === "student" ? ["SQL"] : []]);
  if (user.role === "student") {
    const { rows } = await db.query("insert into public.education_records (user_id, request_id, institution, degree, start_date, end_date) values ($1, $2, 'Lebanese American University', 'B.E. Computer Engineering', '2016-09-01', '2020-06-01') returning id", [user.id, randomUUID()]);
    user.educationId = rows[0].id;
  }
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
const sessionClient = async user => {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(`Sign-in for direct calls failed: ${error.message}`);
  return client;
};
// A review card is picked by its header line ("DEGREE · Karim Nassar"), since match lists name other accounts.
const card = (page, kind, name) => page.locator(".review-card").filter({ has: page.locator(".eyebrow", { hasText: `${kind} · ${name}` }) });
const noOverflow = async page => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "no sideways scrolling");

try {
  if (!expectedRef || !connection) throw new Error("Set EXPECTED_SUPABASE_PROJECT_REF and a database URL.");
  const url = new URL(connection);
  if (!url.hostname.includes(expectedRef) && !decodeURIComponent(url.username).endsWith(`.${expectedRef}`)) throw new Error("DATABASE_PROJECT_MISMATCH");
  if (expectedRef === "gmrribyxcpcmqlqhdwea") throw new Error("Never run this against production.");
  await db.connect();
  for (const user of users) await createUser(user);
  browser = await chromium.launch({ channel: process.platform === "win32" ? "msedge" : "chromium", headless: true });
  await mkdir(shots, { recursive: true });

  stage = "render the fictional diplomas";
  const render = await browser.newPage({ viewport: { width: 900, height: 640 } });
  await render.setContent(diploma("Rana Haddad"));
  const alicePng = await render.screenshot({ type: "png" });
  const alicePdf = await render.pdf({ format: "A4", landscape: true });
  await render.waitForTimeout(1100);
  const reexportedPdf = await render.pdf({ format: "A4", landscape: true, scale: 0.99 });
  await render.setContent(diploma("Karim Nassar"));
  const editedPng = await render.screenshot({ type: "png" });
  await render.close();
  assert.notDeepEqual(Buffer.from(alicePdf), Buffer.from(reexportedPdf), "the re-exported PDF has different bytes");

  stage = "student A uploads the diploma as PNG and PDF";
  const a = await signIn(alice);
  await a.page.goto("/account/verification");
  const aliceRow = a.page.locator(".claim-row", { hasText: "B.E. Computer Engineering" });
  await aliceRow.locator('input[type="file"]').setInputFiles({ name: "diploma.png", mimeType: "image/png", buffer: alicePng });
  await expect(aliceRow.locator(".claim-badge")).toHaveText("Proof submitted", { timeout: 30000 });
  await aliceRow.locator('input[type="file"]').setInputFiles({ name: "diploma.pdf", mimeType: "application/pdf", buffer: alicePdf });
  await expect(aliceRow).toContainText("2 files sent", { timeout: 30000 });

  stage = "student B sends A's PNG straight to the database with a forged fingerprint";
  const bobClient = await sessionClient(bob);
  const forgedPath = `${bob.id}/${randomUUID()}.png`;
  assert.equal((await bobClient.storage.from("claim-evidence").upload(forgedPath, alicePng, { contentType: "image/png" })).error, null);
  const forged = await bobClient.rpc("submit_claim_evidence", { p_kind: "degree", p_record_id: bob.educationId, p_skill: null, p_storage_path: forgedPath,
    p_file_name: "my-diploma.png", p_mime: "image/png", p_size: alicePng.byteLength, p_sha256: "0".repeat(64) });
  assert.equal(forged.error, null, forged.error?.message);

  stage = "student B uploads an edited copy and the re-exported PDF through the page";
  const b = await signIn(bob);
  await b.page.goto("/account/verification");
  const bobRow = b.page.locator(".claim-row", { hasText: "B.E. Computer Engineering" });
  await bobRow.locator('input[type="file"]').setInputFiles({ name: "diploma-karim.png", mimeType: "image/png", buffer: editedPng });
  await expect(bobRow).toContainText("2 files sent", { timeout: 30000 });
  await bobRow.locator('input[type="file"]').setInputFiles({ name: "diploma-karim.pdf", mimeType: "application/pdf", buffer: reexportedPdf });
  await expect(bobRow).toContainText("3 files sent", { timeout: 30000 });

  stage = "student B adds verification links";
  const sqlRow = b.page.locator(".claim-row", { hasText: "SQL" });
  await sqlRow.getByRole("button", { name: "Add a verification link" }).click();
  const input = sqlRow.getByLabel("Public verification link");
  await input.fill("https://evil.example/verify/ABC123");
  await sqlRow.getByRole("button", { name: "Add link" }).click();
  await expect(sqlRow.locator(".form-error")).toContainText("Coursera");
  await b.page.waitForTimeout(500);
  await b.page.screenshot({ path: `${shots}/1-owner-link-form-dark.png`, fullPage: true });
  await input.fill(COURSERA_LINK);
  await sqlRow.getByRole("button", { name: "Add link" }).click();
  await expect(b.page.locator(".claims-message")).toContainText("Coursera link added", { timeout: 30000 });
  await expect(sqlRow).toContainText("1 link sent");
  const direct = await b.page.request.post("/api/v1/claims/links", { headers: { Origin: baseURL }, data: { kind: "skill", skill: "SQL", url: "https://www.coursera.org.evil.example/verify/ABC123" } });
  assert.equal(direct.status(), 400, "the endpoint refuses look-alike addresses");
  const sqlBypass = await bobClient.rpc("add_claim_link", { p_kind: "skill", p_record_id: null, p_skill: "SQL", p_url: "https://evil.example/" });
  assert.equal(sqlBypass.error?.code, "22023", "the database refuses unknown sites too");
  await noOverflow(b.page);

  stage = "students cannot read or write fingerprints or link checks";
  assert.deepEqual((await bobClient.from("evidence_fingerprints").select("evidence_id")).data, []);
  assert.equal((await bobClient.rpc("record_evidence_fingerprint", { p_evidence_id: randomUUID(), p_sha256: "a".repeat(64), p_text_hash: null, p_image_hash: null })).error?.code, "42501");
  assert.equal((await bobClient.rpc("evidence_fingerprint_backlog", { p_limit: 5 })).error?.code, "42501");
  assert.equal((await b.page.request.post("/api/v1/admin/claims/link-check", { headers: { Origin: baseURL }, data: { linkId: randomUUID() } })).status(), 403);

  stage = "the admin page fingerprints every file and shows the matches";
  const r = await signIn(admin);
  await r.page.goto("/admin/claims");
  const prints = await db.query("select e.user_id, e.sha256 as sent, f.sha256, f.text_hash, f.image_hash from public.evidence_fingerprints f join public.claim_evidence e on e.id = f.evidence_id where e.user_id = any($1::uuid[])", [[alice.id, bob.id]]);
  assert.equal(prints.rowCount, 5, "all five files were fingerprinted from their stored bytes");
  assert.equal(prints.rows.filter(row => row.sent !== row.sha256).length, 1, "exactly the forged one differs");
  const bobCard = card(r.page, "DEGREE", "Karim Nassar");
  await expect(bobCard.locator(".review-flag")).toContainText("A file was altered on the way in");
  await expect(bobCard.locator('.proof-integrity[data-state="altered"]')).toContainText("The fingerprint sent with this file is wrong");
  await expect(bobCard.locator('.proof-matches strong[data-reason="same_file"]')).toHaveCount(1);
  await expect(bobCard.locator('.proof-matches strong[data-reason="same_text"]')).toHaveCount(1);
  assert.ok(await bobCard.locator('.proof-matches strong[data-reason="similar_image"]').count() >= 1, "the edited copy is near-identical to A's diploma");
  await expect(bobCard.locator(".proof-matches").first()).toContainText("Rana Haddad");
  const aliceCard = card(r.page, "DEGREE", "Rana Haddad");
  await expect(aliceCard.locator(".proof-matches li").first()).toContainText("Karim Nassar");
  await r.page.waitForTimeout(1200);
  await noOverflow(r.page);
  await r.page.screenshot({ path: `${shots}/2-admin-matches-dark.png`, fullPage: true });

  stage = "the admin checks the Coursera link with Coursera";
  const linkCard = card(r.page, "SKILL", "Karim Nassar");
  await linkCard.getByRole("button", { name: "Check with Coursera" }).click();
  await expect(linkCard.locator(".proof-link-result")).toBeVisible({ timeout: 30000 });
  const answer = await linkCard.locator(".proof-link-result").innerText();
  console.log("Coursera answer:", answer.replace(/\s+/g, " ").replace(/belongs to .+?, not/, "belongs to [holder], not"));
  assert.match(answer, /Different holder/);
  assert.match(answer, /not Karim Nassar/);
  await expect(linkCard.locator(".review-flag")).toHaveCount(0);
  await r.page.reload();
  await expect(r.page.locator('.proof-link[data-result="name_mismatch"]')).toHaveCount(1);
  await expect(card(r.page, "SKILL", "Karim Nassar").locator(".review-flag")).toContainText("verification link does not match");
  await r.page.screenshot({ path: `${shots}/3-admin-link-dark.png`, fullPage: true });

  stage = "phone and light theme";
  for (const [name, options] of [["phone", { viewport: { width: 390, height: 844 } }], ["light", { colorScheme: "light" }]]) {
    const v = await signIn(admin, options);
    if (name === "light") await v.page.evaluate(() => localStorage.setItem("careerforge-theme", "light"));
    await v.page.goto("/admin/claims");
    await v.page.waitForTimeout(1300);
    await noOverflow(v.page);
    await v.page.screenshot({ path: `${shots}/4-admin-${name}.png`, fullPage: true });
    const o = await signIn(bob, options);
    if (name === "light") await o.page.evaluate(() => localStorage.setItem("careerforge-theme", "light"));
    await o.page.goto("/account/verification");
    await o.page.locator(".claim-row", { hasText: "B.E. Computer Engineering" }).getByRole("button", { name: "Add a verification link" }).click();
    await o.page.waitForTimeout(800);
    await noOverflow(o.page);
    await o.page.screenshot({ path: `${shots}/5-owner-${name}.png`, fullPage: true });
    await v.context.close();
    await o.context.close();
  }
  console.log("Proof integrity live test passed.");
} catch (error) {
  console.error(`Proof integrity live test failed at: ${stage}`);
  console.error(error.message);
  process.exitCode = 1;
} finally {
  try {
    const paths = await db.query("select user_id, storage_path from public.claim_evidence where user_id = any($1::uuid[])", [users.map(u => u.id)]);
    await db.query("delete from public.claim_evidence where user_id = any($1::uuid[])", [users.map(u => u.id)]);
    for (const user of users) {
      const mine = paths.rows.filter(row => row.user_id === user.id).map(row => row.storage_path);
      if (!mine.length) continue;
      const client = await sessionClient(user);
      await client.storage.from("claim-evidence").remove(mine);
    }
    await db.query("delete from auth.users where id = any($1::uuid[])", [users.map(u => u.id)]);
    console.log("Temporary accounts, claims, links, fingerprints and files removed.");
  } catch (error) { console.error("Cleanup failed:", error.message); process.exitCode = 1; }
  await db.end().catch(() => {});
  await browser?.close();
}
