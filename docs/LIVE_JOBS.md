# Live job listings (R2 / M4 FR-4.1, FR-4.5)

Owner request, 19 November 2026: real jobs from real APIs covering Lebanon,
the region and the world, with no paid services. The owner supplied a free
Himalayas API key in the local `.env` and authorized integrating permitted
free sources.

## Sources (reviewed 19 November 2026)

| Source | Coverage | Access | Conditions we follow |
| --- | --- | --- | --- |
| Himalayas jobs API (`/jobs/api/search?country=LB`) | Remote jobs whose employers accept applicants in Lebanon, including worldwide roles | Free key, `Authorization: Bearer` (60 req/min, 10,000/day); works anonymously at lower limits | API terms (himalayas.app/terms, API clause): Apply uses the unchanged `applicationLink`; visible "Listing from Himalayas" link; shown only in CareerForge; no redistribution or JobPosting structured data; key server-side only; expired jobs removed |
| Workable public job widget (`apply.workable.com/api/v1/widget/accounts/{board}`) | On-site roles in Lebanon/MENA: `valsoft-corp` (Beirut), `infoquest` | Public, unauthenticated; robots.txt allows | Link to the original posting and apply page; store only listed fields |
| Greenhouse Job Board API (`boards-api.greenhouse.io/v1/boards/{board}/jobs`) | MENA roles: `careem`, `tamara` | Public, unauthenticated; robots.txt only disallows `/embed/` | Link to the original posting; `metadata` (which can contain staff emails) is never read |

No free Lebanon-specific job-board API was found; Bayt and similar aggregators
are paid or scraping-based and are not used. LinkedIn is not used. Workable and
Greenhouse endpoints are intended for employers' own career pages; we only read
published listings and always send users to the original page. Add employer
boards in `src/lib/jobs/sources.ts` after checking the board is public.

## Behavior and safeguards

- `npm run jobs:ingest` (or `-- --dry-run`) runs server-side with `DATABASE_URL`.
  Only configured HTTPS hosts are fetched; no redirects; 15 s timeout; 6 MB body
  cap; JSON content type required; 429 reports `Retry-After`; ~1.1 s between
  Himalayas requests. Each item is schema-validated; malformed items are skipped
  and counted; a malformed page fails that source only.
- Text is converted to bounded plain text (no source HTML is rendered). Skills
  are detected deterministically by whole-word keyword matching; ambiguous words
  (Swift, React, Excel) require context. Detection can miss or over-match.
- Rows share `job_postings` with the fictional seeds so saving, tracking and
  learning plans work. Live rows store source, board, external ID, original and
  apply URLs, region, published/expiry/fetched times. `unique(source, external_id)`
  deduplicates repeat imports; IDs are stable hashes (`hm-`, `wk-`, `gh-`).
- Each source is written in its own transaction. Full-board sources close jobs
  absent from the latest fetch; Himalayas rows close on expiry or after 3 days
  without being seen. A failed source is left untouched and never replaced with
  demo data. Closed/expired rows are deleted unless a user saved them; saved
  ones stay visible only to that owner's tracker, labeled "No longer active",
  without an Apply link.
- RLS (`careerforge_job_is_current`) shows a live row only while active,
  unexpired and refreshed within 7 days; students cannot write the catalog; the
  save trigger refuses expired/stale listings.
- UI: region filter (Lebanon / Middle East & North Africa / Worldwide remote /
  Remote, open to Lebanon), live/demo filter, 24-card paging, "Live listing · via
  {source}" labels, posted/checked times, matched/total skill counts, and a
  "Match unavailable" state when no skills are detected. Ranking puts more
  matched skills first. CareerForge never submits applications.

## Verification (19 November 2026)

- 11 new unit tests (`src/lib/jobs/jobs.test.ts`) plus catalog filter tests; all
  110 unit tests, lint, TypeScript and production build passed.
- Real dry run and two real imports into the development database: 191 listings
  (Lebanon 46, MENA 41, worldwide remote 81, international remote open to
  Lebanon 23); the second import created no duplicates (191 distinct keys).
- `npm run test:rls` passed new checks: expired/stale rows hidden, saving them
  refused, owner keeps saved history, student writes denied, duplicate key and
  non-HTTPS/unknown source/region rows rejected.
- `npm run test:jobs:live` (development server) passed three consecutive runs:
  counts, paging, region/listing filters, Himalayas attribution and unchanged
  apply link, saving a live listing, no horizontal overflow at 320/768/1440 px
  and no browser errors. Screenshots reviewed.

## Limitations and next steps

- Ingestion is manual; there is no scheduled refresh yet. Listings disappear
  from view 7 days after the last import. A scheduled job needs a server-side
  secret and owner approval for the hosting configuration.
- The hosted preview uses a separate database and has not been migrated or
  ingested.
- Only four employer boards are configured for on-site Lebanon/MENA roles.
- Skill detection is a keyword heuristic; 95 of 191 listings had no detected
  skills. Seniority and work mode are often unspecified by the sources.
- The pre-existing `/cv/saved` 320/1440 overflow assertion in
  `test:account:live` fails on the unmodified baseline as well; that suite
  therefore did not reach its jobs stage.
