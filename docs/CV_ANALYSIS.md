# CV analysis: your profile against a job (report M6, FR-6.2 / 6.4)

`/cv-analysis` compares the owner's **saved profile** with one job: a job saved in the
tracker, any visible listing (`/cv-analysis?job=<id>`, linked from the job dialog as
"Analyse my CV for this job"), or a pasted posting.

## The score is code (report 15.3)

`src/lib/cv-analysis/score.ts`, the same result every time for the same input:

| Factor | Weight | How |
| --- | --- | --- |
| Skills | 45% | The posting's skills (or skills detected in pasted text) against the profile. A Verified or Reviewed skill counts 1.0, a self-declared one 0.85, so proof raises the score. |
| Experience | 25% | Years the posting asks for (text, or its level: entry 0, mid 2, senior 5, lead 7) against the work history, overlapping jobs counted once. |
| Role fit | 15% | Words of the job title found in the headline, past roles or project. |
| Education | 15% | Whether the posting asks for a degree and the profile has education. |

A factor the posting gives no data for is left out and the rest are re-weighted. Labels:
Strong (75+), Good (55+), Partial (35+), Early stage. Next steps come from code too: take an
existing check, learn a missing skill, prove a self-declared one, add work history,
education or a clearer headline.

## The AI only explains (optional)

"Explain with AI" (`POST /api/v1/cv-analysis/explain`) recomputes the score on the server
(the browser's copy is never used), sends the computed facts to the AI, and returns a summary,
strengths, gaps and CV tips. A plain-code guard (`guardExplanation`) removes any item with a
number that is not in the inputs, any strength that names nothing the user has, and any
strength or CV tip that mentions a missing skill, and says how many were removed.
Feature `cv_analysis`: 5 per user per day, cached for the same profile and job
(migration `202611240006_cv_analysis_ai.sql`, which keeps every earlier AI limit).

## Checks

- Unit: `src/lib/cv-analysis/cv-analysis.test.ts` (overlap, determinism, weights, steps,
  pasted text, missing factors, the guard, the endpoint with the test AI).
- Live on development with the test AI (`scripts/verify-cv-analysis-live.mjs`): a saved demo
  job scored 85%, the AI explanation appeared and the guard removed the test AI's planted tip,
  a pasted Data Analyst job scored 33% with SQL missing, a direct link opened the right job,
  a cross-site request was refused; screenshots in dark, light and phone. 23 November 2026.
  Rerun with the real AI once credits are added (1-2 calls).

## Limitations

- Uses the saved profile, not an uploaded CV file (AI autofill turns a CV into a profile).
- Skills in live postings are detected by keyword and may be incomplete.
- Not a hiring prediction; the page says so.

## Related skills (24 November 2026)

- `src/lib/skill-match.ts` links each skill the job asks for to the profile: **exact** (same skill, any
  usual spelling: "postgres" = PostgreSQL), **shows** (a skill that demonstrates it: PostgreSQL shows SQL,
  Django shows Python, Next.js shows React and JavaScript, followed transitively) or **related** (a close
  alternative: MySQL for PostgreSQL, Vue for React, Azure for AWS). Exact and shows count as matched with
  the usual credit (1 proven, 0.85 self-declared); related earns half and is not shown as a match.
- Role fit treats job-title words with the same meaning as equal (engineer, developer and programmer;
  front end and frontend; and so on).
- The same relations let career analysis count a topic covered by a skill that shows it.
- **Where the list comes from:** `scripts/suggest-skill-relations.mjs` runs the Hugging Face model
  `Xenova/all-MiniLM-L6-v2` (Apache-2.0) offline over 140 skill names and saves the closest neighbours to
  `src/data/skills/model-neighbours.json`. A person reviewed them into `src/data/skill-relations.ts`:
  true links kept (PostgreSQL → SQL, Django → Python, Express → Node.js), noise dropped (the model also
  placed Java next to Salesforce, English and R), obvious missing links added (Next.js → React). The site
  never loads the model: its runtime (~300 MB) does not fit a Vercel function, and plain code keeps the
  score identical in the browser and on the server.
- Unit: `src/lib/skill-match.test.ts`. Live on development: `scripts/verify-skill-relations-live.mjs` (a
  profile with Django, MySQL and Next.js against a Backend Engineer posting: Python, SQL and JavaScript
  matched "via", PostgreSQL "close to your MySQL", Docker missing; 72%; dark, light and phone), plus the
  existing CV and career analysis live tests. Passed on 24 November 2026.
