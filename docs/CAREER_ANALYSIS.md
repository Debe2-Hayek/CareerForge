# Career analysis (report M2, FR-2.1 to 2.3)

`/career-analysis` scores every career roadmap (34 roles) for the signed-in user, ranks them,
and shows one career in detail (`?career=<id>`).

## The match is code

`src/lib/career-analysis/score.ts`, the same result every time for the same input:

- **Requirements** come from CareerForge's own career roadmaps (`src/data/roadmaps/`).
  Core topics in the first half of a roadmap are **Critical** (weight 3), core topics in
  the second half **Important** (weight 2); "good to know" and optional topics are
  **Optional** and never lower the match.
- **Evidence per topic**, strongest first: a skill proven by a passed check or reviewed
  proof (1.0), a self-declared profile skill (0.8), a topic marked known or completed on any
  roadmap (0.7), in progress (0.3), nothing (0). A profile skill covers a topic when it
  appears as whole words in the topic title ("Docker" covers "Containers with Docker";
  "SQL" does not cover "PostgreSQL").
- Score = weighted evidence / weighted total. Labels: Ready to apply (75+), Well on your way
  (50+), Building foundations (25+), Just starting.

Market demand from job postings is not used yet: development has 1 to 4 current postings per
career, too few to rank skills honestly. It can be added as a supplementary column once a career
has enough current postings.

## The AI only coaches (optional)

"Explain with AI" (`POST /api/v1/career-analysis/explain`) recomputes the match on the server,
sends the computed facts, and returns a short summary and up to three priorities. A code guard
keeps only priorities that are exact titles from the Critical or Important gap list and drops
text with numbers that are not in the inputs. Feature `career_analysis`: 5 per user per day,
cached (migration `202611240007_career_analysis_ai.sql`, which keeps every earlier AI limit).

## Design

Closest three careers as cards with a ring, a selector for any career, the chosen career's ring,
Critical and Important coverage bars, a hint to mark known topics when the match is low, the AI
coach, then the topics by priority (Gaps, Covered, All; six per group with "Show all").

## Checks

- Unit: `src/lib/career-analysis/career-analysis.test.ts` (matching, priorities, evidence
  weights, all 34 careers ranked with a web profile ranking a web career first, the guard, the
  endpoint with the test AI).
- Live on development with the test AI (`scripts/verify-career-analysis-live.mjs`): closest
  careers Full Stack 16%, Frontend 15%; React shown Proven; the coach answered and its invented
  priority was removed; any career selectable; signed-out API refused (401); screenshots in dark,
  light and phone. 23 November 2026. Rerun with the real AI once credits are added (1 call).

## Limitations

- Concept topics (for example "HTTP", "The DOM") count only when marked on a roadmap, so a new
  profile starts low; the page says how to raise it.
- Results are computed on each visit, not stored; there is no history of the match yet.
