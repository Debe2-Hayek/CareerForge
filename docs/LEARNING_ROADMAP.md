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
   respects prerequisites, an evidence ladder, *Reset progress* (two-step
   confirmation; goal and pace are kept), and two views:
   - **Roadmap** (default, 21 November 2026): an interactive graph in the style
     of roadmap.sh — a vertical spine of phase cards with progress bars, topic
     cards on both sides joined by dotted connectors, a fork into the
     specialisation columns that rejoin at the career phase. Zoom (buttons,
     wheel, pinch), pan (drag), mini-map, *Fit to view*, search with keyboard
     results that jumps to a topic, *Jump to next topic*, hover/selection that
     highlights the full prerequisite chain (lime, before) and everything it
     unlocks (blue, after) with a "N prerequisites · M topics build on it" note,
     *Focus mode* that hides everything else and closes the gaps, and *Show all
     prerequisites*. Cards show status (completed struck through, known,
     in progress, needs prerequisites, optional dashed) and the next topic.
     Every topic card is a real link with a full description ("Loops. Needs
     prerequisites. About 4 hours. Open details."); Tab walks all topics in
     order and the canvas follows focus; the view survives opening and closing
     a topic. Opens centred on the next topic (or the selected one).
   - **List** (`?view=list`): the accessible vertical timeline.
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
| Graph layout (pure, tested) | `src/lib/learning/graph-layout.ts` |
| Interactive graph (React Flow) | `src/components/learning/roadmap-graph.tsx` |
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

## Graph engine

- **Data-driven**: the graph is derived from the curriculum (phases, topics,
  `prerequisites`, `branch`), never drawn by hand. Adding a topic to
  `src/data/learning/*.ts` places it automatically.
- **Layout** (`layoutRoadmap`, server-side and deterministic): title, then each
  shared phase on the spine at x = 0 with its topics split into a left and a
  right rail; a fork row with one column per specialisation (topics on a rail
  below the branch head); the career phase rejoins every branch. Tests assert no
  overlapping boxes, every topic placed exactly once, determinism, every node
  reachable from the title, member edges only from the topic's own phase, one
  edge per prerequisite, and correct ancestor/descendant sets.
- **Rendering** (`RoadmapGraph`, client): `@xyflow/react` 12 (MIT) supplies the
  viewport, zoom/pan, mini-map and controls. Nodes are not draggable or
  selectable (the layout is the product); prerequisite edges are computed but
  drawn only for the highlighted chain or with *Show all prerequisites*, which
  keeps the default picture as calm as roadmap.sh's.
- **Why not roadmap.sh's data**: roadmap.sh publishes its graph as React Flow JSON
  (`roadmap.sh/python.json`: 124 nodes, 31 edges; topics/subtopics, dotted
  `0.8 8` connectors, no prerequisite edges, a static rendering). It was studied
  for structure only; nothing was copied (see licensing below). CareerForge's
  graph adds what roadmap.sh's does not have: per-learner status and progress,
  real prerequisite relations, path highlighting, search, focus mode, the next
  recommended topic and goal-based optional/excluded branches.
- **Reset**: `POST /api/v1/learning/reset` (`{ courseId, confirm: true }`,
  same-origin, authenticated, rate-limited) deletes the learner's progress rows
  for one path under RLS; the enrolment (goal, level, hours) is kept.

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

## Guided paths

- **Python** (`python`): 61 topics, 11 phases, backend/data/ML/automation
  specialisations, 12 projects. 21 November 2026 added lambdas and closures,
  regular expressions, type hints, packaging (pyproject/uv), and an *Advanced
  Python* phase (decorators, context managers, async/await with asyncio,
  threads/processes and the GIL, algorithms and complexity); linting now covers
  Ruff and logging.
- **JavaScript & Web Development** (`web-development`, added 22 November 2026):
  46 topics, 8 phases (web basics, HTML & CSS, JavaScript fundamentals, browser
  JavaScript, professional tooling, React, Node.js, career), goals foundations /
  front end (React) / back end (Node.js) / full stack (both), 8 projects from a
  landing page to a deployed full-stack job tracker. Resources: MDN, web.dev,
  javascript.info, The Odin Project, freeCodeCamp, React/Node/Express/Vite/Vitest/
  TypeScript docs, OWASP and W3C WAI.
- Career roadmaps link each step to the matching topic: web-only steps to the web
  path, shared steps (Git, testing, SQL, APIs) to the path that suits the track
  (`src/lib/learning/career-links.ts`, tested so every link resolves).
- `check:learning-links`: 200/200 resources resolved on 21 November 2026 (two
  intentional redirects: Django "stable", 3Blue1Brown's topic URL).

## Remaining work (next steps, highest value first)

1. Done 21 November: migrations applied to the hosted project and released.
2. Add more guided paths with the same depth (SQL & data, mobile, DevOps).
   Career roadmaps currently cover the other directions at a shallower level.
3. Persist project evidence into normalised portfolio records once the portfolio
   project contract exists (today: prepared entry + links to existing tools).
4. Use observed job-requirement frequencies from live listings in career gaps,
   labelled with source and freshness (currently per-listing skills only).
5. Weekly reminders/schedules and history of completed milestones.
6. Graph: show projects as milestone nodes, let learners collapse phases, and
   add a printable/static export of the graph.
