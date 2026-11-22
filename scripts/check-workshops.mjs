// Keeps the hand-checked workshops honest. Read-only.
//   npm run check:workshops [-- --report file.md]
// Fails when a link is gone or a live session's published date no longer matches,
// and warns before the list of upcoming sessions runs out. --report writes what a
// person has to do (an empty file when there is nothing to do).
import { writeFile } from "node:fs/promises";
import { curatedWorkshops } from "../src/data/workshops/curated.ts";
import { createWorkshopService } from "../src/lib/workshops/service.ts";
import { lifecycleOf } from "../src/lib/workshops/lifecycle.ts";
import { workshopCategories } from "../src/lib/workshops/types.ts";

const now = Date.now();
const headers = { "User-Agent": "Mozilla/5.0 (compatible; CareerForge-workshop-check/1.0)", "Accept-Language": "en" };
const problems = [], warnings = [], unchecked = [];
// Failures that say something about the site itself, not about where this check runs.
const dead = new Set([404, 410, "ENOTFOUND", "CERT_HAS_EXPIRED"]);

async function page(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(25_000) });
      return { status: response.status, text: await response.text() };
    } catch (error) {
      if (attempt === 3) return { status: error.cause?.code ?? error.name, text: "" };
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
}

/** How Microsoft Reactor prints a session: "December 9, 2026" and "5:00 - 6:00 PM (UTC)". */
function reactorDate(workshop) {
  const start = new Date(workshop.startDateTime), end = new Date(start.getTime() + workshop.durationMinutes * 60_000);
  const day = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" }).format(start);
  const clock = date => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit" }).format(date).replace(/\s/g, " ");
  const [from, fromHalf] = clock(start).split(" "), [to, toHalf] = clock(end).split(" ");
  return { day, times: fromHalf === toHalf ? `${from} - ${to} ${toHalf} (UTC)` : `${from} ${fromHalf} - ${to} ${toHalf} (UTC)` };
}

for (const workshop of curatedWorkshops) {
  const state = lifecycleOf(workshop, now);
  if (state === "ended") { warnings.push(`${workshop.id} has ended: add its recording or replace it`); continue; }
  const { status, text } = await page(workshop.registrationOrWatchUrl);
  if (dead.has(status)) problems.push(`${workshop.id}: ${status} ${workshop.registrationOrWatchUrl}`);
  // Some sites refuse GitHub's servers. A refusal, time-out or outage is not proof that a link is dead.
  else if (status !== 200) unchecked.push(`${workshop.id}: ${status} ${workshop.registrationOrWatchUrl}`);
  else if (workshop.sourceId?.startsWith("reactor:")) {
    const visible = text.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
    const { day, times } = reactorDate(workshop);
    if (!visible.includes(day) || !visible.includes(times)) problems.push(`${workshop.id}: the page no longer shows ${day}, ${times}`);
    if (!visible.includes(workshop.title)) problems.push(`${workshop.id}: the page no longer shows the title`);
  }
}

const catalog = await createWorkshopService({ log: () => {} }).catalog();
for (const source of catalog.sources) {
  console.log(`${source.label}: ${source.state}, ${source.count} workshops, ${source.rejected} rejected`);
  if (source.state === "failed") warnings.push(`${source.label} could not be read`);
}
const upcoming = catalog.workshops.filter(workshop => ["upcoming", "live"].includes(lifecycleOf(workshop, now)));
for (const category of workshopCategories) {
  const count = upcoming.filter(workshop => workshop.category === category).length;
  console.log(`${category}: ${count} upcoming live`);
}
const handPicked = upcoming.filter(workshop => workshop.sourceType === "curated").length;
if (handPicked < 3) warnings.push(`only ${handPicked} hand-checked live sessions are upcoming: add some`);
if (upcoming.length < 4) warnings.push(`only ${upcoming.length} live sessions are upcoming`);
// One or two refusals are normal; many at once mean the check is no longer checking.
if (unchecked.length >= 6) warnings.push(`${unchecked.length} pages could not be opened: ${unchecked.join("; ")}`);
for (const item of unchecked) console.log("SKIP ", item);
for (const warning of warnings) console.log("WARN ", warning);
for (const problem of problems) console.log("ERROR", problem);
console.log(`${curatedWorkshops.length} curated workshops checked: ${problems.length} problems, ${warnings.length} warnings, ${unchecked.length} could not be opened.`);
const at = process.argv.indexOf("--report");
if (at > 0 && process.argv[at + 1]) {
  const list = (title, items) => items.length ? `### ${title}\n\n${items.map(item => `- ${item}`).join("\n")}\n\n` : "";
  const body = problems.length + warnings.length === 0 ? "" : `${list("Fix", problems)}${list("Look at", warnings)}### How

1. Find replacements on the organisers' own pages, for example [Microsoft Reactor events](https://developer.microsoft.com/reactor/) or [DataTalks.Club events](https://datatalks.club/events.html).
2. Open each event page and check that it is free, online, and what time it starts in UTC.
3. Edit \`src/data/workshops/curated.ts\` and open a pull request.

Ended sessions are already hidden from learners. This issue closes itself when the weekly check is clean.
`;
  await writeFile(process.argv[at + 1], body);
}
process.exitCode = problems.length ? 1 : 0;
