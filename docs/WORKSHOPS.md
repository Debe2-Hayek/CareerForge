# Workshops

Discover free, hands-on computer science sessions at `/workshops`. Added
22 November 2026 (M5). Calm on the surface: header, topic rail, one spotlight,
search, one Filters button, cards and a detail panel.

## Content

- **Curated** (`src/data/workshops/curated.ts`): 20 self-paced resources and 3
  Microsoft Reactor live sessions. Every page was opened on `lastVerifiedAt`.
  Hooks and descriptions are original. `durationEstimated` marks a length the
  publisher does not state (shown as "≈" and "our estimate").
- **Live feed**: DataTalks.Club's public Luma calendar (iCalendar, UTC times).
- **Private submissions**: stored in the learner's browser, shown only to them,
  labelled "Added by you", never verified and never featured.

Badges: only *Staff Pick* is used (editorial: official, free, practical).
Popularity, seats and ratings are never shown because no source supports them.

### Sources reviewed and not used

| Source | Reason |
| --- | --- |
| CNCF and GDG community event APIs | `robots.txt` disallows `/api/` |
| TeSS (ELIXIR) events API | `robots.txt` disallows AI agents |
| ACCESS events API | Eastern times are labelled as UTC |
| Meetup iCalendar | Terms restrict automated extraction; the adapter can read it, but it is off |
| Reactor listing pages | No public feed; verified events are curated by hand |

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
| Storage | `supabase/migrations/202611230001_workshop_bookmarks.sql` |

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
unknown one are rejected.

## API

- `GET /api/v1/workshops` → `{ workshops, sources, generatedAt }` (signed in).
- `PUT /api/v1/workshops/bookmarks` `{ workshopId, saved }` (signed in, same
  origin, 60 a minute).

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

- 19 unit tests: schema, lifecycle boundaries, countdowns, spotlight order,
  filters, sorting, deduplication, time zones, hostile feed content, service
  fallback and caching, calendar round trip, submissions, storage damage, API.
- `npm run db:validate:workshops` passed on development (always rolled back).
- `test-account-live.mjs --workshops-only` passed on development with real
  accounts: every control, deep links, Back/Forward, rollback on a failed save,
  a session going from countdown to live to ended under a controlled clock,
  calendar download, 320/390/768/1440px, larger text, independent rail scrolling.

## Limitations

- Live events today come from one calendar plus three curated sessions, mostly
  AI and data. Other topics have self-paced workshops only.
- The feed gives title, time, host and link. Its level is a series estimate and
  has no prerequisites or outcomes.
- Curated live sessions are entered by hand and disappear when they end.
- Submissions are private to a browser; there is no review or publishing flow.
- The app has one (dark) theme.
