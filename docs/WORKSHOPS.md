# Workshops

Discover free, hands-on computer science sessions at `/workshops`. Added
22 November 2026 (M5). Photo-led but simple to use: header, a horizontal topic
bar (icons with names, icons only where narrow), a 3D ring, search, one Filters button,
cards and a detail panel. *Surprise me* opens a random workshop from the list.

**Ring** (`src/lib/workshops/ring.ts`, `workshop-ring.tsx`): up to ten checked
workshops of the chosen topic, live sessions first. The one at the front is the
biggest and carries the details. It moves on by itself every five seconds, and waits
while the mouse or keyboard is on it, for 12 seconds after it was turned by hand, while a
panel is open, and off screen. A pause button is remembered (`careerforge-ring`); it stays
still with reduced motion or the site's motion off, and automatic moves are not announced.
Turn it with the wheel, a drag or swipe, the arrow keys, Home/End, or a side card;
previous and next buttons appear when reached with Tab. The wheel stops at the first and
last card so the page scrolls on. Every workshop is also in the list below; a
search or filter hides the ring. With reduced motion it jumps instead of gliding. It
uses CSS 3D transforms only.

## Content

- **Curated** (`src/data/workshops/curated.ts`): 20 self-paced resources and 6
  Microsoft Reactor live sessions (AI, web, security and cloud). Every page was opened on `lastVerifiedAt`.
  Hooks and descriptions are original. `durationNote` quotes a range the
  publisher states; `durationEstimated` marks a length nobody states ("our estimate").
- **Live feed**: DataTalks.Club's public Luma calendar (iCalendar, UTC times).
- **Learner workshops**: kept in the account, shown only to their owner and labelled
  "Added by you" until the owner suggests one and an operator approves it. Then
  everyone sees it as "Suggested by a learner", without the suggester's name.

Badges: only *Staff Pick* is used (editorial: official, free, practical).
Popularity, seats and ratings are never shown because no source supports them.

### Sources reviewed and not used

| Source | Reason |
| --- | --- |
| CNCF and GDG community event APIs | `robots.txt` disallows `/api/` |
| TeSS (ELIXIR) events API | `robots.txt` disallows AI agents |
| ACCESS events API | Eastern times are labelled as UTC |
| Meetup iCalendar | Terms restrict automated extraction; the adapter can read it, but it is off |
| WiCyS calendar | Terms forbid automated collection; times unclear |
| python.org calendars | Served by calendar.google.com, whose `robots.txt` disallows them |
| Cloud Native Now webinars | Cost could not be confirmed |
| Security Boulevard, DevOps.com | Calendar requests are refused (403) |
| Company Luma calendars (Pulumi, Convex, MotherDuck and others) | Mix venues and online events without saying which |
| Reactor listing pages | No public feed; verified events are curated by hand |
| Automatic Reactor proposals | Microsoft's site terms limit use to personal and non-commercial and do not clearly allow automated collection, so no job collects its listings |

## Pictures

`src/data/workshops/pictures.ts` holds 36 photographs, all CC0 or public domain,
each looked at before it was added. Files are local (`public/media/workshops`, two
WebP widths); nothing is hot-linked and no publisher's logo or artwork is used.

- Curated workshops: one hand-matched photo each (Docker: shipping containers).
- Feed and learner workshops: the first subject found in the title, then the topic.
- Photos are decorative (`alt=""`). The details panel shows the credit and source.
- A missing file falls back to its colour. Tests check files, licences and matches.

Other motion lasts under three seconds, only on entry or hover, and stops with the
reduced-motion setting.

## Architecture

| Concern | Location |
| --- | --- |
| Model and validation (zod) | `src/lib/workshops/types.ts` |
| Lifecycle, countdown, call to action | `src/lib/workshops/lifecycle.ts` |
| Search, filters, sorting, spotlight, deduplication | `src/lib/workshops/discovery.ts` |
| iCalendar reader; iCal and JSON adapters | `src/lib/workshops/{ical,adapters}.ts` |
| `workshopService` | `src/lib/workshops/service.ts` |
| Calendar export, submissions | `src/lib/workshops/{calendar,submission}.ts` |
| API handlers, page data | `src/lib/workshops/{handlers,server}.ts` |
| Interface | `src/components/workshops/*` |
| Learner workshops and review | `src/lib/workshops/suggestions.ts`, `scripts/review-workshops.mjs` |
| Storage | `supabase/migrations/202611230001_workshop_bookmarks.sql`, `202611230002_workshop_suggestions.sql` |

**Service**: sources load in parallel with a 6-second timeout, 1.5 MB limit, no
redirects and a host allow-list; each record is validated on its own; results
are cached for 30 minutes and shared between simultaneous requests. A failed
source is retried after two minutes and shows its last good copy; the curated
catalogue is always returned. Status is shown at the foot of the page.

**Lifecycle** is computed, never stored: upcoming → live → replay (with a
recording) or hidden. Records are not rewritten, so a recording added later
brings an event back.

**Deduplication** compares canonical links (no tracking, fragment, `www.` or
trailing slash). Live sessions also compare their start time, so events that
share a registration page are not merged. Earlier sources win: curated, feeds,
private.

**Sorting** is deterministic. *Most Relevant*: search score, then live now, live
within 7 days, editorial order, later sessions. *Starting Soon*: live, upcoming,
replay, self-paced. Title breaks ties.

## Configuration

Optional, server-side only (never `NEXT_PUBLIC_`):

- `WORKSHOPS_FEED_URL`: an https feed.
- `WORKSHOPS_FEED_FORMAT`: `json` (default) or `ical`.

JSON contract: an array, or `{ "workshops": [...] }`, of records in the Workshop
model. Feed records cannot claim featured status, badges or curated ids. RSS is
not supported: its dates are publication dates, not event times. iCalendar
entries that are all-day, recurring, cancelled, without a time zone or with an
unknown one are rejected, and so is anything with a street address or an
in-person title: it is never offered as "Live Online".

## API

- `GET /api/v1/workshops` → `{ workshops, sources, generatedAt }` (signed in).
- `PUT /api/v1/workshops/bookmarks` `{ workshopId, saved }` (signed in, same
  origin, 60 a minute).

- `PUT /api/v1/workshops/suggestions` `{ action: add | suggest | withdraw | remove }`.

## Reviewing suggestions

```text
npm run review:workshops -- list
npm run review:workshops -- approve <id#fingerprint>
npm run review:workshops -- reject <id#fingerprint> "Reason shown to the learner"
```

The fingerprint identifies the exact text reviewed. Learners cannot approve, edit
a submitted record or see anyone else's; the database enforces this. Removing an
approved workshop, or deleting the account, removes it for everyone. The tool uses
the administrative connection and shows no account details.

## Staying current

`npm run check:workshops` (Tuesdays in GitHub Actions) fails when a link is gone or a
live session's page no longer shows its title, date and time, and warns when sessions
have ended, when fewer than three hand-checked or four live sessions remain, or when a
feed cannot be read. The workflow then opens one issue, *Workshops need attention*,
with the list and the steps; it updates that issue when the list changes and closes it
when the check is clean. The job that runs project code can only read; the job that
writes the issue runs no project code. Expired sessions hide themselves meanwhile.

Some sites refuse GitHub's servers. A refusal, time-out or outage is logged but raises
no issue unless six or more pages fail together; a missing page (404, 410), an unknown
domain or an expired certificate always does.

The live feed adds its own new sessions. Curated sessions are added by a person, who
opens each event page first.

## Bookmarks and retention

Saved per account in `workshop_bookmarks` (owner-only row-level security, at most
300). When the table is unavailable, for example before the migration reaches an
environment, the page saves on the device and says so. A bookmark is kept when
its event ends or leaves a feed, because it may return with a recording; it is
hidden and not counted meanwhile. Bookmarks are removed by the learner or with
the account. No automatic pruning runs: 300 short ids cost nothing to keep.

## Roadmaps

Curated workshops list stable roadmap ids. A roadmap shows up to three under
*Practice this skill*; a workshop links back under *Fits these roadmaps*. Tests
check that every id exists. Text matching is not used. Feed sessions link to the
series' roadmaps only.

## Verification (22 November 2026)

- 24 unit tests: schema, lifecycle boundaries, countdowns, spotlight order,
  filters, sorting, deduplication, time zones, hostile feed content, service
  fallback and caching, calendar round trip, submissions, storage damage, API.
- `npm run db:validate:workshops` passed on development (always rolled back).
- `test-account-live.mjs --workshops-only` passed on development with real
  accounts: every control, deep links, Back/Forward, rollback on a failed save,
  a session going from countdown to live to ended under a controlled clock,
  calendar download, 320/390/768/1440px, larger text, independent rail scrolling.

## Limitations

- Python and Systems & Algorithms have no live session today, only self-paced
  workshops. No source with clear permission and reliable times was found for them.
- The feed gives title, time, host and link. Its level is a series estimate and
  has no prerequisites or outcomes.
- New curated live sessions are still added by hand; the weekly check says when.
- Review is a command-line tool; there is no admin page.
- 12 self-paced lengths are estimates because no publisher states one.
- The app has one (dark) theme.
