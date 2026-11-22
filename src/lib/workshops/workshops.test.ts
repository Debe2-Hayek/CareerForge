import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import { test } from "node:test";
import { curatedWorkshops } from "@/data/workshops/curated";
import { pictureFor, pictures, topicPicture, type PictureKey } from "@/data/workshops/pictures";
import { SourceError } from "@/lib/jobs/fetch";
import { getRoadmap } from "@/lib/roadmaps/catalog";
import { parseDeviceData } from "@/components/workshops/device-store";
import { classify, workshopsFromIcal, workshopsFromJson, type IcalSource } from "./adapters";
import { canAddToCalendar, foldLine, googleCalendarUrl, icsFor } from "./calendar";
import { activeFilterCount, availableSavedCount, canonicalUrl, defaultFilters, discover, identityOf, mergeWorkshops, sortWorkshops, spotlight, type DiscoveryFilters } from "./discovery";
import { workshopHandlers, WorkshopError, type WorkshopAccess } from "./handlers";
import { parseIcal, parseIcalTime } from "./ical";
import { callToAction, countdownTo, endOf, formatDuration, isAvailable, lifecycleOf, nextTick } from "./lifecycle";
import { configuredFeed, createWorkshopService, defaultFeeds, type FeedSource } from "./service";
import { buildSubmission, validateDetails, validateEssentials, type SubmissionInput } from "./submission";
import { parseApproved, parseOwnSuggestions, storedRecord, suggestionInputSchema } from "./suggestions";
import { parseWorkshops, workshopCategories, workshopSchema, type Workshop } from "./types";

// Generated times appear only here, in tests; the product never invents dates.
const now = Date.parse("2026-12-01T12:00:00Z");
const base: Workshop = {
  id: "sample", title: "Sample workshop", outcomeHook: "Build a small thing.", description: "A description.", instructorOrHost: "Host", platform: "Platform",
  category: "Python", difficulty: "Beginner", format: "Self-Paced / Recorded", priceType: "Free", durationMinutes: 60, prerequisites: [], keyTakeaways: [],
  registrationOrWatchUrl: "https://example.com/sample", sourceType: "curated", verificationStatus: "verified"
};
const make = (changes: Partial<Workshop>): Workshop => ({ ...base, ...changes });
const live = (startDateTime: string, changes: Partial<Workshop> = {}) => make({ format: "Live Online", startDateTime, ...changes });
const none = new Set<string>();
const ids = (list: Workshop[]) => list.map(workshop => workshop.id);

test("the curated catalogue is valid, broad, unique and links to real roadmaps", () => {
  const parsed = parseWorkshops(curatedWorkshops);
  assert.equal(parsed.rejected, 0);
  assert.equal(new Set(ids(parsed.workshops)).size, curatedWorkshops.length);
  assert.equal(mergeWorkshops(parsed.workshops).length, curatedWorkshops.length, "no duplicates");
  const selfPaced = parsed.workshops.filter(workshop => workshop.format === "Self-Paced / Recorded");
  assert.ok(selfPaced.length >= 10);
  for (const category of workshopCategories) assert.ok(selfPaced.some(workshop => workshop.category === category), category);
  for (const workshop of parsed.workshops) {
    assert.ok(workshop.lastVerifiedAt, workshop.id);
    assert.ok(workshop.keyTakeaways.length >= 2, workshop.id);
    assert.equal(workshop.seatsRemaining, undefined, "seats are never invented");
    assert.ok(workshop.badge === undefined || workshop.badge === "Staff Pick", "only the editorial badge can be justified");
    if (workshop.priceType === "Free Audit") assert.ok(workshop.accessNotes, `${workshop.id} must explain its limits`);
    for (const id of workshop.relatedRoadmaps ?? []) assert.ok(getRoadmap(id), `${workshop.id} -> ${id}`);
  }
});

test("the schema refuses unsafe, incomplete and impossible records", () => {
  const bad: unknown[] = [
    { ...base, registrationOrWatchUrl: "javascript:alert(1)" }, { ...base, registrationOrWatchUrl: "http://example.com" }, { ...base, registrationOrWatchUrl: "https://user:pass@example.com" },
    { ...base, format: "Live Online" }, live("2026-12-01"), live("not a date"), live("2026-12-01T10:00:00"), { ...base, durationMinutes: 0 }, { ...base, durationMinutes: -5 },
    { ...base, id: "../etc" }, { ...base, title: "" }, { ...base, category: "Cooking" }, { ...base, extra: "field" }, null, "text"
  ];
  for (const record of bad) assert.equal(workshopSchema.safeParse(record).success, false, JSON.stringify(record)?.slice(0, 80));
  assert.deepEqual(ids(parseWorkshops([bad[0], base, bad[3]]).workshops), ["sample"], "one bad record never hides the good ones");
  assert.equal(parseWorkshops(Array.from({ length: 9 }, () => null), 5).rejected, 9);
});

test("lifecycle follows the clock exactly, with and without a recording", () => {
  const start = "2026-12-01T12:00:00Z", at = Date.parse(start);
  const event = live(start);
  assert.equal(endOf(event), at + 3_600_000);
  assert.equal(lifecycleOf(event, at - 1), "upcoming");
  assert.equal(lifecycleOf(event, at), "live");
  assert.equal(lifecycleOf(event, at + 3_599_999), "live");
  assert.equal(lifecycleOf(event, at + 3_600_000), "ended");
  assert.equal(lifecycleOf({ ...event, recordingUrl: "https://example.com/replay" }, at + 3_600_000), "replay");
  assert.equal(lifecycleOf(base, at), "anytime");
  // Crossing midnight and using an offset.
  const night = live("2026-12-31T23:30:00+02:00", { durationMinutes: 120 });
  assert.equal(lifecycleOf(night, Date.parse("2026-12-31T22:45:00Z")), "live");
  // Unusable times can never look bookable.
  assert.equal(lifecycleOf({ ...event, startDateTime: undefined }, at), "ended");
  assert.equal(lifecycleOf({ ...event, startDateTime: "nonsense" }, at), "ended");
});

test("countdowns never go negative and ticks stay economical", () => {
  const event = live("2026-12-02T13:01:05Z");
  assert.deepEqual(countdownTo(event, now), { days: 1, hours: 1, minutes: 1, seconds: 5 });
  assert.equal(countdownTo(event, Date.parse("2026-12-02T13:01:05Z")), null);
  assert.equal(countdownTo(event, Date.parse("2027-01-01T00:00:00Z")), null);
  assert.equal(countdownTo(base, now), null);
  assert.equal(nextTick([event], now), 60_000);
  assert.equal(nextTick([live("2026-12-01T12:30:00Z")], now), 1000);
  assert.equal(nextTick([live("2026-12-01T11:00:30Z")], now), 30_000, "wakes exactly when an event ends");
  assert.equal(formatDuration(45), "45 min");
  assert.equal(formatDuration(77), "1 h 17 min");
  assert.equal(formatDuration(3600), "60 h");
});

test("each state offers one honest action", () => {
  const event = live("2026-12-01T12:00:00Z", { recordingUrl: "https://example.com/replay" });
  assert.equal(callToAction(event, now - 1).label, "Register");
  assert.equal(callToAction(event, now).label, "Register", "no joining address, no Join Live");
  assert.deepEqual(callToAction({ ...event, joinUrl: "https://example.com/join" }, now), { label: "Join Live", url: "https://example.com/join" });
  assert.deepEqual(callToAction(event, now + 7_200_000), { label: "Watch Recording", url: "https://example.com/replay" });
  assert.equal(callToAction(base, now).label, "Start Learning");
});

test("the spotlight follows its order and never shows expired or private workshops", () => {
  const running = live("2026-12-01T11:30:00Z", { id: "running" });
  const featured = live("2026-12-09T12:00:00Z", { id: "featured", isFeatured: true });
  const nearest = live("2026-12-02T12:00:00Z", { id: "nearest" });
  const pick = make({ id: "pick", badge: "Staff Pick", priority: 5 });
  const plain = make({ id: "plain", priority: 1 });
  const expired = live("2026-11-01T12:00:00Z", { id: "expired", isFeatured: true });
  const mine = live("2026-12-01T11:45:00Z", { id: "local-1", verificationStatus: "unverified", isFeatured: true });
  const all = [expired, mine, plain, pick, nearest, featured, running];
  assert.equal(spotlight(all, now)?.id, "running");
  assert.equal(spotlight(all.filter(item => item !== running), now)?.id, "featured");
  assert.equal(spotlight([expired, mine, plain, pick, nearest], now)?.id, "nearest");
  assert.equal(spotlight([expired, mine, plain, pick], now)?.id, "pick");
  assert.equal(spotlight([expired, mine, plain], now)?.id, "plain");
  assert.equal(spotlight([expired, mine], now), null);
});

test("search, topic, saved and every filter work together", () => {
  const list = [
    make({ id: "py", title: "Python basics", registrationOrWatchUrl: "https://example.com/py" }),
    make({ id: "web", title: "Build a site", category: "Web Dev", difficulty: "Advanced", priceType: "Free Audit", description: "Uses Python at the end." }),
    live("2026-12-03T12:00:00Z", { id: "soon", title: "Live Python clinic", difficulty: "Intermediate" }),
    live("2026-11-03T12:00:00Z", { id: "gone", title: "Old Python clinic" }),
    live("2026-11-03T12:00:00Z", { id: "replay", title: "Recorded clinic", category: "Systems & Algorithms", recordingUrl: "https://example.com/r" })
  ];
  const run = (rail: Parameters<typeof discover>[1], filters: Partial<DiscoveryFilters> = {}, saved: ReadonlySet<string> = none) => ids(discover(list, rail, { ...defaultFilters, ...filters }, saved, now));
  assert.equal(run("all").includes("gone"), false);
  assert.deepEqual(run("all", { query: "  PYTHON " }), ["soon", "py", "web"], "title matches come before description matches");
  assert.deepEqual(run("Web Dev", { query: "python" }), ["web"]);
  assert.deepEqual(run("Web Dev", { query: "python", freeOnly: true }), []);
  assert.deepEqual(run("all", { format: "Live Online" }), ["soon"], "a replay is not a live session");
  assert.ok(run("all", { format: "Self-Paced / Recorded" }).includes("replay"));
  assert.deepEqual(run("all", { difficulty: "Advanced" }), ["web"]);
  const saved = new Set(["py", "gone", "missing"]);
  assert.deepEqual(run("saved", {}, saved), ["py"]);
  assert.equal(availableSavedCount(list, saved, now), 1, "expired and unknown bookmarks are kept but not counted");
  assert.equal(activeFilterCount({ ...defaultFilters, query: "x" }), 0);
  assert.equal(activeFilterCount({ ...defaultFilters, freeOnly: true, sort: "soon" }), 2);
});

test("sorting is deterministic whatever the input order", () => {
  const list = [
    make({ id: "b", title: "B", durationMinutes: 300, difficulty: "Advanced", priority: 1 }),
    make({ id: "a", title: "A", durationMinutes: 30, difficulty: "Intermediate", priority: 2 }),
    live("2026-12-20T12:00:00Z", { id: "later", title: "Later" }),
    live("2026-12-02T12:00:00Z", { id: "week", title: "This week", durationMinutes: 45 }),
    live("2026-12-01T11:30:00Z", { id: "now", title: "Now", difficulty: "Advanced" })
  ];
  const expected = { relevant: ["now", "week", "b", "a", "later"], soon: ["now", "week", "later", "b", "a"], shortest: ["a", "week", "later", "now", "b"], beginner: ["week", "later", "a", "now", "b"] } as const;
  for (const sort of ["relevant", "soon", "shortest", "beginner"] as const) {
    assert.deepEqual(ids(sortWorkshops(list, sort, now)), expected[sort], sort);
    assert.deepEqual(ids(sortWorkshops([...list].reverse(), sort, now)), expected[sort], `${sort} reversed`);
  }
});

test("duplicates are recognised by destination, without merging events that share a page", () => {
  assert.equal(canonicalUrl("https://WWW.Example.com/a/?utm_source=x&b=2&a=1#top"), canonicalUrl("https://example.com/a?a=1&b=2"));
  assert.notEqual(canonicalUrl("https://example.com/watch?v=1"), canonicalUrl("https://example.com/watch?v=2"));
  const first = live("2026-12-02T12:00:00Z", { id: "one" }), second = live("2026-12-03T12:00:00Z", { id: "two" });
  assert.notEqual(identityOf(first), identityOf(second));
  assert.equal(mergeWorkshops([first], [second]).length, 2);
  const copy = make({ id: "copy", title: "Copy", registrationOrWatchUrl: "https://www.example.com/sample/?utm_medium=mail" });
  assert.deepEqual(ids(mergeWorkshops([base], [copy])), ["sample"], "the earlier source wins");
});

const feedConfig: IcalSource = { idPrefix: "dtc", organizer: "Org", platform: "Org on Luma", linkHosts: ["luma.com"], defaultCategory: "AI & ML", difficulty: "Intermediate", priceType: "Free", accessNotes: "Free.", relatedRoadmaps: [] };
const event = (lines: string[]) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n");
const calendar = (...events: string[]) => ["BEGIN:VCALENDAR", "VERSION:2.0", ...events, "END:VCALENDAR"].join("\r\n");

test("the iCalendar reader unfolds, unescapes and converts zones correctly", () => {
  const { events, skipped } = parseIcal(calendar(
    event(["UID:1@x", "DTSTART:20261202T160000Z", "DTEND:20261202T170000Z", "SUMMARY:Queues\\, retries\\; and a very long", "  title", "DESCRIPTION:Line one\\nLine two", "BEGIN:VALARM", "DESCRIPTION:Alarm", "END:VALARM"]),
    event(["UID:2@x", "DTSTART;TZID=Europe/London:20260715T180000", "DURATION:PT1H30M", "SUMMARY:Summer"]),
    event(["UID:3@x", "DTSTART;TZID=America/New_York:20261215T140000", "DTEND;TZID=America/New_York:20261215T150000", "SUMMARY:Winter"]),
    event(["UID:4@x", "DTSTART;VALUE=DATE:20261202", "SUMMARY:All day"]),
    event(["UID:5@x", "DTSTART:20261202T160000", "DTEND:20261202T170000", "SUMMARY:Floating"]),
    event(["UID:6@x", "DTSTART:20261202T160000Z", "DTEND:20261202T170000Z", "RRULE:FREQ=WEEKLY", "SUMMARY:Recurring"]),
    event(["UID:7@x", "DTSTART:20261202T160000Z", "DTEND:20261202T150000Z", "SUMMARY:Backwards"]),
    event(["UID:8@x", "DTSTART:20261202T160000Z", "DTEND:20261202T170000Z", "STATUS:CANCELLED", "SUMMARY:Cancelled"]),
    event(["UID:9@x", "DTSTART;TZID=Nowhere/Land:20261202T160000", "DTEND:20261202T170000Z", "SUMMARY:Unknown zone"])
  ));
  assert.deepEqual(events.map(item => item.summary), ["Queues, retries; and a very long title", "Summer", "Winter"]);
  assert.equal(skipped, 6);
  assert.equal(events[0].description, "Line one\nLine two");
  assert.equal(new Date(events[1].start).toISOString(), "2026-07-15T17:00:00.000Z");
  assert.equal(events[1].end - events[1].start, 5_400_000);
  assert.equal(new Date(events[2].start).toISOString(), "2026-12-15T19:00:00.000Z");
  assert.equal(parseIcalTime({ params: new Map(), value: "20260230T100000Z" }), null, "impossible date");
  assert.deepEqual(parseIcal("not a calendar"), { events: [], skipped: 0 });
});

test("calendar events become validated workshops with safe text and allowed links only", () => {
  const { workshops, rejected } = workshopsFromIcal(calendar(
    event(["UID:evt-1@luma", "DTSTART:20261202T160000Z", "DTEND:20261202T170000Z", "SUMMARY:<script>alert(1)</script>Building <b>AI</b> Agents", "DESCRIPTION:Get up-to-date information at: https://luma.com/abc\\n\\nHosted by Ada & Alan"]),
    event(["UID:evt-2@luma", "DTSTART:20261202T160000Z", "DTEND:20261202T170000Z", "SUMMARY:Elsewhere", "DESCRIPTION:https://evil.example/x", "URL:javascript:alert(1)"]),
    event(["UID:evt-3@luma", "DTSTART:20261102T160000Z", "DTEND:20261102T170000Z", "SUMMARY:Past", "DESCRIPTION:https://luma.com/past"])
  ), feedConfig, now);
  assert.equal(workshops.length, 1);
  assert.equal(rejected, 1);
  assert.equal(/[<>]/.test(workshops[0].title), false);
  assert.equal(workshops[0].registrationOrWatchUrl, "https://luma.com/abc");
  assert.equal(workshops[0].instructorOrHost, "Ada & Alan");
  assert.equal(workshops[0].id, "dtc-evt-1");
  assert.equal(classify("Zero trust for AI", "Python"), "Cybersecurity");
  assert.equal(classify("Ethical cooking", "Python"), "Python", "words match whole, with a declared default");
});

test("JSON feeds are validated and cannot claim curated privileges", () => {
  const { workshops, rejected } = workshopsFromJson({ workshops: [{ ...base, isFeatured: true, badge: "Trending", priority: 1 }, { nonsense: true }] }, now);
  assert.equal(rejected, 1);
  assert.equal(workshops[0].id, "feed-sample");
  assert.equal(workshops[0].isFeatured ?? workshops[0].badge ?? workshops[0].priority, undefined);
  assert.equal(workshops[0].sourceType, "feed");
  assert.throws(() => workshopsFromJson({ items: [] }, now));
});

const source: FeedSource = { id: "test", label: "Test feed", url: "https://feed.example/x", hosts: ["feed.example"], kind: "json" };
test("the service merges sources, falls back, caches and reports honestly", async () => {
  let calls = 0, mode: "ok" | "fail" | "garbage" | "empty" = "ok", clock = now;
  const remote = live("2026-12-05T12:00:00Z", { id: "remote", registrationOrWatchUrl: "https://feed.example/r" });
  const service = createWorkshopService({
    feeds: [source], now: () => clock, ttlMs: 600_000, log: () => {},
    fetchText: () => async () => {
      calls++;
      if (mode === "fail") throw new SourceError("TIMEOUT", "slow");
      return mode === "garbage" ? "<html>" : JSON.stringify(mode === "empty" ? [] : [remote]);
    }
  });
  const [first, second] = await Promise.all([service.catalog(), service.catalog()]);
  assert.equal(calls, 1, "simultaneous callers share one request");
  assert.equal(first, second);
  assert.ok(ids(first.workshops).includes("feed-remote") && ids(first.workshops).includes("cs50p"));
  clock += 300_000;
  await service.catalog();
  assert.equal(calls, 1, "cached");
  for (const [next, state] of [["fail", "failed"], ["garbage", "failed"], ["empty", "empty"]] as const) {
    mode = next;
    clock += 700_000;
    const catalog = await service.catalog();
    assert.equal(catalog.sources.find(item => item.id === "test")?.state, state, next);
    assert.ok(ids(catalog.workshops).includes("cs50p"), "curated always survives");
    assert.equal(ids(catalog.workshops).includes("feed-remote"), state === "failed", "a failure keeps the last good copy; an empty answer does not");
  }
  mode = "fail";
  const cold = createWorkshopService({ feeds: [source], now: () => clock, log: () => {}, fetchText: () => async () => { throw new Error("down"); } });
  assert.equal((await cold.catalog()).sources.find(item => item.id === "test")?.count, 0);
});

test("feeds are https, on their own hosts and never configured through public variables", () => {
  for (const feed of defaultFeeds) assert.ok(feed.hosts.includes(new URL(feed.url).hostname) && feed.url.startsWith("https://"));
  assert.equal(configuredFeed({}), null);
  assert.equal(configuredFeed({ WORKSHOPS_FEED_URL: "http://feed.example" }), null);
  assert.equal(configuredFeed({ WORKSHOPS_FEED_URL: "https://user:pass@feed.example" }), null);
  assert.equal(configuredFeed({ WORKSHOPS_FEED_URL: "nonsense" }), null);
  assert.equal(configuredFeed({ NEXT_PUBLIC_WORKSHOPS_FEED_URL: "https://feed.example" }), null);
  assert.equal(configuredFeed({ WORKSHOPS_FEED_URL: "https://feed.example/a.json" })?.kind, "json");
  assert.equal(configuredFeed({ WORKSHOPS_FEED_URL: "https://feed.example/a.ics", WORKSHOPS_FEED_FORMAT: "ical" })?.kind, "ical");
});

test("calendar exports are valid, escaped, folded and only for upcoming sessions", () => {
  const item = live("2026-12-09T17:00:00Z", { id: "cal", title: "Queues, retries; and \\ more", outcomeHook: "Überaus nützlich — ".repeat(6).slice(0, 150) });
  const ics = icsFor(item, now)!;
  assert.ok(ics.includes("DTSTART:20261209T170000Z") && ics.includes("DTEND:20261209T180000Z"));
  assert.ok(ics.includes("SUMMARY:Queues\\, retries\\; and \\\\ more"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  for (const line of ics.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  // Reading it back gives the same moment and title.
  const [read] = parseIcal(ics).events;
  assert.equal(read.summary, item.title);
  assert.equal(read.start, Date.parse(item.startDateTime!));
  assert.equal(foldLine("a".repeat(75)).includes("\r\n"), false);
  const url = new URL(googleCalendarUrl(item)!);
  assert.equal(url.searchParams.get("dates"), "20261209T170000Z/20261209T180000Z");
  assert.ok(url.searchParams.get("details")!.includes(item.registrationOrWatchUrl));
  assert.equal(icsFor(item, Date.parse("2026-12-09T17:00:00Z")), null);
  assert.equal(canAddToCalendar(base, now), false);
});

const draft: SubmissionInput = { url: "https://learn.example/course", title: "My course", category: "Python", format: "Self-Paced / Recorded", hook: "Build a useful script.", difficulty: "Beginner", durationMinutes: "90", priceType: "Free", startLocal: "" };
test("submissions are validated, deduplicated and always private", async () => {
  assert.deepEqual(validateEssentials(draft, []), {});
  for (const url of ["http://learn.example", "javascript:alert(1)", "learn.example", "https://u:p@learn.example", "https://localhost"]) assert.ok(validateEssentials({ ...draft, url }, []).url, url);
  assert.ok(validateEssentials({ ...draft, url: "https://www.example.com/sample/?utm_source=a" }, [base]).url, "duplicate");
  assert.ok(validateEssentials({ ...draft, title: "x", category: "Cooking", format: "" }, []).category);
  for (const durationMinutes of ["", "0", "-5", "1.5", "999999"]) assert.ok(validateDetails({ ...draft, durationMinutes }, now).durationMinutes, durationMinutes);
  assert.ok(validateDetails({ ...draft, format: "Live Online", startLocal: "2020-01-01T10:00" }, now).startLocal);
  assert.ok(validateDetails({ ...draft, format: "Live Online" }, now).startLocal);
  const built = await buildSubmission({ ...draft, title: "<b>My</b> course" }, [], now);
  assert.ok("workshop" in built);
  assert.equal(built.workshop.verificationStatus, "unverified");
  assert.equal(built.workshop.submissionStatus, "private");
  assert.match(built.workshop.id, /^local-[0-9a-f]{16}$/);
  assert.equal(spotlight([built.workshop], now), null);
  assert.ok("errors" in await buildSubmission(draft, [built.workshop], now), "cannot be added twice");
});

test("damaged device storage is ignored safely", () => {
  for (const raw of [null, "", "{", "[]", "null", "5", JSON.stringify({ bookmarks: "no", submissions: {} }), "x".repeat(500_000)]) assert.deepEqual(parseDeviceData(raw), { bookmarks: [], submissions: [] }, String(raw).slice(0, 20));
  const data = parseDeviceData(JSON.stringify({ bookmarks: ["a", "a", "../x", 5], submissions: [{ ...base, id: "local-1", sourceType: "submission", verificationStatus: "unverified" }, { ...base }, { ...base, id: "local-2", sourceType: "submission", registrationOrWatchUrl: "javascript:1" }] }));
  assert.deepEqual(data.bookmarks, ["a"]);
  assert.deepEqual(ids(data.submissions), ["local-1"], "stored records cannot pose as curated or carry unsafe links");
});

const quiet: WorkshopAccess = { userId: "owner", setBookmark: async () => {}, approved: async () => [], suggestions: async () => [], addSuggestion: async () => {}, setSuggested: async () => true, removeSuggestion: async () => {} };
const request = (body: unknown, method = "PUT", origin = "http://localhost:3000") => new Request("http://localhost:3000/api/v1/workshops/bookmarks", { method, headers: { Origin: origin }, ...(method === "GET" ? {} : { body: JSON.stringify(body) }) });
test("the API checks origin, sign-in, shape, existence and rate before writing", async () => {
  const calls: unknown[] = [];
  const access: WorkshopAccess = { ...quiet, setBookmark: async (id, saved) => { calls.push([id, saved]); } };
  const catalog = async () => ({ workshops: [base], sources: [], generatedAt: new Date(now).toISOString() });
  const api = workshopHandlers(async () => access, catalog, () => 0);
  assert.equal((await api.bookmark(request({ workshopId: "sample", saved: true }, "PUT", "https://evil.example"))).status, 403);
  assert.equal((await workshopHandlers(async () => null, catalog, () => 0).bookmark(request({ workshopId: "sample", saved: true }))).status, 401);
  assert.equal((await workshopHandlers(async () => null, catalog).GET(request(null, "GET"))).status, 401);
  for (const body of [{}, { workshopId: "sample" }, { workshopId: "../x", saved: true }, { workshopId: "sample", saved: true, userId: "other" }, "text"]) assert.equal((await api.bookmark(request(body))).status, 400, JSON.stringify(body));
  assert.equal((await api.bookmark(request({ workshopId: "unknown", saved: true }))).status, 404);
  assert.equal(calls.length, 0);
  assert.equal((await api.bookmark(request({ workshopId: "sample", saved: true }))).status, 200);
  assert.equal((await api.bookmark(request({ workshopId: "unknown", saved: false }))).status, 200, "removing always works");
  assert.deepEqual(calls, [["sample", true], ["unknown", false]]);
  const limited = await workshopHandlers(async () => access, catalog, () => 7).bookmark(request({ workshopId: "sample", saved: true }));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "7");
  const full = await workshopHandlers(async () => ({ ...access, setBookmark: async () => { throw new WorkshopError("LIMIT_REACHED", "Full.", 409); } }), catalog, () => 0).bookmark(request({ workshopId: "sample", saved: true }));
  assert.equal(full.status, 409);
  const broken = await workshopHandlers(async () => ({ ...access, setBookmark: async () => { throw new Error("relation secret_table"); } }), catalog, () => 0).bookmark(request({ workshopId: "sample", saved: true }));
  assert.equal(broken.status, 503);
  assert.equal((await broken.text()).includes("secret_table"), false);
  const read = await api.GET(request(null, "GET"));
  assert.equal(read.status, 200);
  assert.equal(read.headers.get("cache-control"), "no-store");
});

test("meetups are never offered as live online sessions", () => {
  const at = (location: string, summary = "Talk") => workshopsFromIcal(calendar(event(["UID:evt-9@luma", "DTSTART:20261202T160000Z", "DTEND:20261202T170000Z", `SUMMARY:${summary}`, "DESCRIPTION:https://luma.com/abc", `LOCATION:${location}`])), { ...feedConfig, onlineVenue: /^webinar\b/i }, now).workshops.length;
  assert.equal(at("https://luma.com/event/evt-9"), 1);
  assert.equal(at(""), 1);
  assert.equal(at("Webinar\\, Boca Raton"), 1);
  assert.equal(at("12 Main Street\\, London"), 0);
  assert.equal(at("https://maps.example/venue"), 0);
  assert.equal(at("https://luma.com/event/evt-9", "Summer happy hour"), 0);
  assert.equal(at("https://luma.com/event/evt-9", "In-person workshop"), 0);
});

test("stored suggestions are stripped of privileges and validated on every read", async () => {
  const built = await buildSubmission(draft, [], now);
  assert.ok("workshop" in built);
  const record = { ...storedRecord(built.workshop), badge: "Staff Pick", isFeatured: true, priority: 1, seatsRemaining: 3, joinUrl: "https://evil.example", verificationStatus: "verified", sourceType: "curated" };
  const [mine] = parseOwnSuggestions([{ workshop_id: built.workshop.id, record, status: "pending", review_note: null }]);
  assert.equal(mine.status, "pending");
  assert.equal(mine.workshop.verificationStatus, "unverified");
  assert.equal(mine.workshop.sourceType, "submission");
  const [shown] = parseApproved([{ workshop_id: built.workshop.id, record, reviewed_on: "2026-12-01" }]);
  assert.equal(shown.id, built.workshop.id.replace("local-", "community-"));
  assert.equal(shown.sourceType, "community");
  assert.equal(shown.lastVerifiedAt, "2026-12-01");
  for (const item of [mine.workshop, shown]) assert.equal(item.badge ?? item.isFeatured ?? item.priority ?? item.seatsRemaining ?? item.joinUrl, undefined);
  for (const bad of [null, "text", { ...record, registrationOrWatchUrl: "javascript:alert(1)" }, { ...record, title: "" }]) {
    assert.deepEqual(parseApproved([{ workshop_id: built.workshop.id, record: bad, reviewed_on: "2026-12-01" }]), []);
    assert.deepEqual(parseOwnSuggestions([{ workshop_id: built.workshop.id, record: bad, status: "private", review_note: null }]), []);
  }
  assert.deepEqual(parseApproved([{ workshop_id: "cs50p", record, reviewed_on: "2026-12-01" }]), [], "cannot pose as a curated id");
  assert.equal(mergeWorkshops([shown], [mine.workshop]).length, 1, "the shared copy replaces the owner's card");
});

test("the suggestion API repeats every check and cannot approve anything", async () => {
  const calls: unknown[] = [];
  const access: WorkshopAccess = { ...quiet, addSuggestion: async workshop => { calls.push(["add", workshop.id]); }, setSuggested: async (id, on) => { calls.push([id, on]); return id !== "local-00000000000000ff"; }, removeSuggestion: async id => { calls.push(["remove", id]); } };
  const catalog = async () => ({ workshops: [base], sources: [], generatedAt: "" });
  const api = workshopHandlers(async () => access, catalog, () => 0, () => now);
  const send = (body: unknown, origin?: string) => api.suggestion(request(body, "PUT", origin));
  const id = "local-0123456789abcdef";
  assert.equal((await send({ action: "suggest", workshopId: id }, "https://evil.example")).status, 403);
  assert.equal((await workshopHandlers(async () => null, catalog, () => 0).suggestion(request({ action: "suggest", workshopId: id }))).status, 401);
  for (const body of [{}, { action: "approve", workshopId: id }, { action: "suggest", workshopId: "cs50p" }, { action: "suggest", workshopId: id, status: "approved" }, { action: "add", input: { ...draft, status: "approved" } }]) assert.equal((await send(body)).status, 400, JSON.stringify(body));
  assert.equal(suggestionInputSchema.safeParse({ action: "reject", workshopId: id }).success, false);
  const invalid = await send({ action: "add", input: { ...draft, url: "https://www.example.com/sample/" } });
  assert.equal(invalid.status, 400);
  assert.ok((await invalid.json()).error.fields.url, "duplicates are refused with the field to fix");
  assert.equal(calls.length, 0);
  assert.equal((await send({ action: "add", input: draft })).status, 201);
  assert.equal((await send({ action: "suggest", workshopId: id })).status, 200);
  assert.equal((await send({ action: "withdraw", workshopId: "local-00000000000000ff" })).status, 409, "reviewed items cannot be changed");
  assert.equal((await send({ action: "remove", workshopId: id })).status, 200);
  assert.equal((await workshopHandlers(async () => access, catalog, () => 9).suggestion(request({ action: "remove", workshopId: id }))).status, 429);
  const shown = await workshopHandlers(async () => ({ ...quiet, approved: async () => [make({ id: "community-0123456789abcdef", sourceType: "community", registrationOrWatchUrl: "https://example.com/new" })] }), catalog).GET(request(null, "GET"));
  assert.equal((await shown.json()).workshops.length, 2);
});

test("availability hides only what has truly ended", () => {
  assert.equal(isAvailable(base, now), true);
  assert.equal(isAvailable(live("2026-11-01T12:00:00Z"), now), false);
  assert.equal(isAvailable(live("2026-11-01T12:00:00Z", { recordingUrl: "https://example.com/r" }), now), true);
});

test("every workshop has a local, openly licensed photo", () => {
  const folder = "public/media/workshops";
  const keys = Object.keys(pictures) as PictureKey[];
  for (const key of keys) {
    for (const width of [640, 1280]) {
      const file = `${folder}/${key}-${width}.webp`;
      assert.ok(existsSync(file), file);
      assert.ok(statSync(file).size < 260_000, `${file} is too heavy`);
    }
    const photo = pictures[key];
    assert.ok(["CC0 1.0", "Public domain"].includes(photo.license) && photo.caption && photo.author, key);
    assert.equal(new URL(photo.page).protocol, "https:");
    assert.match(photo.tone, /^#[0-9a-f]{6}$/);
  }
  assert.equal(readdirSync(folder).length, keys.length * 2, "no stray files");
  // Each hand-checked workshop has its own picture, and a topic cover never repeats one of its cards.
  const used = curatedWorkshops.map(pictureFor);
  assert.equal(new Set(used).size, curatedWorkshops.length);
  for (const category of workshopCategories) {
    assert.ok(!curatedWorkshops.some(workshop => workshop.category === category && pictureFor(workshop) === topicPicture[category]), category);
  }
});

test("feed and learner workshops get a related photo, always the same one", () => {
  const photo = (title: string, category: Workshop["category"] = "AI & ML", id = "feed-1") => pictureFor({ id, title, category });
  assert.equal(photo("Intro to Docker", "Cloud & DevOps"), "containers");
  assert.equal(photo("Kubernetes for beginners", "Cloud & DevOps"), "helm");
  assert.equal(photo("Giving AI Agents Reliable Access to the Web"), "fiber");
  assert.equal(photo("The Real Cost of a Useful AI Feature"), "abacus");
  assert.ok(["pipes", "patch-cables"].includes(photo("Database CI/CD", "Cloud & DevOps")));
  assert.equal(photo("Anything at all", "Python"), photo("Anything at all", "Python"));
  // Part of a word is not a subject, and inherited property names are not workshops.
  assert.notEqual(photo("Dockerless thinking"), "containers");
  for (const id of ["constructor", "toString", "__proto__"]) assert.ok(pictures[photo("Untitled", "Cybersecurity", id)]);
  for (const category of workshopCategories) for (let index = 0; index < 30; index++) assert.ok(pictures[photo("Untitled", category, `id-${index}`)]);
});
