# Skill checks: AI-drafted, admin-approved, server-timed

Requirement R1 asks for skill validation "via questions that are well prepared and a time
limit". Students can take a check for any skill an admin has published; passing marks the
skill **Verified** (CareerForge check) on the verification page, the profile and the CV.

## How a check is made

1. **Draft** at `/admin/skill-checks` (admins only). Type a skill and an optional focus, then
   **Draft with AI** (5 practical questions, 3 options, one answer, an explanation each) or
   **Write them myself** (works without AI).
2. **Review.** Plain code (`reviewDraft` in `src/lib/skill-check-drafts.ts`) blocks publishing
   when a question is missing, too short, has duplicate or empty options, uses "all/none of the
   above", or repeats another question; it warns when every answer sits in the same position,
   when the correct option is much longer than the others, or when an explanation is missing.
3. **Publish.** `publish_skill_check_draft` checks the same rules again in the database, then
   stores only `id`, `prompt`, `options` and `answer` as the next version of that skill in
   `careerforge_internal.skill_check_banks`. Explanations stay in the draft.

## How a check is taken (unchanged, now for any skill)

- The skill must be on the student's profile. Only the latest version can be started.
- The server sets the deadline (10 minutes, or 100 with extended time), grades in the database
  (4 of 5 to pass) and enforces a one-minute pause between attempts.
- Answer keys never reach the browser: the catalogue strips them.
- Earlier passes stay valid when a new version is published.

## Data and limits

- Migration `202611240005_skill_check_drafts.sql`: banks keyed by (skill, version) with a
  publish date and source; `skill_check_drafts` (admins only); functions to save, publish and
  discard drafts and an admin overview with attempts and pass rate; the AI ledger gains
  `skill_bank_draft` (20 drafts per admin per day, cached per skill and focus).
- This migration replaces `reserve_ai_run` with all four AI features, so it is ordered after
  `202611240004_evidence_checks.sql` (branch built on PR #19).

## Checks

- Unit: `src/lib/skill-check-drafts.test.ts` and the updated skill check tests.
- Live on development with the test AI (`scripts/verify-skill-checks-live.mjs`): draft, a broken
  question blocks publishing, fix, save, publish v1 (no explanations published), a student takes
  the check without seeing answers, scores 5/5, sees Verified; v2 published, v1 can no longer be
  started, the pass stays valid; students are denied the studio; screenshots. Passed on
  23 November 2026. Rerun with the real AI once credits are added (about 3 AI calls).

## Limitations

- Five questions per version, the same for everyone taking that version. A larger pool with
  random selection per attempt would make sharing answers harder; that is a next step.
- A check covers fundamentals; it is not proof of identity, professional level or mastery.
