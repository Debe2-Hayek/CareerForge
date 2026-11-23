# Project interviews (requirement R1: catch fakers)

Anyone can copy a repository; explaining your own code is hard to fake. At
`/account/projects` a student links a public GitHub repository and answers four questions
about specific lines of it in 20 minutes; a reviewer decides at `/admin/interviews`.

## Flow

1. **Ownership.** CareerForge gives a one-time code (`careerforge-xxxxxxxxxxxx`). The student
   adds it to the repository's README or a `.careerforge` file on the default branch.
2. **Questions.** The server reads the latest commit (only `api.github.com` and
   `raw.githubusercontent.com`, HTTPS, no redirects, size and time limits), checks the code,
   picks up to six source files (no generated, vendor, test or tiny files), and asks the AI
   for four questions, each naming a file and at most 12 lines. **The quoted lines are copied
   from the file by code**; questions pointing to lines that do not exist are dropped.
3. **Interview.** The database's clock sets a 20-minute deadline; answers after it are refused
   and the interview expires.
4. **Review.** "Run AI review" runs from the reviewer's session: it re-reads the repository at
   the recorded commit, re-checks the ownership code, confirms each quoted line still matches
   the repository, and asks the AI to score each answer 0 to 2 against the surrounding code.
   Plain code totals the scores and suggests "fits the code well", "mixed" or "does not fit".
   The reviewer approves or rejects with a reason; reviewers cannot decide their own.

## Why the review re-reads the repository

CareerForge's server acts with the student's own session, so a student could call the
database functions directly and store easy questions of their own. The reviewer-side check
catches this: forged questions do not match the repository and the card shows
"✗ N of N questions do not match the repository". The AI's scores are stored in a column
students cannot read.

## Limits and settings

- Migration `202611240008_project_interviews.sql`; AI features `interview_questions`
  (3 per student per day, cached per commit) and `interview_review` (40 per admin per day).
  `reserve_ai_run` lists every AI feature.
- At most 3 open interviews per student.
- Optional `GITHUB_TOKEN` (server-only, read-only public scope) raises GitHub's limit of 60
  unauthenticated requests per hour per server address; one interview uses about 10.
- Development: with `AI_FAKE=1` (never in production or on Vercel) a built-in test GitHub
  serves a small fictional repository that contains the requested ownership code.

## Checks

- Unit: `src/lib/project-interview/project-interview.test.ts`.
- Live on development (`scripts/verify-project-interviews-live.mjs`): ownership, questions with
  real quotes, the 20-minute deadline in the database, submission; answers after the deadline
  refused; questions forged directly in the database flagged 3 of 3 by the reviewer's AI review;
  students cannot read AI scores; approve and reject with a reason; screenshots. Passed
  23 November 2026 with the test AI and test GitHub. Rerun with the real AI and a real public
  repository once credits are added.

## Limitations

- Public GitHub repositories only.
- A well-rehearsed copier may still answer; a nervous author may answer poorly. The reviewer
  decides, and the page says so.
- An approved interview is shown on the project interviews page; it is not yet a badge on the
  CV or public portfolio.
