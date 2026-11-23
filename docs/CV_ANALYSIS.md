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
