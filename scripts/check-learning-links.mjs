// Verifies every learning resource URL still resolves (HTTP 2xx after redirects)
// and reports permanent moves so content can be updated to the canonical URL.
// Network-only and read-only: run before publishing curriculum changes.
//   npm run check:learning-links

import { courses } from "../src/lib/learning/catalog.ts";

const userAgent = "Mozilla/5.0 (compatible; CareerForge-link-check/1.0)";
const urls = new Map();
for (const course of courses) {
  if (course.roadmapSh) urls.set(course.roadmapSh.url, `${course.id} (roadmap.sh)`);
  for (const topic of course.topics) for (const resource of topic.resources) {
    const key = resource.url.split("#")[0];
    if (!urls.has(key)) urls.set(key, `${course.id}/${topic.id}`);
  }
}

async function check(url) {
  for (const method of ["HEAD", "GET"]) {
    try {
      const response = await fetch(url, { method, redirect: "follow", headers: { "User-Agent": userAgent, Accept: "text/html,*/*" }, signal: AbortSignal.timeout(20000) });
      if (response.ok) return { ok: true, status: response.status, final: response.url };
      if (method === "GET") return { ok: false, status: response.status, final: response.url };
    } catch (error) {
      if (method === "GET") return { ok: false, status: error.name === "TimeoutError" ? "timeout" : "error", final: url };
    }
  }
}

const results = [];
const queue = [...urls.entries()];
await Promise.all(Array.from({ length: 8 }, async () => {
  for (let item = queue.shift(); item; item = queue.shift()) {
    const [url, where] = item;
    results.push({ url, where, ...(await check(url)) });
  }
}));

const broken = results.filter(result => !result.ok);
const moved = results.filter(result => result.ok && result.final.replace(/\/$/, "") !== result.url.replace(/\/$/, ""));
for (const result of broken) console.log(`BROKEN ${result.status} ${result.url} (${result.where})`);
for (const result of moved) console.log(`MOVED  ${result.url} -> ${result.final} (${result.where})`);
console.log(`${results.length - broken.length}/${results.length} learning resource URLs resolved; ${moved.length} redirect.`);
process.exitCode = broken.length ? 1 : 0;
