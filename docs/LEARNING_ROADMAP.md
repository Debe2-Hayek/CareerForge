# Learning roadmap

Simple, free roadmaps for roles and skills, with progress tracking, projects and
a free course library, at `/learning-roadmap` (M5 pilot). Rebuilt 22 November
2026: the earlier zoomable graph, setup form and dashboard were replaced because
they offered too many choices at once.

## User journey

1. **Roadmaps** (`/learning-roadmap`): *Continue learning*, up to three explained
   suggestions from the learner's own headline and skills, one search box, and
   two plain lists (career roles, skills).
2. **A roadmap** (`/learning-roadmap/<id>`): opens directly on the map, with no
   form. A vertical spine of sections; topics branch left and right; each section
   states its goal and a small *Try it* task. Ordinary page scrolling (no canvas,
   zoom or pan); on narrow screens topics stack under their section.
   - The round button ticks a topic. The first tick starts the roadmap.
   - Clicking a topic opens a side panel: summary, free resources, full courses
     where the topic has its own roadmap, *Go deeper* link, To do / Learning /
     Done / Skip, previous and next. Keyboard: D, L, S, T and arrow keys. The
     open topic is in the URL (`?topic=`).
   - Only core topics count towards progress; *Good to know* and *Optional* never do.
   - A shared topic (for example Git) finished in one roadmap counts in every
     roadmap that uses it.
   - The in-depth paths (Python, JavaScript & Web) add *Your goal*, which chooses
     the sections shown, and full lessons inside the panel.
   - Below the map: portfolio projects, free courses, related roadmaps.
3. **Projects** (`/learning-roadmap/projects`): project briefs by level and
   subject, plus step-by-step tutorials. A brief opens in its roadmap, where it
   can be started, marked built with an `https://` link, and turned into a
   portfolio entry.
4. **Free courses** (`/learning-roadmap/courses`): searchable open catalogue.
5. **Career roadmaps** (`/learning-roadmap/careers`) and the **product map**
   (`/learning-roadmap/product`) are linked from the footer, unchanged.

## Content (22 November 2026)

63 roadmaps (26 roles, 37 skills), about 1,700 topics, 205 project briefs, 1,194
free courses and 457 tutorials.

| Content | Location | Origin |
| --- | --- | --- |
| Role and skill roadmaps | `src/data/roadmaps/*.ts` | Original CareerForge text |
| Topics shared between roadmaps | `src/data/roadmaps/shared.ts` | Original CareerForge text |
| Publishers and whole courses linked | `src/data/roadmaps/sources.ts` | Links only |
| In-depth lessons | `src/data/learning/{python,web}.ts` | Original CareerForge text |
| Free courses | `src/data/open-catalog/courses.json` | Free Programming Books, CC BY 4.0 |
| Tutorials | `src/data/open-catalog/tutorials.json` | build-your-own-x (CC0), project-based-learning (MIT) |

**Adding a roadmap** takes one text block (format in `src/lib/roadmaps/parse.ts`):
`## Section | goal | task`, `- Core topic | summary | resources`, `+` good to know,
`? ` optional, `- @shared-id`, `* Project | level | summary | requirements`.
Parsing and zod validation run when the catalogue loads, so duplicate ids, broken
references, unknown resources or missing fields fail tests and builds. Topic ids
come from titles: renaming a topic resets progress on it, so keep titles stable.

**Commands**: `npm run check:learning-links` verifies every resource;
`npm run import:open-catalog -- --verify` refreshes courses and tutorials (no
account, key or AI; dead, non-HTTPS and archive links are dropped).

## Sources and licensing

roadmap.sh was requested as the data source. Its repository licence forbids
publishing its content "in any form", allowing only links, and its terms forbid
copying, derivative works and automated access. The learner roadmaps therefore do
not use its content: they cover the same subjects with original text, link to the
roadmap.sh counterpart, and state that the two are not affiliated. Separately, the
older product map sync (`scripts/sync-roadmap.ts`, weekly workflow) still reads
topic file names from roadmap.sh's GitHub repository and stores those ids in
`src/data/roadmap.json`; whether to keep it under the same licence is undecided. Using the actual data would need written permission from
its owner. Imported catalogues permit redistribution; credits and licences appear
on every page that uses them.

## Architecture

| Concern | Location |
| --- | --- |
| Roadmap schema, parser, catalogue | `src/lib/roadmaps/{schema,parse,catalog}.ts` |
| Progress maths shared with the browser | `src/lib/roadmaps/marks.ts` |
| Saved progress, shared credit, suggestions | `src/lib/roadmaps/progress.ts` |
| Open catalogue search | `src/lib/roadmaps/open-catalog.ts` |
| API schemas, handlers, data access | `src/lib/learning/{api,handlers,server}.ts` |
| Skill evidence levels | `src/lib/learning/evidence.ts` |
| Interface | `src/components/roadmaps/*` |
| Storage (unchanged) | `supabase/migrations/202611210001_learning_progress.sql` |

- The browser receives one roadmap at a time, never the catalogue. `@xyflow/react`
  was removed; the map is HTML with small SVG connectors.
- Changes appear at once and roll back with a message if saving fails.
- Without progress storage every roadmap still opens, read-only.

## Data model and privacy

Unchanged tables: `learning_enrollments` (one row per started roadmap; `goal_id`
is the chosen goal, or `complete`) and `learning_progress` (topic states
`in_progress`, `completed`, `known`; project states with an optional link). No
migration is needed. RLS restricts rows to their owner. The API validates shape
and ids, requires same-origin writes and limits writes to 60 a minute. Clearing a
roadmap deletes its enrolment, which cascades its progress. Reads are paged
because the database returns at most 1,000 rows per request.

Existing Python and web progress and goals carry over: topic ids are unchanged.

**Evidence stays graded**: assessed skill check > built project > completed lessons
> profile skill. Completing lessons never changes CV eligibility.

## Verification (22 November 2026)

- 188 unit and render tests, lint, strict TypeScript and production build.
- `test-account-live.mjs --learning-only` passed against development (real Auth
  and database, temporary accounts removed): search, first tick starts a roadmap,
  panel with keyboard and deep links, rollback on failed save, shared credit,
  project evidence, guided goals, resume, 320/768/1440px on five pages, course
  search, API validation, clear progress. It found and fixed an overflow at 320px.
- Edge review at 1440, 820 and 390px: no console errors, overflow or clipped labels.
- Resource links: of 1,228, 1,205 resolved and 23 refuse automated
  checks (not confirmed here); none broken, after replacing 19 dead links.

## Remaining work

1. Per-topic depth: compact topics have a summary and links; only the two guided
   paths have full lessons.
2. Course entries come from community lists; add ratings or levels if a reliable
   open source appears.
3. Persist project evidence into portfolio records (today: prepared entry).
4. Use observed job-requirement frequencies in career gaps.
