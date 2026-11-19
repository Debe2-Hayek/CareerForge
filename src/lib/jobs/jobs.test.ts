import assert from "node:assert/strict";
import { test } from "node:test";
import { boundedFetchJson, SourceError } from "./fetch";
import { collectLiveJobs, writeLiveJobs, type Queryable } from "./ingest";
import { detectSkills, htmlToText, liveJobId, regionOfPlace, regionOfRestrictions, safeHttpsUrl, salaryText } from "./normalize";
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
    { source: "workable", board: "b", label: "board", complete: true, ok: true, jobs: [{ ...job, source: "workable", sourceBoard: "b" }], skipped: 0 },
    { source: "greenhouse", board: "g", label: "failed", complete: false, ok: false, jobs: [], skipped: 0, error: "TIMEOUT: x" },
    { source: "himalayas", board: null, label: "partial", complete: false, ok: true, jobs: [job], skipped: 0 }
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
