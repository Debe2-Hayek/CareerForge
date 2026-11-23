# Claims, proof and trust badges (requirement R1, part 1)

Every fact on a profile (an education record, a job, a skill) has a trust level:

| Badge | Meaning | How it is reached |
| --- | --- | --- |
| Self-declared | Added by the owner, no proof | Default |
| Proof submitted | Proof uploaded, waiting for a reviewer | Owner uploads a PDF/PNG/JPG at `/account/verification` |
| Reviewed | A CareerForge reviewer compared the proof with the claim | Admin approves at `/admin/claims` |
| Verified | Confirmed by CareerForge itself | A passed CareerForge skill check (React, SQL) |
| Not accepted | The reviewer rejected the proof, with a reason | Admin rejects (a reason is required) |
| Changed since proof | The owner edited the record after sending proof | Automatic: proof applies to the exact record revision |

"Verified" is kept for things CareerForge or the issuer actually confirmed. A reviewer
looking at a document can only say "Reviewed": a convincing fake can pass a visual check.

## Data and security

- `supabase/migrations/202611240003_claims.sql`: `claims`, `claim_evidence`,
  `claim_events` (append-only history), the private `claim-evidence` storage bucket, and
  three functions: `submit_claim_evidence`, `review_claim`, `claim_review_queue`.
- Clients can only read their own rows; admins can read all. Every write goes through
  the functions, which check ownership, the record revision and the reviewer role.
- Admins are users whose `profiles.role` is `admin`. Users cannot change their own role
  (column grants exclude it), so only the database owner can appoint reviewers.
  Reviewers cannot decide their own claims.
- Files: `<owner id>/<random id>.<ext>`, at most 4 MB, at most 5 per claim. The type is
  detected from the file's first bytes, not its name. Owners upload into their own
  folder; owners and admins can read; reviewers open files through 10-minute signed links.
- The same file (SHA-256) uploaded by different accounts is flagged in the queue.
- Approval is tied to the record revision: editing a reviewed record (for example
  changing the university) drops the badge to "Changed since proof".

## Profile strength ring

`src/lib/profile-strength.ts` scores the profile out of 100 across seven steps: name and
headline (15), a short story (10), 3+ skills (15), education (15), work or a project (15),
first proof (10), a confirmed fact (20). The next unfinished step is the call to action.
If verification data cannot load, the profile still opens and those steps show as not done.

## Checks

- Unit: `src/lib/claims/claims.test.ts` (trust levels, file types, strength, handlers).
- Live on development: `scripts/verify-claims-live.mjs` creates two students and an admin,
  uploads proof (including the same file twice), approves, rejects with a reason, checks
  the badges, the ring, the not-found page for non-admins, "Changed since proof", and takes
  screenshots; then deletes accounts and files. Passed on 23 November 2026 (ring 60% → 90%).
- Test accounts for manual checks on development: `scripts/dev-test-accounts.mjs` writes
  passwords to the git-ignored `.deployment/dev-test-accounts.txt`.

## AI proof check (part 2)

In the review queue each file has an **AI pre-check** (`POST /api/v1/admin/claims/check`):

- The AI only **reads** the file: PDF text (`unpdf`) or the image itself (vision). It returns
  the person's name, issuer, title, dates, certificate number, verification address and up to
  five neutral notes (`src/lib/claims/evidence-check.ts`, prompt `evidence-check.v1`).
- **Plain code compares** that with the claim and the owner's name: Matches / Does not match /
  Not found on the document / Compare yourself (different scripts, partial wording).
  Overall: Consistent, Needs your attention, or Could not be read (scanned PDF without text).
- Only admins can run and store checks (`record_evidence_check`), so owners cannot plant a
  favourable result. Results are hints: the panel reminds reviewers that fakes can read perfectly.
- Cost: runs only when clicked; cached per file fingerprint; 60 per admin per day (migration
  `202611240004_evidence_checks.sql`), within the 150-per-day site limit.
- Development "test AI": start the dev server with `AI_FAKE=1` to click through without credits.
  It is ignored in production and on Vercel, and its results are labelled "test AI, not real".
- Live check: `scripts/verify-ai-check-live.mjs` (PDF and photo, both checked, stored, reload,
  student denied). Passed on development with the test AI on 23 November 2026; rerun it with the
  real AI once credits are added (2 AI calls).

## Limitations and next steps

- Files of a deleted account stay in storage (database rows are deleted); a cleanup job
  is needed before many users delete accounts.
- Non-admins opening `/admin/claims` get the not-found page with HTTP 200, because the
  site-wide loading boundary streams before the role check. No queue data is loaded, and
  the review API returns 403.
- Badges are not yet shown on the public portfolio or the saved-profile CV.
- Next: scanned PDFs (page images), automatic checks of issuer verification links, and
  AI-prepared, admin-approved timed questions for more skills.
