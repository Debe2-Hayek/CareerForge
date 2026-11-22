// Verifies every learning resource URL still resolves (HTTP 2xx after redirects)
// and reports permanent moves so content can be updated to the canonical URL.
// Network-only and read-only: run before publishing curriculum changes.
//   npm run check:learning-links [-- roadmap-id ...]
// roadmap.sh links are skipped: its terms ask not to be accessed automatically.

import { roadmaps } from "../src/lib/roadmaps/catalog.ts";

const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 CareerForge-link-check";
const only = new Set(process.argv.slice(2));
const urls = new Map();
for (const roadmap of roadmaps) {
  if (only.size && !only.has(roadmap.id)) continue;
  for (const topic of roadmap.sections.flatMap(section => section.topics)) for (const resource of topic.resources) {
    const key = resource.url.split("#")[0];
    if (new URL(key).hostname === "roadmap.sh") continue;
    if (!urls.has(key)) urls.set(key, `${roadmap.id}/${topic.id}`);
  }
}

// These publishers answer automated requests with a block page or rate limit
// although the pages work in a browser; report them separately, not as broken.
const blocked = status => [401, 403, 406, 418, 429, 999].includes(status);

// Network blips and rate limits are retried before a link is called broken.
async function check(url) {
  for (let attempt = 1; ; attempt++) {
    const result = await checkOnce(url);
    if (result.ok || attempt === 3 || typeof result.status === "number") return result;
    await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
  }
}

async function checkOnce(url) {
  for (const method of ["HEAD", "GET"]) {
    try {
      const response = await fetch(url, { method, redirect: "follow", headers: { "User-Agent": userAgent, Accept: "text/html,*/*" }, signal: AbortSignal.timeout(25000) });
      await response.body?.cancel();
      if (response.ok) return { ok: true, status: response.status, final: response.url };
      if (method === "GET") return { ok: false, status: response.status, final: response.url };
    } catch (error) {
      if (method === "GET") return { ok: false, status: error.name === "TimeoutError" ? "timeout" : "error", final: url };
    }
  }
}

// One host at a time keeps the check polite; different hosts run in parallel.
const byHost = new Map();
for (const item of urls) {
  const host = new URL(item[0]).hostname;
  byHost.set(host, [...(byHost.get(host) ?? []), item]);
}
const results = [];
await Promise.all([...byHost.values()].map(async items => {
  const queue = [...items];
  await Promise.all(Array.from({ length: 2 }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) results.push({ url: item[0], where: item[1], ...(await check(item[0])) });
  }));
}));

const unverified = results.filter(result => !result.ok && blocked(result.status));
const broken = results.filter(result => !result.ok && !blocked(result.status));
const moved = results.filter(result => result.ok && result.final.replace(/\/$/, "") !== result.url.replace(/\/$/, ""));
for (const result of broken) console.log(`BROKEN ${result.status} ${result.url} (${result.where})`);
for (const result of unverified) console.log(`BLOCKED ${result.status} ${result.url} (${result.where})`);
if (process.env.SHOW_MOVED) for (const result of moved) console.log(`MOVED  ${result.url} -> ${result.final} (${result.where})`);
console.log(`${results.length - broken.length - unverified.length}/${results.length} learning resource URLs resolved; ${unverified.length} refuse automated checks; ${broken.length} broken; ${moved.length} redirect.`);
process.exitCode = broken.length ? 1 : 0;
