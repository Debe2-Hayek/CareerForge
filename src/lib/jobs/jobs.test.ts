import assert from "node:assert/strict";
import { test } from "node:test";
import { boundedFetchJson, SourceError } from "./fetch";
import { collectLiveJobs, recheckHimalayas, writeLiveJobs, type Queryable, type SourceResult } from "./ingest";
import { detectSkills, htmlToText, inferExperience, lebanonRestriction, liveJobId, nationalityRestriction, requiredYears, regionOfPlace, regionOfRestrictions, safeHttpsUrl, salaryText } from "./normalize";
import { parseGreenhouse, parseHimalayas, parseWorkable } from "./sources";

const himalayasJob = {
  title: "Junior React Developer", companyName: "Acme Remote", guid: "https://himalayas.app/companies/acme/jobs/junior-react",
  applicationLink: "https://himalayas.app/companies/acme/jobs/junior-react?utm_source=api", employmentType: "Full Time",
  seniority: ["Entry-level"], locationRestrictions: [], categories: ["Frontend-Developer"],
  description: "<p>Build UIs with <b>React</b> &amp; TypeScript.</p><script>alert(1)</script><ul><li>Git</li></ul>",
  minSalary: 30000, maxSalary: 45000, currency: "USD", salaryPeriod: "annual", pubDate: 1795093216, expiryDate: 1800033680
};

test("Himalayas listings become plain-text, attributed, deduplicable rows", () => {
  const { jobs, skipped } = parseHimalayas({ jobs: [himalayasJob], totalCount: 1 });
  assert.equal(skipped, 0);
  const [job] = jobs;
  assert.equal(job.id, liveJobId("himalayas", himalayasJob.guid));
  assert.equal(job.applyUrl, himalayasJob.applicationLink, "Apply must use the unchanged applicationLink");
  assert.equal(job.region, "worldwide");
  assert.equal(job.location, "Remote · Worldwide");
  assert.equal(job.employmentType, "Full-time");
  assert.equal(job.description, "Build UIs with React & TypeScript. • Git");
  assert.ok(!job.description.includes("<") && !job.description.includes("alert"));
  assert.deepEqual(job.skills, ["TypeScript", "React", "Git"]);
  assert.equal(job.salaryText, "USD 30,000–45,000 / year");
  assert.equal(job.expiresAt?.toISOString(), new Date(1800033680 * 1000).toISOString());
});

test("malformed or unsafe items are skipped without failing the page; malformed pages fail", () => {
  const result = parseHimalayas({ jobs: [himalayasJob, { title: "No company" }, { ...himalayasJob, guid: "javascript:alert(1)" }, { ...himalayasJob, applicationLink: "https://evil.example/apply" }] });
  assert.equal(result.jobs.length, 1);
  assert.equal(result.skipped, 3);
  assert.throws(() => parseHimalayas({ results: [] }));
  assert.throws(() => parseHimalayas("<html>"));
});

test("regions: Lebanon, MENA, worldwide and wider remote eligibility", () => {
  assert.equal(regionOfPlace("Beirut, Lebanon"), "lebanon");
  assert.equal(regionOfPlace("Riyadh Saudi Arabia, Dubai United Arab Emirates"), "mena");
  assert.equal(regionOfPlace("Sharjah"), "mena");
  assert.equal(regionOfPlace("Karachi, Pakistan"), null);
  assert.equal(regionOfRestrictions([]), "worldwide");
  assert.equal(regionOfRestrictions(["Lebanon"]), "lebanon");
  assert.equal(regionOfRestrictions(["Lebanon", "Jordan", "United Arab Emirates"]), "mena");
  assert.equal(regionOfRestrictions(["Lebanon", "Germany", "France"]), "international");
});

test("Greenhouse keeps only regional roles, decodes double-encoded HTML and ignores metadata", () => {
  const payload = { jobs: [
    { id: 1, title: "Backend Engineer", absolute_url: "https://job-boards.eu.greenhouse.io/tamara/jobs/1", company_name: "Tamara",
      location: { name: "Riyadh, Saudi Arabia" }, content: "&lt;p&gt;We use &lt;strong&gt;Python&lt;/strong&gt; and Kubernetes.&lt;/p&gt;",
      metadata: [{ name: "Hiring Manager", value: "person@example.com" }], first_published: "2026-10-15T04:40:52-04:00" },
    { id: 2, title: "Analyst", absolute_url: "https://boards.greenhouse.io/x/jobs/2", location: { name: "Karachi, Pakistan" } },
    { id: 3, title: "Off-host", absolute_url: "https://careers.example.com/3", location: { name: "Dubai" } }
  ] };
  const { jobs, skipped } = parseGreenhouse("tamara", payload);
  assert.equal(jobs.length, 1);
  assert.equal(skipped, 1);
  assert.equal(jobs[0].region, "mena");
  assert.equal(jobs[0].description, "We use Python and Kubernetes.");
  assert.deepEqual(jobs[0].skills, ["Python", "Kubernetes"]);
  assert.ok(!JSON.stringify(jobs[0]).includes("person@example.com"));
});

test("Workable keeps Lebanon roles with their own apply link", () => {
  const { jobs } = parseWorkable("valsoft-corp", { name: "Valsoft Corporation", jobs: [
    { shortcode: "8E38620B86", title: "AI Developer", url: "https://apply.workable.com/j/8E38620B86", application_url: "https://apply.workable.com/j/8E38620B86/apply",
      employment_type: "Full-time", telecommuting: false, department: "Aspire Software Lebanon", function: "Engineering", experience: "Mid-Senior level",
      published_on: "2026-10-19", locations: [{ country: "Lebanon", city: "Beirut" }] },
    { shortcode: "AAAA1111", title: "Remote PM", url: "https://apply.workable.com/j/AAAA1111", locations: [{ country: "Canada", city: "Toronto" }] }
  ] });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].region, "lebanon");
  assert.equal(jobs[0].location, "Beirut, Lebanon");
  assert.equal(jobs[0].company, "Valsoft Corporation");
  assert.equal(jobs[0].applyUrl, "https://apply.workable.com/j/8E38620B86/apply");
  assert.match(jobs[0].description, /Department: Aspire Software Lebanon\./);
});

test("skill detection matches whole words only", () => {
  assert.deepEqual(detectSkills("JavaScript and Java with excellent communication; React Native app"), ["JavaScript", "React Native", "Java"]);
  assert.deepEqual(detectSkills("Spring 2027 cohort, go-getter attitude"), []);
  assert.deepEqual(detectSkills(""), []);
});

test("URL and text guards", () => {
  assert.equal(safeHttpsUrl("http://himalayas.app/x", ["himalayas.app"]), null);
  assert.equal(safeHttpsUrl("https://himalayas.app.evil.com/x", ["himalayas.app"]), null);
  assert.equal(safeHttpsUrl("https://user:pw@himalayas.app/x", ["himalayas.app"]), null);
  assert.equal(safeHttpsUrl("https://cdn.himalayas.app/x", ["himalayas.app"]), "https://cdn.himalayas.app/x");
  assert.ok(htmlToText(`<p>${"word ".repeat(400)}</p>`, 100).length <= 100);
  assert.equal(salaryText(null, 0, "USD", "year"), null);
});

function response(body: string, init: ResponseInit = {}) {
  return new Response(body, { status: 200, headers: { "content-type": "application/json" }, ...init });
}

test("bounded fetch refuses other hosts, oversize bodies, non-JSON and reports rate limits", async () => {
  const ok = boundedFetchJson(["himalayas.app"], { fetchImpl: async () => response('{"jobs":[]}') });
  assert.deepEqual(await ok("https://himalayas.app/jobs/api"), { jobs: [] });
  await assert.rejects(ok("https://169.254.169.254/latest"), (e: unknown) => e instanceof SourceError && e.code === "HOST_NOT_ALLOWED");
  await assert.rejects(ok("http://himalayas.app/jobs/api"), (e: unknown) => e instanceof SourceError && e.code === "HOST_NOT_ALLOWED");
  const big = boundedFetchJson(["himalayas.app"], { maxBytes: 10, fetchImpl: async () => response(JSON.stringify({ jobs: ["x".repeat(50)] })) });
  await assert.rejects(big("https://himalayas.app/a"), (e: unknown) => e instanceof SourceError && e.code === "TOO_LARGE");
  const html = boundedFetchJson(["himalayas.app"], { fetchImpl: async () => response("<html>", { headers: { "content-type": "text/html" } }) });
  await assert.rejects(html("https://himalayas.app/a"), (e: unknown) => e instanceof SourceError && e.code === "NOT_JSON");
  const limited = boundedFetchJson(["himalayas.app"], { fetchImpl: async () => response("{}", { status: 429, headers: { "retry-after": "30", "content-type": "application/json" } }) });
  await assert.rejects(limited("https://himalayas.app/a"), (e: unknown) => e instanceof SourceError && e.code === "RATE_LIMITED" && e.retryAfterSeconds === 30);
  let options: RequestInit | undefined;
  await boundedFetchJson(["himalayas.app"], { fetchImpl: async (_url, init) => { options = init; return response("{}"); } })("https://himalayas.app/a");
  assert.equal(options?.redirect, "error");
});

test("collection deduplicates overlapping pages, isolates failing sources and never fabricates jobs", async () => {
  const calls: string[] = [];
  const results = await collectLiveJobs({
    himalayasKey: "test-key", pause: async () => {},
    fetchers: {
      himalayas: async (url, headers) => { calls.push(url); assert.equal(headers?.Authorization, "Bearer test-key"); return { jobs: url.includes("page=1") ? [himalayasJob] : [] }; },
      greenhouse: async () => { throw new SourceError("RATE_LIMITED", "slow down", 60); },
      workable: async () => ({ name: "Valsoft", jobs: [] })
    }
  });
  const himalayas = results.find(r => r.source === "himalayas")!;
  assert.equal(himalayas.jobs.length, 1, "duplicate guid across queries is stored once");
  assert.ok(calls.every(url => url.startsWith("https://himalayas.app/jobs/api/search?") && url.includes("country=LB")));
  const greenhouse = results.filter(r => r.source === "greenhouse");
  assert.ok(greenhouse.length > 0 && greenhouse.every(r => !r.ok && !r.complete && !r.jobs.length && r.error?.startsWith("RATE_LIMITED")));
  assert.ok(results.filter(r => r.source === "workable").every(r => r.ok && r.complete && r.jobs.length === 0));
});

test("writer skips failed sources, closes absent board jobs and rolls back on write errors", async () => {
  const log: string[] = [];
  const db: Queryable = { query: async (sql) => { log.push(sql.trim().split(/\s+/).slice(0, 3).join(" ")); if (sql.includes("insert into") && log.filter(l => l.startsWith("insert")).length === 2) throw Object.assign(new Error("x"), { code: "23514" }); return { rowCount: 0, rows: [] }; } };
  const [job] = parseHimalayas({ jobs: [himalayasJob] }).jobs;
  const summaries = await writeLiveJobs(db, [
    { source: "workable", board: "b", label: "board", complete: true, ok: true, jobs: [{ ...job, source: "workable", sourceBoard: "b" }], skipped: 0, exclusions: [], closeIds: [] },
    { source: "greenhouse", board: "g", label: "failed", complete: false, ok: false, jobs: [], skipped: 0, error: "TIMEOUT: x", exclusions: [], closeIds: [] },
    { source: "himalayas", board: null, label: "partial", complete: false, ok: true, jobs: [job], skipped: 0, exclusions: [], closeIds: [] }
  ], new Date("2026-11-19T00:00:00Z"));
  assert.deepEqual(summaries.map(s => s.error ?? "ok"), ["ok", "TIMEOUT: x", "WRITE_FAILED: 23514"]);
  assert.ok(log.includes("rollback"));
  assert.equal(log.filter(l => l === "begin").length, 2, "failed sources open no transaction");
  assert.ok(log.at(-1)?.startsWith("delete from public.job_postings"));
});

test("ambiguous English words are not detected as skills", () => {
  assert.deepEqual(detectSkills("Provide swift resolution, react quickly to customers and excel at communication."), []);
  assert.deepEqual(detectSkills("Build iOS apps in Swift; dashboards in Microsoft Excel; UI in React."), ["React", "Swift", "Excel"]);
});

// Titles and phrases below mirror real Himalayas listings tagged as open to Lebanon (19 November 2026).
test("experience level follows the title and requested years, not a conflicting source tag", () => {
  assert.deepEqual(inferExperience("Telesales", "Minimum 6 years of experience in telesales.", ["Entry-level"]), { level: "senior", label: "Senior · 6+ years asked" });
  assert.deepEqual(inferExperience("Senior Go Developer (Blockchain & Ledger)", "Join us.", ["Entry-level"]), { level: "senior", label: "Senior" });
  assert.equal(inferExperience("Junior Machine Learning Engineer", "", ["Entry-level"]).level, "entry");
  assert.equal(inferExperience("Full Stack Developer Intern", "3+ years preferred", []).level, "internship");
  assert.equal(inferExperience("Chief Operating Officer (COO)", "", ["Mid-level"]).level, "lead");
  assert.deepEqual(inferExperience("Remote B2B Lead Generation Specialist", "2+ years in outbound", []), { level: "entry", label: "Entry level · 2+ years asked" }, "lead generation is not a lead role");
  assert.equal(inferExperience("CRM Email Marketing Manager", "2+ years with Klaviyo", ["Mid-level"]).level, "mid", "a small years figure never lowers the source level");
  assert.equal(inferExperience("Data Architect (Adobe Analytics)", "1+ years with Adobe", ["Mid-level"]).level, "senior");
  assert.equal(inferExperience("Telesales", "Our branch is top 1 for the past 6 years.", ["Entry-level"]).level, "entry", "company history is not a requirement");
  assert.deepEqual(inferExperience("People Operations Coordinator", "", ["Entry-level", "Mid-level"]), { level: "entry", label: "Entry level to mid level" });
  assert.deepEqual(inferExperience("Analyst", "", []), { level: null, label: null });
  assert.equal(inferExperience("Team Leader, Customer Care", "1+ years in customer care", []).level, "senior");
  assert.equal(inferExperience("AI Engineering Manager - ANJU", "", ["Entry level"]).level, "lead");
  assert.equal(inferExperience("Intermediate Software Developer - Vpay", "", ["Executive"]).level, "mid", "the title outranks a conflicting tag; 'Vpay' is not 'VP'");
  assert.deepEqual(inferExperience("Data Analyst - CLS", "", ["Mid-Senior level"]), { level: "mid", label: "Mid level to senior" });
  assert.equal(requiredYears("Wire IT has 18 years of experience delivering projects."), null, "company history is ignored");
  assert.equal(requiredYears("Requirements: 4-6 years of experience; 2+ years with SQL."), 4);
});

test("remote listings restricted to other countries are detected; Lebanon-compatible ones are kept", () => {
  for (const [title, text] of [
    ["Web Developer: WordPress & HubSpot (U.S. Based, Remote Contractor)", ""],
    ["Video Data Entry Specialist (LATAM)", ""],
    ["Senior Manager (m/f/d) - EHS (Calw, BW, DE, 64625)", ""],
    ["Legal Expert (Copyright Law)", "This engagement is tailored for US-based copyright attorneys with a passion for AI."],
    ["Legal Expert (Property Law)", "This unique engagement seeks US-based property lawyers to review data."],
    ["At-Home Video Recorder", "Location: Remote - experts based in Latin America and the Caribbean."],
    ["AI Agent Tester", "Who we’re looking for Based in Europe, with a bachelor’s degree."],
    ["Support Agent", "Candidates must be located in the United States."],
    ["Engineer", "You must be authorized to work in the US without sponsorship."],
    ["Analyst", "This role requires US citizenship and an active security clearance."],
    ["Writer", "Open to UK residents only (UK only)."],
    ["Tutor", "This position is open only to residents of the United States."],
    ["Agent", "Applicants must be a citizen of Canada."],
    ["Technical Analyst – External Data Transfer", "Client: Global Pharmaceutical Company in Prague • Location: Remote within Europe • Start: ASAP"],
    ["AI Agent Tester", "Role Type: Contractor Location: Remote — Europe Opportunity Snapshot"],
    ["AI Agent Tester", "Who we’re looking for • Based in Europe, with a bachelor’s degree"],
    ["Creative Strategist", "Location Remote. US, Europe or Latin America, with a working day that overlaps US Eastern hours."],
    ["Veterans Legal and Human Rights Expert", "Location: Remote micro1 is engaging U.S. military veterans with expertise in military law."],
    ["Reservation and Sales Coordinator", "A home-based position operating remotely within the Asia time zone, ideally located in Southeast Asia."],
    ["Customer Support Agent (Spanish & English) - Europe", ""]
  ]) assert.ok(lebanonRestriction(title, text), `expected a restriction for: ${title} ${text}`);
  for (const [title, text] of [
    ["Hands-on Engineering Manager DevOps (GCP/Kubernetes)", "Miaplaza is a US-based education company, which means we do things differently."],
    ["Talent Acquisition Specialist", "You can work from home and be located anywhere in the UK or EMEA region."],
    ["Data Architect (Adobe Campaign Classic to Adobe Journey Optimizer) (EMEA Only)", ""],
    ["Senior Go Developer", "Remote-first company: work from anywhere in the world."],
    ["Manager, EMEA Support", "You are based in EMEA, with the flexibility to work across time zones."],
    ["Customer Support", "Let us know how we can help us grow; tell us about yourself."],
    ["Junior Performance Marketing Specialist", "Benefits • Fully remote working arrangement from Europe or Asia."],
    ["Senior Cloud Engineer (SA)", "Location: Middle East / Africa | Travel: Regional & International"],
    ["Paid Media Operator", "At least 3 hours a day overlapping 1pm to 6pm UK time, and some overlap with US Eastern time."],
    ["Design Engineer", "If you are applying as a resident of California, please read our CCPA notice. If you are applying as a resident of the EU, please read our GDPR notice here."]
  ]) assert.equal(lebanonRestriction(title, text), null, `unexpected restriction for: ${title} ${text}`);
  assert.ok(lebanonRestriction("Role", "", [-8, -7, -6, -5]), "time zones excluding UTC+2/+3");
  assert.equal(lebanonRestriction("Role", "", [-10, 0, 2, 3]), null);
});

test("Himalayas parsing excludes restricted listings and labels the inferred level", () => {
  const usOnly = { ...himalayasJob, guid: "https://himalayas.app/companies/acme/jobs/us-only", title: "Legal Expert", description: "<p>Ideal for US-based attorneys.</p>" };
  const result = parseHimalayas({ jobs: [himalayasJob, usOnly] });
  assert.equal(result.jobs.length, 1);
  assert.deepEqual(result.exclusions.map(item => item.externalId), [usOnly.guid]);
  assert.equal(result.jobs[0].experienceLevel, "entry");
  assert.equal(result.jobs[0].seniority, "Entry level");
});

test("stored Himalayas jobs missing from recent pages are rechecked; only confirmed removals close", async () => {
  const guid = (slug: string) => `https://himalayas.app/companies/acme/jobs/${slug}`;
  const stored = ["still", "gone", "restricted", "busy", "unknown"].map(slug => ({ externalId: guid(slug), title: `🌍 Role ${slug}` }));
  const urls: string[] = [];
  const fetchJson = async (url: string) => {
    urls.push(url);
    const q = new URL(url).searchParams.get("q") ?? "";
    if (q.endsWith("still")) return { totalCount: 1, jobs: [{ ...himalayasJob, guid: guid("still"), title: "Role still" }] };
    if (q.endsWith("gone")) return { totalCount: 1, jobs: [{ ...himalayasJob, guid: guid("other"), title: "Other" }] };
    if (q.endsWith("restricted")) return { totalCount: 1, jobs: [{ ...himalayasJob, guid: guid("restricted"), title: "Role (USA only)" }] };
    if (q.endsWith("busy")) return { totalCount: 80, jobs: [{ ...himalayasJob, guid: guid("x1") }] };
    throw new SourceError("RATE_LIMITED", "429");
  };
  const result: SourceResult = { source: "himalayas", board: null, label: "h", complete: false, ok: true, jobs: [], skipped: 0, exclusions: [], closeIds: [] };
  await recheckHimalayas(result, stored, { fetchers: { himalayas: fetchJson }, pause: async () => {} });
  assert.deepEqual(result.recheck, { still: 1, gone: 1, excluded: 1, inconclusive: 2 });
  assert.deepEqual(result.jobs.map(job => job.externalId), [guid("still")]);
  assert.deepEqual(result.closeIds.sort(), [guid("gone"), guid("restricted")]);
  assert.match(result.error ?? "", /recheck stopped/);
  assert.equal(new URL(urls[0]).searchParams.get("company"), "acme");
  assert.equal(new URL(urls[0]).searchParams.get("q"), "Role still", "emoji are stripped from the search");
});

test("writer closes confirmed removals and exclusions for partial sources", async () => {
  const calls: { sql: string; params?: unknown[] }[] = [];
  const db: Queryable = { query: async (sql, params) => { calls.push({ sql, params }); return { rowCount: 1, rows: [] }; } };
  await writeLiveJobs(db, [{ source: "himalayas", board: null, label: "h", complete: false, ok: true, jobs: [], skipped: 0,
    exclusions: [{ externalId: "https://himalayas.app/companies/a/jobs/x", reason: "r" }], closeIds: ["https://himalayas.app/companies/a/jobs/y"] }], new Date("2026-11-19T00:00:00Z"));
  const close = calls.find(call => call.sql.includes("external_id = any"));
  assert.deepEqual(close?.params?.[2], ["https://himalayas.app/companies/a/jobs/y", "https://himalayas.app/companies/a/jobs/x"]);
});

test("roles reserved for other nationalities are excluded from employer boards", () => {
  assert.ok(nationalityRestriction("Government Compliance Advisor (Emirati National)", ""));
  assert.ok(nationalityRestriction("Associate Data Scientist - Builders Program - (Emirati National)", ""));
  assert.ok(nationalityRestriction("Compliance Officer", "This role is open only to UAE nationals."));
  assert.equal(nationalityRestriction("Compliance Officer", "We support Emiratization and welcome all applicants, including UAE nationals and expats."), null);
  const board = { jobs: [
    { id: 1, title: "Government Compliance Advisor (Emirati National)", absolute_url: "https://job-boards.greenhouse.io/tamara/jobs/1", location: { name: "Dubai, UAE" } },
    { id: 2, title: "Copy Writer", absolute_url: "https://job-boards.greenhouse.io/tamara/jobs/2", location: { name: "Riyadh, Saudi Arabia" } }
  ] };
  const parsed = parseGreenhouse("tamara", board);
  assert.deepEqual(parsed.jobs.map(job => job.title), ["Copy Writer"]);
  assert.deepEqual(parsed.exclusions.map(item => item.externalId), ["tamara:1"]);
});
