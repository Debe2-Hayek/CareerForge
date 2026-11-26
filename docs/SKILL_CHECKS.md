# Skill checks: AI-drafted, admin-approved, part of verification

Requirement R1 asks for skill validation "via questions that are well prepared and a time
limit". On 26 Nov 2026 the owner asked to remove the time limit; fairness now comes from the measures
below instead (a deliberate change from the report's wording). Students can take a check for any skill an admin has published; passing marks the
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

## How a check is taken (since 26 Nov 2026: no clock)

Migration `202611260002_untimed_skill_checks.sql`; functions `start_untimed_skill_check` and
`submit_untimed_skill_check` (the timed `start_skill_check` and `submit_timed_skill_check` are revoked).

- **Part of verification.** A pass is CareerForge's own confirmation (the "Verified" level). Checks are
  offered from the Verification page (the check opens in a dialog there), `/skill-checks`, the
  profile's skills, job details (skills in the posting that have a check), skill roadmaps, career
  analysis gaps and CV-analysis next steps; `/skill-checks?skill=React` opens one check directly.
- **No time limit.** An attempt stays open until it is sent or ended; an abandoned one lapses after
  24 hours. Answers are kept on the device (sessionStorage) so leaving or reloading loses nothing.
- **A new order every attempt.** The server stores a random question order and, per question, a random
  option order; the browser answers in that order and the server maps the answers back before grading.
  Answer keys never reach the browser.
- **24 hours after a failed attempt** before the same skill can be taken again (other skills are not
  blocked; a later pass ends the wait). One minute between any two attempts, as before.
- **One step from the profile.** If the skill is not on the profile, the person can add it and start in
  one step (`p_add_to_profile`), up to the 40-skill limit.
- Only the latest version can be started; earlier passes stay valid. 4 of 5 to pass.
- One question at a time with a progress bar, a review screen, and a result that says what changed
  (pass: links to the CV and to matching jobs; not yet: the retry time and the free roadmap).

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
