// Imports openly licensed learning catalogues into src/data/open-catalog.
//
//   node scripts/import-open-catalog.mjs [--verify]
//
// Sources (all permit redistribution; attribution is shown in the app):
//   - EbookFoundation/free-programming-books      CC BY 4.0  -> courses.json
//   - codecrafters-io/build-your-own-x            CC0 1.0    -> tutorials.json
//   - practical-tutorials/project-based-learning  MIT        -> tutorials.json
//
// Only titles, authors and links are stored. Entries are untrusted text: they
// are parsed with strict patterns, length-limited and https-only. --verify
// requests every link once and drops those that are definitely gone.
import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "src", "data", "open-catalog");
const raw = "https://raw.githubusercontent.com";
const verify = process.argv.includes("--verify");

async function text(path) {
  const response = await fetch(`${raw}/${path}`, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.text();
}

const clean = value => value
  .replace(/<[^>]*>/g, "")
  .replace(/\\([|#[\]*_])/g, "$1")
  .replace(/:[a-z_]+:/g, "")
  .replace(/[*_`]{1,2}(?=\S)|(?<=\S)[*_`]{1,2}/g, "")
  .replace(/\s+/g, " ")
  .trim();

function safeUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.href.length > 300) return null;
    if (/(^|\.)roadmap\.sh$/.test(url.hostname) || /(^|\.)archive\.org$/.test(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}

// Headings without a useful place in CareerForge's catalogue.
const skippedTopics = new Set(["Index", "0 - MOOC", "APL", "AutoIt", "Ballerina", "Force.com", "AngularJS", "IBM", "Pharo", "Processing", "QB64", "Windows Phone",
  "PLC - Programmable logic controllers", "Verilog / VHDL / SystemVerilog", "Digital Electronics", "Simulink", "Misc", "Fortran", "Objective-C", "IDE and editors", "jQuery"]);

function parseCourses(markdown) {
  const items = [];
  let topic = null;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^#{3,5}\s+(.*)$/.exec(line);
    if (heading) { topic = clean(heading[1]); continue; }
    const entry = /^\s*\*\s+\[((?:\\.|[^\]\\])+)\]\((\S+?)\)(?:\s*-\s*(.*))?/.exec(line);
    if (!entry || !topic || skippedTopics.has(topic)) continue;
    const url = safeUrl(entry[2]);
    const title = clean(entry[1]);
    if (!url || title.length < 3 || title.length > 140) continue;
    const by = entry[3] ? clean(entry[3].replace(/\(:construction:[^)]*\)/g, "")).slice(0, 90) : "";
    items.push({ topic, title, by, url });
  }
  return items;
}

function parseBuildYourOwn(markdown) {
  const items = [];
  let topic = null;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^#{2,4}\s+(.*)$/.exec(line);
    if (heading) { const name = /Build your own `(.+?)`/.exec(heading[1]); topic = name ? clean(name[1]) : null; continue; }
    const entry = /^\*\s+\[\*\*(.+?)\*\*:\s*_(.+?)_\]\((\S+?)\)/.exec(line);
    if (!entry || !topic) continue;
    const url = safeUrl(entry[3]);
    const title = clean(entry[2]);
    if (!url || title.length > 140) continue;
    items.push({ group: topic, tech: clean(entry[1]).slice(0, 40), title, url, source: "byox" });
  }
  return items;
}

function parseProjectBased(markdown) {
  const items = [];
  let language = null, group = null;
  for (const line of markdown.split(/\r?\n/)) {
    const top = /^##\s+(.*?):?\s*$/.exec(line);
    if (top) { language = clean(top[1]).replace(/:$/, ""); group = null; continue; }
    const sub = /^#{3,4}\s+(.*?):?\s*$/.exec(line);
    if (sub) { group = clean(sub[1]).replace(/:$/, ""); continue; }
    if (!language || /^(Table of Contents|Additional Resources)$/.test(language)) continue;
    const entry = /^\s*[-*]\s+\[([^\]]+)\]\((\S+?)\)/.exec(line);
    // Multi-part series list "Part 2: ..." links: keep only whole tutorials.
    if (!entry || /^part\s*\d/i.test(entry[1])) continue;
    const url = safeUrl(entry[2]);
    const title = clean(entry[1]);
    if (!url || title.length < 6 || title.length > 140) continue;
    items.push({ group: group ?? language, tech: language.slice(0, 40), title, url, source: "pbl" });
  }
  return items;
}

// The same course can be listed under several topics: the first one wins.
const dedupe = items => [...new Map([...items].reverse().map(item => [item.url.replace(/\/$/, ""), item])).values()].reverse();

async function alive(url) {
  for (const method of ["HEAD", "GET"]) {
    try {
      const response = await fetch(url, { method, redirect: "follow", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "Mozilla/5.0 (link check)" } });
      await response.body?.cancel();
      if (response.ok) return true;
      if (method === "GET") return ![404, 410, 500, 502, 503, 521, 522, 523, 530].includes(response.status);
    } catch (error) {
      if (method === "GET") return error.name === "TimeoutError" ? false : false;
    }
  }
  return false;
}

async function keepAlive(items, label) {
  if (!verify) return items;
  const kept = new Array(items.length).fill(false);
  let cursor = 0;
  await Promise.all(Array.from({ length: 24 }, async () => {
    while (cursor < items.length) { const index = cursor++; kept[index] = await alive(items[index].url); }
  }));
  const result = items.filter((_, index) => kept[index]);
  console.log(`${label}: ${result.length}/${items.length} links alive`);
  return result;
}

const courses = await keepAlive(dedupe(parseCourses(await text("EbookFoundation/free-programming-books/main/courses/free-courses-en.md"))), "courses");
const tutorials = await keepAlive(dedupe([
  ...parseBuildYourOwn(await text("codecrafters-io/build-your-own-x/master/README.md")),
  ...parseProjectBased(await text("practical-tutorials/project-based-learning/master/README.md"))
]), "tutorials");

// A changed upstream format must not silently empty the catalogue.
if (courses.length < 800 || tutorials.length < 250) throw new Error(`Implausible import: ${courses.length} courses, ${tutorials.length} tutorials`);

const importedAt = new Date().toISOString().slice(0, 10);
const lines = items => `[\n${items.map(item => `  ${JSON.stringify(item)}`).join(",\n")}\n]`;
await writeFile(join(output, "courses.json"), `{"importedAt":"${importedAt}","items":${lines(courses)}}\n`);
await writeFile(join(output, "tutorials.json"), `{"importedAt":"${importedAt}","items":${lines(tutorials)}}\n`);
console.log(`Wrote ${courses.length} courses and ${tutorials.length} tutorials.`);
