# Learning roadmap

Personalised, free-first learning paths with progress tracking, projects and
portfolio evidence, plus career roadmaps that compare a profile with a target
role. Implemented 21 November 2026 at `/learning-roadmap` (M5 pilot).

## User journey

1. **Dashboard** (`/learning-roadmap`): what the tab is for, *Continue learning*
   cards for saved paths (progress, next topic, weeks left), and a searchable,
   filterable catalog of guided paths and career roadmaps. Only categories that
   actually have content are offered as filters.
2. **Guided path** (`/learning-roadmap/<course>`): first visit asks for goal,
   experience level, weekly hours and preferred resource format. *Preview my
   roadmap* is a plain GET form (works without JavaScript; nothing is saved).
   *Save and start learning* creates the enrolment.
3. **Roadmap**: progress ring, remaining hours/weeks at the stated pace, current
   stage, explainable *What to do next* recommendations, a *This week* plan that
   respects prerequisites, an evidence ladder, and two views:
   *Guided path* (accessible vertical timeline, default) and *Overview map*
   (compact phase columns of connected nodes, horizontally scrollable).
4. **Topic detail** (`?topic=<id>`): native modal dialog (focus trapped and
   restored, Escape closes, background keeps its scroll position). Answers what,
   why, prerequisites (linked, with status), worked example, free resources
   (preferred format first), exercises, mini-project, completion criteria and
   the next topic. *Mark as complete* is enabled only after the learner ticks
   every completion criterion; *I already know this* and *Reopen* are available.
5. **Projects**: unlock when their required topics are completed/known; locked
   projects list the missing topics. Learners can start, mark built with an
   optional public `https://` link, and get a prepared portfolio entry to paste
   into their profile project summary or the existing CV & Portfolio builder
   (no duplicate portfolio system).
6. **Career roadmaps** (`/learning-roadmap/careers`): role tracks and live/demo
   job targets with gap analysis (the earlier pilot), now showing the strongest
   recorded evidence per skill and linking steps to the matching guided-path topic.
7. **Product map** (`/learning-roadmap/product`): the living product-evolution
   map (`src/data/roadmap.json`) remains inside this authenticated tab as a
   secondary view linked from the dashboard footer.

## Architecture

| Concern | Location |
| --- | --- |
| Content schema + integrity rules | `src/lib/learning/schema.ts` |
| Curriculum (versioned, original) | `src/data/learning/python.ts` |
| Catalog loading/validation | `src/lib/learning/catalog.ts` |
| Personalisation engine | `src/lib/learning/plan.ts` |
| Next-step recommendations | `src/lib/learning/recommendations.ts` |
| Skill evidence levels | `src/lib/learning/evidence.ts` |
| API schemas, handlers, data access | `src/lib/learning/{api,handlers,server}.ts` |
| Routes | `src/app/learning-roadmap/**`, `src/app/api/v1/learning/**` |
| UI | `src/components/learning/*` |
| Storage | `supabase/migrations/202611210001_learning_progress.sql` |

**Content integrity** is enforced when the catalog loads, so a bad edit fails
tests and builds: unique ids; every prerequisite exists and is declared earlier
(acyclic, already topologically ordered); branch topics depend only on core
material or branches every selecting goal includes; required topics never depend
on optional ones; required topics list only free resources; HTTPS links only.

**Personalisation is deterministic and explainable** (no AI, no paid service):

- Goals select specialisation branches (e.g. ML = data + machine learning);
  other specialisations remain visible but do not count.
- Essential and recommended topics in included phases form the plan; optional
  topics and career topics for non-career goals never affect progress.
- Experience level scales estimates (e.g. experienced: foundation ×0.25) and
  flags foundation topics for *quick review*; it never marks anything done.
- Weekly hours change the finish estimate and weekly plan, never the curriculum.
- Progress = completed ÷ (plan topics − topics marked known); skipped material
  neither inflates nor deflates the figure.
- The next topic is an in-progress topic, else the first plan topic whose
  prerequisites are met. Recommendations state their inputs (e.g. "Learn
  Functions before Classes and objects: it builds directly on it").
- Projects are offered least-advanced first and only for the learner's goal.

**Evidence is graded**, never upgraded silently: assessed skill check >
built project (public link = verifiable) > completed lessons (self-reported) >
profile skill (self-reported). Completing lessons never changes CV eligibility.

## Data model and privacy

`learning_enrollments (user_id, course_id)` stores goal, level, weekly hours,
format and the curriculum version. `learning_progress (user_id, course_id,
item_kind, item_id)` stores topic states (`in_progress`, `completed`, `known`)
and project states (`building`, `completed`, optional `https://` evidence URL).

- Primary keys prevent duplicate records; writes are update-then-insert.
- Stable ids survive curriculum revisions; ids removed later are ignored, not
  deleted. Changing goal or level updates only the enrolment, keeping progress.
- RLS restricts every row to its owner; anonymous access is revoked; column
  grants stop clients rewriting owners, start/activity/completion timestamps.
  Timestamps are trigger-maintained. Deleting an enrolment cascades its progress.
- The API validates shape (zod), checks ids against the current catalog,
  requires same-origin browser writes, limits writes to 60/min per user and
  returns no internal error details. Pages degrade to read-only roadmaps when
  progress storage is unavailable.

## Sources and licensing

roadmap.sh's repository (`nilbuild/developer-roadmap`, formerly
`kamranahmedse/developer-roadmap`) permits sharing links but **not** reproducing
its content. CareerForge therefore writes its own curriculum and links to the
roadmap.sh page for attribution. Resources are linked, never copied, from free
publishers: Python documentation, Python for Everybody, Harvard CS50P, freeCodeCamp,
Exercism, MDN, Pro Git, GitHub Docs, pytest, Requests, FastAPI, Django,
PostgreSQL, OWASP, Docker, NumPy, pandas, Matplotlib, seaborn, scikit-learn,
Kaggle Learn, Google ML Crash Course, Khan Academy, OpenIntro, 3Blue1Brown,
Automate the Boring Stuff and others. Every resource is marked free and English.

`npm run check:learning-links` re-verifies all URLs (103/103 resolved on
21 November 2026; two remaining redirects are intentional version-less URLs).

## Verification (21 November 2026)

- Unit/render tests: catalog integrity and schema rejections, personalisation
  rules, progress maths, goal changes, weekly planning, project readiness,
  recommendations, API origin/auth/validation/rate-limit/error mapping, snapshot
  mapping, dashboard/preview/topic/portfolio/read-only rendering.
- `npm run db:validate:learning`: applies the migration in an always-rolled-back
  transaction and checks RLS isolation, anonymous denial, duplicate prevention,
  constraints, server timestamps, goal change and cascade (passed on development).
- Browser QA (Edge, 1440/820/390px) of dashboard, intro, roadmap, overview map,
  topic dialog and preview: no console errors, no horizontal scroll, dialog
  focus/Escape behaviour verified.
- Migration applied to **development** on 21 November 2026. `node
  scripts/test-account-live.mjs --learning-only` (real Supabase Auth and
  database, temporary accounts deleted afterwards) **passed**: dashboard, search,
  preview-then-save, topic progress persisted across reload, goal change keeps
  progress, resume, API validation, career-target redirect, 320/768/1440px.
  This run found and fixed a bug where ticked completion criteria were cleared
  when a save re-rendered the dialog, and a goal badge that overflowed at 320px.

## Remaining work (next steps, highest value first)

1. Apply `202611210001_learning_progress.sql` to production only when a release
   is authorised (development is done).
2. Add more guided paths with the same depth (JavaScript/web, SQL, data).
   Career roadmaps currently cover the other directions at a shallower level.
3. Persist project evidence into normalised portfolio records once the portfolio
   project contract exists (today: prepared entry + links to existing tools).
4. Use observed job-requirement frequencies from live listings in career gaps,
   labelled with source and freshness (currently per-listing skills only).
5. Weekly reminders/schedules and history of completed milestones.
