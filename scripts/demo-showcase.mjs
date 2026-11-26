// End-to-end showcase test case on DEVELOPMENT only, with the real AI (dev server WITHOUT AI_FAKE).
// One fictional student, Karim Nassar (a fictional computer science graduate in Beirut), goes through
// the whole product: AI profile from a CV, languages, proof reviewed by a reviewer, a skill check, a
// workshop certificate, jobs and applications, CV and career analysis, the assistant, the CV &
// portfolio builder, a published website and the public "checked facts" page.
// Every step is recorded as a test case (expected / actual / pass or fail) with a screenshot.
// The demo accounts are KEPT so the owner can sign in and look around; their passwords are written
// only to the git-ignored file named by DEMO_CREDENTIALS. All names and documents are fictional.
//   PLAYWRIGHT_BASE_URL=http://localhost:3100 EXPECTED_SUPABASE_PROJECT_REF=<dev ref> DEMO_OUT=<folder> DEMO_CREDENTIALS=<file> node --env-file=.env scripts/demo-showcase.mjs
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { chromium, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100";
const expectedRef = process.env.EXPECTED_SUPABASE_PROJECT_REF;
const connection = (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();
const out = process.env.DEMO_OUT ?? "test-results/demo-showcase";
const credentialsFile = process.env.DEMO_CREDENTIALS;
const run = randomUUID().slice(0, 6);
const make = (role, name) => ({ id: randomUUID(), role, name, email: `demo-${name.toLowerCase().replace(/[^a-z]+/g, "-")}-${run}@careerforge.invalid`, password: `Demo-${randomUUID()}!` });
const student = make("student", "Karim Nassar");
const reviewer = make("admin", "Demo Reviewer");
const trainer = make("student", "Nadia Trainer");
const db = new Client({ connectionString: connection, connectionTimeoutMillis: 15000, statement_timeout: 20000 });
const results = [];
let browser;

const CV_HTML = `<!doctype html><html><body style="font-family:Arial;padding:40px;line-height:1.5;color:#111">
<h1 style="margin:0">Karim Nassar</h1><p>Junior Full-Stack Developer · Beirut, Lebanon · karim.nassar@example.com</p>
<h2>Summary</h2><p>Computer science graduate who builds web apps with React and Node.js, and enjoys clean APIs and databases.</p>
<h2>Education</h2><p><b>BS in Computer Science</b>, Beirut Institute of Technology (fictional), Sep 2021 – Jun 2025. GPA 3.6/4.</p>
<h2>Experience</h2>
<p><b>Software Engineering Intern</b>, Cedar Apps (fictional), Jun 2024 – Sep 2024. Built React screens and REST endpoints in Node.js for a delivery app; wrote tests.</p>
<p><b>Freelance Web Developer</b>, Self-employed, Jul 2025 – present. Websites for small businesses in Beirut with React, TypeScript and PostgreSQL.</p>
<h2>Projects</h2><p><b>Souk Finder</b>: a React and Node.js app that compares grocery prices across Beirut markets, with a PostgreSQL database.</p>
<h2>Skills</h2><p>JavaScript, TypeScript, React, Node.js, SQL, PostgreSQL, Git, Docker, HTML, CSS</p>
<h2>Languages</h2><p>Arabic (native), English (fluent, IELTS 7.5), French (intermediate)</p></body></html>`;
const DIPLOMA = `<!doctype html><html><body style="font-family:Georgia;text-align:center;padding:60px;border:12px double #333">
<h1>Beirut Institute of Technology</h1><p style="color:#a00">FICTIONAL DOCUMENT FOR A DEMO</p><p>This is to certify that</p><h2>Karim Nassar</h2>
<p>has been awarded the degree of</p><h2>Bachelor of Science in Computer Science</h2><p>Conferred in Beirut, June 2025</p><p>Registration No. BIT-2025-01877</p></body></html>`;
const IELTS = `<!doctype html><html><body style="font-family:Arial;padding:40px"><h1>IELTS Test Report Form (fictional demo)</h1>
<p>Candidate: Karim Nassar</p><p>Test date: 10 March 2025</p><p>Listening 8.0 · Reading 7.5 · Writing 7.0 · Speaking 7.5</p><h2>Overall Band Score: 7.5</h2><p>CEFR level: C1</p></body></html>`;

async function createUser(user) {
  await db.query(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, extensions.crypt($3, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '')`, [user.id, user.email, user.password]);
  await db.query(`insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at) values ($1, $2::text, $2::uuid, $3, 'email', now(), now())`,
    [randomUUID(), user.id, JSON.stringify({ sub: user.id, email: user.email, email_verified: true })]);
  // The student starts empty, as a real new account; staff get a name and role.
  await db.query("update public.profiles set full_name = $2, role = $3 where id = $1", [user.id, user === student ? "" : user.name, user.role]);
}
async function signIn(user, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ baseURL, viewport });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(`${baseURL}/account`, { timeout: 60000 });
  return { context, page };
}
/** Screenshot of a page or of one element (a locator). */
const shot = async (target, name, options = {}) => {
  await (target.waitForTimeout ? target : target.page()).waitForTimeout(900);
  await target.screenshot({ path: `${out}/${name}.png`, ...options });
  return `${name}.png`;
};
/** One test case: runs, records expected vs actual and a screenshot, and never stops the showcase. */
async function step(id, title, expected, body) {
  const started = Date.now();
  try {
    const { actual, shots = [] } = await body();
    results.push({ id, title, expected, actual, status: "PASS", seconds: Math.round((Date.now() - started) / 100) / 10, shots });
    console.log(`PASS ${id} ${title}: ${actual}`);
  } catch (error) {
    const message = String(error?.message ?? error).split("\n")[0].slice(0, 220);
    results.push({ id, title, expected, actual: message, status: "FAIL", seconds: Math.round((Date.now() - started) / 100) / 10, shots: [] });
    console.log(`FAIL ${id} ${title}: ${message}`);
  }
}
const clean = text => text.replace(/\s+/g, " ").trim();

/**
 * Each run starts clean: the previous demo's accounts, proof files, workshops and published site are
 * removed (only accounts named demo-…@careerforge.invalid on development). Proof files are deleted
 * as their owner, with the previous run's credentials, so nothing is left in storage.
 */
async function removePreviousDemo() {
  const previous = credentialsFile ? await readFile(credentialsFile, "utf8").catch(() => "") : "";
  const accounts = [...previous.matchAll(/Email: (demo-\S+@careerforge\.invalid)\s+Password: (\S+)/g)].map(match => ({ email: match[1], password: match[2] }));
  const ids = (await db.query("select id, email from auth.users where email like 'demo-%@careerforge.invalid'")).rows;
  if (!ids.length) return;
  const files = await db.query("select e.storage_path, u.email from public.claim_evidence e join auth.users u on u.id = e.user_id where u.email like 'demo-%@careerforge.invalid'");
  for (const account of accounts) {
    const mine = files.rows.filter(row => row.email === account.email).map(row => row.storage_path);
    if (!mine.length) continue;
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
    if (!(await client.auth.signInWithPassword(account)).error) await client.storage.from("claim-evidence").remove(mine);
  }
  await db.query("delete from public.claim_evidence where user_id = any($1::uuid[])", [ids.map(row => row.id)]);
  await db.query("delete from public.certified_workshops where title like 'Containers in practice (demo %)'");
  await db.query("delete from auth.users where id = any($1::uuid[])", [ids.map(row => row.id)]);
  console.log(`Removed ${ids.length} accounts from the previous demo.`);
}
const isRealAi = text => !/test AI/i.test(text);

try {
  if (!expectedRef || !connection) throw new Error("Set EXPECTED_SUPABASE_PROJECT_REF and a database URL.");
  const url = new URL(connection);
  if (!url.hostname.includes(expectedRef) && !decodeURIComponent(url.username).endsWith(`.${expectedRef}`)) throw new Error("DATABASE_PROJECT_MISMATCH");
  if (expectedRef === "gmrribyxcpcmqlqhdwea") throw new Error("Never run this against production.");
  await db.connect();
  await mkdir(out, { recursive: true });
  await removePreviousDemo();
  for (const user of [student, reviewer, trainer]) await createUser(user);
  browser = await chromium.launch({ channel: process.platform === "win32" ? "msedge" : "chromium", headless: true });
  const render = async (html, pdf) => { const p = await browser.newPage({ viewport: { width: 900, height: 640 } }); await p.setContent(html); const file = pdf ? await p.pdf({ format: "A4", landscape: html === DIPLOMA }) : await p.screenshot({ type: "png" }); await p.close(); return file; };
  const cvPdf = await render(CV_HTML, true), diplomaPdf = await render(DIPLOMA, true), ieltsPng = await render(IELTS, false);
  await writeFile(`${out}/karim-nassar-cv.pdf`, cvPdf);

  const s = await signIn(student);
  const sp = s.page;

  await step("TC-01", "A new account opens on a guided profile", "Signed in to an empty private profile with the AI start", async () => {
    await expect(sp.getByRole("button", { name: "Read my CV with AI" })).toBeVisible({ timeout: 30000 });
    return { actual: "Empty profile, \"Read my CV with AI\" offered", shots: [await shot(sp, "01-new-account")] };
  });

  await step("TC-02", "AI reads the CV and fills the profile", "Real AI finds name, headline, education, 2 jobs and skills; the student ticks and saves them", async () => {
    await sp.locator("#profile-cv-file").setInputFiles({ name: "karim-nassar-cv.pdf", mimeType: "application/pdf", buffer: cvPdf });
    await sp.getByRole("checkbox", { name: /I agree to send my CV text/ }).check();
    await sp.getByRole("button", { name: "Read my CV with AI" }).click();
    await expect(sp.getByRole("heading", { name: "Check what the AI found" })).toBeVisible({ timeout: 120000 });
    const found = clean(await sp.locator(".profile-ai-review, .profile-ai-items, section").filter({ hasText: "Check what the AI found" }).first().innerText()).slice(0, 260);
    const review = await shot(sp, "02a-ai-review", { fullPage: true });
    await sp.getByRole("button", { name: /^Save \d+ to my profile$/ }).click();
    await expect(sp.locator(".profile-ai-done")).toContainText("Saved", { timeout: 60000 });
    const saved = clean(await sp.locator(".profile-ai-done").innerText());
    return { actual: `${saved} AI found: ${found}`, shots: [review, await shot(sp, "02b-profile-saved")] };
  });

  await step("TC-03", "Languages with a test score", "Arabic native, English C1 backed by IELTS 7.5, French B1 are saved", async () => {
    await sp.goto("/account/history#languages");
    const add = async (language, level, test, score, date) => {
      const panel = sp.locator("#languages");
      await panel.getByRole("button", { name: "Add a language" }).click();
      await panel.getByLabel("Language", { exact: true }).fill(language);
      await panel.getByLabel("Your level").selectOption(level);
      if (test) { await panel.getByLabel("Test result").selectOption(test); await panel.getByLabel("Score or level").fill(score); await panel.getByLabel("Test date").fill(date); }
      await sp.getByRole("button", { name: "Add language" }).click();
      await expect(panel.locator(".notice")).toContainText(`${language} added`, { timeout: 20000 });
    };
    await add("Arabic", "native"); await add("English", "C1", "ielts", "7.5", "2025-03-10"); await add("French", "B1");
    await expect(sp.locator(".language-list > li")).toHaveCount(3);
    return { actual: "3 languages saved; English shows the IELTS 7.5 result", shots: [await shot(sp.locator("#languages"), "03-languages")] };
  });

  await step("TC-04", "Proof for the degree and the English score", "The diploma (PDF) and IELTS report (image) upload privately; both wait for a reviewer", async () => {
    await sp.goto("/account/verification");
    // Let the page finish loading first: a file picked before it is ready would not be sent.
    await sp.waitForLoadState("networkidle"); await sp.waitForTimeout(1500);
    const degree = sp.locator(".claim-row", { hasText: /Computer Science/ }).first();
    await degree.locator('input[type="file"]').setInputFiles({ name: "diploma.pdf", mimeType: "application/pdf", buffer: diplomaPdf });
    await expect(degree.locator(".claim-badge")).toHaveText("Proof submitted", { timeout: 30000 });
    const english = sp.locator(".claim-row", { hasText: "English" }).first();
    await english.locator('input[type="file"]').setInputFiles({ name: "ielts-report.png", mimeType: "image/png", buffer: ieltsPng });
    await expect(english.locator(".claim-badge")).toHaveText("Proof submitted", { timeout: 30000 });
    return { actual: "Both facts show \"Proof submitted\"", shots: [await shot(sp, "04-proof-sent", { fullPage: true })] };
  });

  const r = await signIn(reviewer);
  const rp = r.page;
  await step("TC-05", "Reviewer checks the proof with AI and approves", "The real AI compares each file with the claim; the reviewer approves both", async () => {
    await rp.goto("/admin/claims");
    const cards = rp.locator(".review-card").filter({ has: rp.locator(".eyebrow", { hasText: "Karim Nassar" }) });
    await expect(cards).toHaveCount(2, { timeout: 30000 });
    const degreeCard = cards.filter({ hasText: /Computer Science/ }).first();
    const aiPanel = degreeCard.locator(".ai-check:not(.text-check)").first();
    await aiPanel.getByRole("button", { name: "Run AI check" }).click();
    await expect(aiPanel.locator(".ai-check-table")).toBeVisible({ timeout: 120000 });
    const verdict = clean(await aiPanel.locator(".ai-check-status").first().innerText());
    const table = clean(await aiPanel.locator(".ai-check-table").innerText()).slice(0, 220);
    const queue = await shot(rp, "05a-reviewer-ai-check", { fullPage: true });
    // One at a time, each waiting for its own confirmation, so the second click never lands mid-refresh.
    const mine = () => rp.locator(".review-card").filter({ has: rp.locator(".eyebrow", { hasText: "Karim Nassar" }) });
    for (const label of [/Computer Science/, "English"]) {
      const before = await mine().count();
      await mine().filter({ hasText: label }).first().getByRole("button", { name: /^Approve/ }).click();
      // Approved cards leave the queue.
      await expect(mine()).toHaveCount(before - 1, { timeout: 30000 });
    }
    return { actual: `AI verdict: ${verdict} (${isRealAi(table) ? "real AI" : "TEST AI"}). ${table}`, shots: [queue] };
  });

  await step("TC-06", "Student sees the checked facts", "Degree and English show \"Reviewed\" on the proof page", async () => {
    await sp.goto("/account/verification");
    await expect(sp.locator(".claim-row", { hasText: /Computer Science/ }).first().locator(".claim-badge")).toHaveText("Reviewed", { timeout: 20000 });
    await expect(sp.locator(".claim-row", { hasText: "English" }).first().locator(".claim-badge")).toHaveText("Reviewed");
    return { actual: "Both badges: Reviewed", shots: [await shot(sp, "06-proof-reviewed", { fullPage: true })] };
  });

  await step("TC-07", "Skill check: React", "The student takes the published React check and passes; React becomes a checked skill", async () => {
    const bank = (await db.query("select version, questions from careerforge_internal.skill_check_banks where lower(skill) = 'react' order by version desc limit 1")).rows[0];
    if (!bank) throw new Error("No published React check on development");
    await sp.goto("/skill-checks");
    const card = sp.locator(".check-card", { hasText: "React" }).first();
    await card.getByRole("button", { name: "Start check" }).click();
    await expect(sp.getByRole("heading", { name: /React basics/ })).toBeVisible({ timeout: 20000 });
    const quiz = await shot(sp, "07a-skill-check");
    for (const question of bank.questions) await sp.locator(`input[name="${question.id}"]`).nth(question.answer).check();
    await sp.getByRole("button", { name: "Submit answers" }).click();
    await expect(sp.getByText(/React: \d+\/\d+\. Basics check passed/)).toBeVisible({ timeout: 20000 });
    return { actual: `Passed React v${bank.version} (${bank.questions.length}/${bank.questions.length})`, shots: [quiz, await shot(sp, "07b-skill-passed")] };
  });

  const t = await signIn(trainer);
  const title = `Containers in practice (demo ${run})`;
  await step("TC-08", "Workshop with a certificate", "The student enrols, the trainer records attendance and score 88, and a checkable certificate is issued", async () => {
    await rp.goto("/admin/workshops");
    await rp.locator(".workshop-new summary").click();
    const form = rp.locator(".workshop-new");
    const local = date => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const start = new Date(Date.now() + 3 * 86400000);
    await form.getByLabel("Title").fill(title);
    await form.getByLabel("Summary").fill("Build, run and ship a container, hands on.");
    await form.getByLabel("Starts").fill(local(start));
    await form.getByLabel("Ends").fill(local(new Date(start.getTime() + 2 * 3600000)));
    await form.getByLabel("Seats").fill("20");
    await form.getByLabel("Status").selectOption("open");
    await form.getByLabel("Certificate type").selectOption("assessed");
    await form.getByLabel("Pass mark (out of 100)").fill("70");
    await form.getByLabel("Trainer name on certificates").fill("Nadia Trainer");
    await form.getByLabel("Trainer's account email").fill(trainer.email);
    await form.getByRole("button", { name: "Create workshop" }).click();
    await expect(rp.locator(".workshop-roster", { hasText: title })).toBeVisible({ timeout: 20000 });
    const workshopId = (await db.query("select id from public.certified_workshops where title = $1", [title])).rows[0].id;
    await sp.goto("/account/certificates");
    const card = sp.locator(".learner-workshop", { hasText: title });
    await card.getByRole("button", { name: "Enroll" }).click();
    await expect(card.locator(".learner-enrolled")).toHaveText("✓ Enrolled", { timeout: 20000 });
    // The session "takes place": its times move into the past so attendance can be recorded.
    await db.query("update public.certified_workshops set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour' where id = $1", [workshopId]);
    const edit = rp.locator(".workshop-edit", { hasText: title });
    await rp.reload(); await edit.locator("summary").click();
    await edit.getByLabel("Trainer agreement reference").fill("Demo agreement TR-DEMO-01");
    await edit.getByRole("button", { name: "Save workshop" }).click();
    await expect(edit.locator(".notice")).toContainText("Workshop saved", { timeout: 20000 });
    await t.page.goto("/account/certificates");
    const roster = t.page.locator(".teaching .workshop-roster", { hasText: title });
    const row = t.page.locator(".roster-list > li", { hasText: "Karim Nassar" });
    await row.getByLabel("Score for Karim Nassar").fill("88");
    await row.getByRole("button", { name: "Present" }).click();
    await expect(row).toContainText("score 88", { timeout: 20000 });
    await roster.getByRole("button", { name: /Issue certificates/ }).click();
    await expect(roster.locator(".notice")).toContainText("certificate(s) issued", { timeout: 20000 });
    const trainerShot = await shot(roster, "08a-trainer-roster");
    const cert = (await db.query("select id from public.workshop_certificates where workshop_id = $1 and user_id = $2", [workshopId, student.id])).rows[0];
    const visitor = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } });
    const v = await visitor.newPage();
    await v.goto(`/certificates/${cert.id}`);
    await expect(v.getByText("Karim Nassar").first()).toBeVisible({ timeout: 20000 });
    const publicCheck = await shot(v, "08b-certificate-check");
    await visitor.close();
    await sp.goto(`/account/certificates/${cert.id}/print`);
    await expect(sp.locator(".certificate-paper, .certificate-frame").first()).toBeVisible({ timeout: 20000 });
    return { actual: `Certificate ${cert.id.slice(0, 8)}… issued; a signed-out visitor can check it`, shots: [trainerShot, publicCheck, await shot(sp, "08c-certificate-print")] };
  });

  await step("TC-09", "Jobs that fit, saved and tracked", "The two best matches are saved; one is marked Applied and one Interview", async () => {
    await sp.goto("/jobs");
    const cards = sp.locator(".job-card");
    await expect(cards.first()).toBeVisible({ timeout: 30000 });
    const titles = [];
    for (const index of [0, 1]) {
      const card = cards.nth(index);
      const jobTitle = clean(await card.locator(".job-title").innerText());
      titles.push(`${jobTitle} (${clean(await card.locator(".job-match, .match-score, .skill-match").first().innerText().catch(() => "match shown"))})`);
      await card.getByRole("button", { name: `Save ${jobTitle}`, exact: true }).click();
      await expect(sp.getByRole("status")).toContainText("saved to your account tracker", { timeout: 20000 });
    }
    const jobsShot = await shot(sp, "09a-jobs");
    await sp.goto("/applications");
    const plain = titles.map(entry => entry.replace(/ \(.*\)$/, ""));
    await sp.getByLabel(`Status for ${plain[0]}`).first().selectOption("Applied");
    await expect(sp.getByRole("status")).toContainText("status saved", { timeout: 20000 });
    await sp.getByLabel(`Status for ${plain[1]}`).first().selectOption("Interview");
    await expect(sp.getByRole("status")).toContainText("status saved", { timeout: 20000 });
    return { actual: `Saved: ${titles.join("; ")}. Statuses: Applied, Interview`, shots: [jobsShot, await shot(sp, "09b-applications")] };
  });

  await step("TC-10", "CV vs job with an AI explanation", "A clear match score, missing skills and next steps, then a real AI explanation", async () => {
    await sp.goto("/cv-analysis");
    await sp.waitForTimeout(2500);
    const score = await sp.getByRole("img", { name: /Match \d+%/ }).first().getAttribute("aria-label", { timeout: 30000 });
    await sp.getByRole("button", { name: "Explain with AI" }).click();
    await expect(sp.locator(".fit-ai-body")).toBeVisible({ timeout: 120000 });
    const ai = clean(await sp.locator(".fit-ai").innerText());
    return { actual: `${score}. AI (${isRealAi(ai) ? "real" : "TEST"}): ${ai.slice(0, 260)}`, shots: [await shot(sp, "10-cv-analysis", { fullPage: true })] };
  });

  await step("TC-11", "Career analysis with the AI coach", "Closest careers are ranked and the AI coach explains the priorities", async () => {
    await sp.goto("/career-analysis");
    await sp.waitForTimeout(3000);
    const top = clean(await sp.locator("main").innerText()).match(/[A-Z][A-Za-z+ ]+ \d+%/g)?.slice(0, 3).join(" | ") ?? "ranking shown";
    await sp.getByRole("button", { name: "Explain with AI" }).first().click();
    await expect(sp.locator(".fit-ai").first()).toBeVisible({ timeout: 120000 });
    await sp.waitForTimeout(5000);
    const coach = clean(await sp.locator(".fit-ai").first().innerText());
    return { actual: `${top}. Coach (${isRealAi(coach) ? "real" : "TEST"}): ${coach.slice(0, 220)}`, shots: [await shot(sp, "11-career-analysis", { fullPage: true })] };
  });

  await step("TC-12", "AI assistant that knows the profile", "A personal answer that mentions the student's real skills and links to the right tools", async () => {
    await sp.goto("/career-assistant");
    await sp.getByRole("button", { name: "What should I learn next?" }).click();
    const reply = sp.locator(".assistant-message.from-assistant:not(.typing)").last();
    await reply.waitFor({ timeout: 120000 });
    await sp.waitForTimeout(1500);
    const text = clean(await reply.innerText());
    return { actual: `(${isRealAi(text) ? "real AI" : "TEST AI"}) ${text.slice(0, 320)}`, shots: [await shot(sp, "12-assistant")] };
  });

  await step("TC-13", "CV & portfolio from rough notes, published as a website", "Real AI writes the portfolio and CV; it is published at /u/<name> and opens for a visitor", async () => {
    await sp.goto("/documents");
    // Wait for the builder to finish loading; typing before that can mix in its example notes.
    await sp.waitForLoadState("networkidle"); await sp.waitForTimeout(2000);
    const builder = sp.locator(".pb");
    await builder.getByLabel("Your notes", { exact: true }).fill("karim nassar, cs grad from beirut (2025). interned at cedar apps building react screens and node apis. freelance since 2025 making sites for small shops with react, typescript and postgres. built souk finder to compare market prices. arabic native, english fluent, french ok.");
    await builder.getByRole("button", { name: "Generate with AI", exact: true }).click();
    try { await expect(builder.locator(".hero h2")).toHaveText(/Karim Nassar/i, { timeout: 150000 }); }
    catch (error) { await shot(sp, "13-builder-problem"); throw new Error(`Generation did not finish: ${clean(await builder.locator(".note, [role=status], [role=alert]").allInnerTexts().then(list => list.join(" | ")))}`); }
    await expect(sp.locator(".builder-save-state")).toContainText("Saved", { timeout: 30000 });
    const builderShot = await shot(sp, "13a-builder");
    const slug = `karim-nassar-${run}`;
    await sp.getByRole("button", { name: "Publish website", exact: true }).click();
    const panel = sp.getByRole("region", { name: "Publish your portfolio website" });
    await panel.getByLabel("Web address").fill(slug);
    await panel.getByRole("button", { name: "Publish website", exact: true }).click();
    await expect(panel.getByRole("heading", { name: "Your portfolio is live" })).toBeVisible({ timeout: 30000 });
    const visitor = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
    const v = await visitor.newPage();
    await v.goto(`/u/${slug}`);
    await expect(v.locator(".pb, .published-site").first()).toBeVisible({ timeout: 30000 });
    const text = await v.locator("body").innerText();
    if (!/Karim Nassar/i.test(text)) throw new Error("The published site does not show Karim Nassar");
    if (/sara|khoury/i.test(text)) throw new Error("The published site still shows the builder's sample person");
    const site = await shot(v, "13b-published-site");
    await visitor.close();
    return { actual: `Published at ${baseURL}/u/${slug}`, shots: [builderShot, site] };
  });

  await step("TC-14", "Public page of checked facts", "Turned on by the student, it shows only checked facts to anyone with the link", async () => {
    await sp.goto("/account/verification");
    const panel = sp.locator(".trust-share");
    await panel.getByRole("switch").click();
    await expect(panel.getByRole("switch")).toHaveAttribute("aria-checked", "true", { timeout: 20000 });
    const link = await panel.locator("#trust-link").inputValue();
    const visitor = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } });
    const v = await visitor.newPage();
    await v.goto(new URL(link).pathname);
    await expect(v.getByRole("heading", { level: 1 })).toHaveText("Karim Nassar", { timeout: 20000 });
    const facts = clean(await v.locator("main").innerText()).slice(0, 220);
    const page = await shot(v, "14-checked-facts", { fullPage: true });
    await visitor.close();
    return { actual: `${new URL(link).pathname}: ${facts}`, shots: [page] };
  });

  await step("TC-15", "Overview: the whole journey at a glance", "The constellation shows checked stars and the path shows progress", async () => {
    await sp.goto("/dashboard");
    await sp.waitForTimeout(3500);
    const legend = clean(await sp.locator(".constellation-legend").innerText());
    const path = clean(await sp.locator("h1").first().innerText());
    const dark = await shot(sp, "15a-overview-dark");
    await sp.evaluate(() => localStorage.setItem("careerforge-theme", "light"));
    await sp.reload(); await sp.waitForTimeout(3000);
    const light = await shot(sp, "15b-overview-light");
    await sp.evaluate(() => localStorage.setItem("careerforge-theme", "dark"));
    const phone = await signIn(student, { width: 390, height: 844 });
    await phone.page.goto("/dashboard"); await phone.page.waitForTimeout(3000);
    const phoneShot = await shot(phone.page, "15c-overview-phone");
    await phone.context.close();
    return { actual: `${path} Legend: ${legend}`, shots: [dark, light, phoneShot] };
  });
} catch (error) {
  results.push({ id: "SETUP", title: "Showcase setup", expected: "Runs on development", actual: String(error?.message ?? error).slice(0, 200), status: "FAIL", seconds: 0, shots: [] });
  console.log("SETUP FAIL:", error?.message ?? error);
} finally {
  const passed = results.filter(result => result.status === "PASS").length;
  const report = { run, when: new Date().toISOString(), baseURL, student: { name: student.name, email: student.email }, passed, total: results.length, results };
  await mkdir(out, { recursive: true });
  await writeFile(`${out}/results.json`, JSON.stringify(report, null, 2));
  if (credentialsFile) await writeFile(credentialsFile, `CareerForge demo accounts on DEVELOPMENT (${baseURL}), created ${report.when}. Fictional people. Keep private.\n\n` +
    [student, reviewer, trainer].map(user => `${user.name} (${user.role === "admin" ? "reviewer/admin" : user === trainer ? "trainer" : "student"})\n  Email: ${user.email}\n  Password: ${user.password}\n`).join("\n"));
  console.log(`\n${passed}/${results.length} test cases passed. Report: ${out}/results.json`);
  await browser?.close().catch(() => {});
  await db.end().catch(() => {});
}
