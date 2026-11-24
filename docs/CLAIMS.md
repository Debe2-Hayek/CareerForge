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
- Reused, re-saved and edited proof across accounts is flagged in the queue (see Proof integrity below).
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

## Proof integrity (part 3): reused, edited and forged proof

Migration `202611250001_proof_integrity.sql`. No AI and no credits are used.

**Fingerprints are recomputed on the admin side.** `submit_claim_evidence` stores the SHA-256 the
caller sends, and a user can call it directly from their own session, so that value can be
forged. Each time `/admin/claims` opens, it recomputes up to 10 files without a fingerprint
(waiting ones first) from the stored bytes and records them with `record_evidence_fingerprint`
(admins only; `evidence_fingerprints` is readable by admins only). A file whose sent fingerprint
differs from its real one is shown in red: it did not come through the upload form unchanged.
The AI proof check now caches by the real fingerprint, too.

**Matches across accounts** (`careerforge_evidence_matches`, shown under each file with a link to
the other account's file so both can be opened side by side):

| Match | How | Catches |
| --- | --- | --- |
| Identical file | Same real SHA-256 | Someone else's file uploaded as is |
| Same text | SHA-256 of a PDF's words (lower case, letters and digits only) | A PDF re-saved, re-printed or re-exported |
| Same certificate number | Number read by the AI proof check, letters and digits only, 5+ characters | Two people claiming one numbered certificate |
| Near-identical image | 64-bit difference hash (`sharp`), 10 bits apart or fewer | A picture re-saved, resized or recompressed, or the same design with an edited name |

Calibration on 23 November 2026 with generated certificates: re-saved, resized, blurred or cropped
copies were 2 to 7 bits apart; the same design with only the name, date or number edited was 0 to 1
bits apart; a different design was about 32 bits apart. Two genuine diplomas printed on the same
university template also match as "near-identical image", which is why the reviewer is told to
compare names, dates and numbers rather than reject on the match alone. Blank or solid images get no
image fingerprint.

**Verification links.** At `/account/verification` an owner can add the public verification link of
a certificate (up to 3 per fact, `add_claim_link`). Only known issuer sites are accepted, both in the
application (`src/lib/claims/issuers.ts`, host by host, https only, no user names or ports) and in
the database: Coursera, Credly, LinkedIn Learning, Microsoft Learn, freeCodeCamp, Udemy, Accredible,
HackerRank and DataCamp. In the review queue:

- **Coursera course certificates are checked automatically** (`POST /api/v1/admin/claims/link-check`,
  admins only). CareerForge fetches only the fixed address
  `https://www.coursera.org/account/accomplishments/verify/<code>`, follows redirects only within
  Coursera, reads at most 2 MB, and sends an honest `CareerForge-Verifier` user agent. It reads the
  holder, course, university and date from the page and compares the holder with the profile name
  (every part of the shorter name must appear, accents and case ignored, at least two parts).
  Results: Issuer confirms, Different holder, No certificate at this address, or Could not reach the
  issuer. Stored in `link_checks` (admins only).
- Other issuers render their pages in the browser, so the reviewer opens the link (shown with its
  full address, opened with `noopener noreferrer nofollow`).

Checked on 23 November 2026 against a real public Coursera certificate (holder, course, university and
date read correctly) and a made-up code (no certificate found).

- Unit: `src/lib/claims/proof-integrity.test.ts` (link allow-list and look-alike addresses, Coursera
  page reading, names, redirects and failures, image and PDF fingerprints, both endpoints).
- Live on development: `scripts/verify-proof-integrity-live.mjs`. Student A uploads a diploma (PNG and
  PDF). Student B sends A's PNG straight to the database with a forged fingerprint, uploads the same
  design with B's name and a re-exported copy of the PDF, and adds a real public Coursera link that
  belongs to someone else. The admin page fingerprints all 5 files and flags: altered fingerprint,
  identical file, same text, near-identical image, and "Different holder" from Coursera. Students can
  neither read nor write fingerprints or link checks, and look-alike or unknown sites are refused by
  the endpoint and by the database. Screenshots in dark, light and phone. Passed on 24 November 2026.

## Languages (part 4)

Migration `202611250002_languages.sql`. No AI and no credits are used.

- **Profile.** On Profile details (`/account/history#languages`) a user lists up to 10 languages, each
  at a CEFR level (A1 to C2) or Native, optionally with a test result: IELTS, TOEFL iBT, Duolingo
  English Test, Cambridge English, DELF/DALF, TCF, Goethe-Zertifikat or another test. Stored in
  `profile_languages`; written only through `save_profile_language` and `delete_profile_language`.
  A test needs a score; test dates cannot be in the future. Every change gives a new revision.
- **What the score supports** (`src/lib/languages.ts`, code only, checked 24 November 2026 against each
  test's published alignment): IELTS 8.5+ C2, 7–8 C1, 5.5–6.5 B2, 4–5 B1. TOEFL iBT 1–6 scale (since
  21 January 2026) 6 C2, 5 C1, 4 B2, 3 B1, 2 A2, 1 A1; the older 0–120 total 95+ C1, 72+ B2, 42+ B1 (it
  does not measure C2). Duolingo 155+ C2, 130+ C1, 100+ B2, 60+ B1. Cambridge English Scale 200+ C2,
  180+ C1, 160+ B2, 140+ B1, 120+ A2, 100+ A1. TCF 600+ C2, 500+ C1, 400+ B2, 300+ B1, 200+ A2, 100+ A1.
  DELF/DALF and Goethe certificates are issued at a level. Native counts as supported from C1 upwards.
  IELTS, TOEFL, Duolingo and TCF results are flagged when older than two years.
- **Claims.** Each language is a claim (`kind = 'language'`) with the same proof files, verification
  links, fingerprints and review as degrees. The user is warned while typing when the score is below
  the claimed level; the reviewer sees the claimed level, the stated result, what it supports and its
  age, and checks the report itself. Editing a language after sending proof shows "Changed since
  proof" and the old proof cannot be approved.
- **Fix in `202611250003_review_refusal_code.sql`.** Approving a record edited after its proof was sent
  used to wait about 15 seconds and say "The decision did not finish": `review_claim` refused with
  SQLSTATE 40001, which PostgREST retries as a serialization failure. It now uses 55000 and the reviewer
  sees the reason immediately. This also affected degrees and jobs on the live site.
- Unit: `src/lib/languages.test.ts` (every conversion, comparison, validity, form rules, endpoint,
  claim items and "changed" status).
- Live on development: `scripts/verify-languages-live.mjs` adds English C2 with IELTS 7.0 (warned),
  French B2 with DELF B2 and Arabic native; refuses a duplicate; checks the database refuses direct
  writes, other users' rows and a test without a score; sends a score report; the admin sees "lower than
  claimed"; the user corrects the level; the old proof cannot be approved (immediate message); new proof
  is approved and shows Reviewed; removing a language works. Screenshots in dark, light and phone.
  Passed on 24 November 2026.
- Not yet: a CareerForge timed language test (reading/listening), and language badges on the CV.

## Checked-profile page (part 5)

Migration `202611250004_trust_page.sql`. No AI.

- **Owner control** on the Verify page: an on/off switch (off by default), the link with Copy and Open,
  "Make a new link" (the old link stops working) and a preview of exactly what visitors see
  (`my_confirmed_facts`). Stored in `trust_pages` (owner-readable only; written by `set_trust_page`).
- **Public page** `/v/<random id>` (`get_trust_page`, callable without signing in, returns nothing when
  off or unknown; not indexed; no-store): name, headline and only checked facts with method and date:
  reviewed degrees, jobs and languages whose record is unchanged since review; skills passed in a
  CareerForge check (or reviewed proof); approved project interviews. No files, notes, emails or
  self-declared facts. A footer explains what each method does and does not prove.
- **CV** (`/cv/saved`): reviewed entries get "✓ Proof reviewed by CareerForge", languages are listed with
  their badge, and when sharing is on the link is printed at the end.
- **Portfolio**: `get_public_portfolio_site` also returns the owner's link while sharing is on; the
  published site footer shows "See the facts CareerForge checked".
- Unit: `src/lib/trust-page.test.ts` (formatting, rendering as text only, switch endpoint, CV marks).
- Live on development: `scripts/verify-trust-page-live.mjs` (preview, switch on, signed-out visitor sees
  only the 4 checked facts and not the pending job, the edited job, a self-declared skill or the email;
  no anonymous table or preview access; CV link and marks; portfolio link; editing removes a fact; new
  link kills the old; switch-off stops the page and the portfolio link; dark, light and phone). Passed on
  24 November 2026.

## Limitations and next steps

- Files of a deleted account stay in storage (database rows are deleted); a cleanup job
  is needed before many users delete accounts.
- Non-admins opening `/admin/claims` get the not-found page with HTTP 200, because the
  site-wide loading boundary streams before the role check. No queue data is loaded, and
  the review API returns 403.
- Badges are not yet shown on the public portfolio or the saved-profile CV.
- Image matches compare whole pictures: a heavily cropped photo of a diploma, or a photo taken
  at an angle, may not match. Matching is a full scan per file; fine for thousands of files, an
  index is needed beyond that.
- Only Coursera course certificates are confirmed automatically; specialisation certificates and
  other issuers are opened by the reviewer.
- Next: scanned PDFs (page images), more issuers checked automatically when they publish
  readable pages or an API, and certificates issued by CareerForge workshops.
