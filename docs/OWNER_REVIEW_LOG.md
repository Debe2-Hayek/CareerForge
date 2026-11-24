# Owner review log

A short, plain-language note for every feature built, so it can be reviewed later and act as a
reminder. Newest first. Each entry: **what** it does, **where** to find it, **how to try** it,
**status**, and **remember** (anything still pending). Technical details live in the linked docs.

Status words: **Live** = on careerforge-phi.vercel.app. **Ready** = built and tested on development,
waiting for its production database step and merge. **Waiting on credits** = works, but its AI
part needs OpenRouter credits before it gives real answers.

---

## Languages with levels, proved by test scores (PR #26)
- **What:** Users list the languages they speak, each at a CEFR level (A1–C2 or Native), optionally
  with a test result (IELTS, TOEFL, Duolingo, Cambridge, DELF/DALF, TCF, Goethe). Code converts the
  score into the level it supports, so the user is warned while typing ("IELTS 7.0 supports C1,
  lower than the C2 you claim") and the reviewer sees the same comparison plus whether the result is
  older than its 2-year validity. Each language is a claim: proof file or link → reviewer → badge.
  Editing a language after sending proof means new proof is needed.
- **Also fixed:** approving a record that the owner edited after sending proof used to hang for about
  15 seconds and say "did not finish"; it now says why at once (affected degrees and jobs on the live site).
- **Where:** Profile details (`/account/history#languages`), Verify page (`/account/verification`,
  new Languages group), admin review (`/admin/claims`).
- **Try:** add "English, C2, IELTS 7.0" and watch the warning; send any file as proof; review it as admin.
- **Status:** Ready. No AI used.
- **Remember:** production needs migrations 202611250002 and 202611250003. Next steps: a CareerForge
  timed language test (reading/listening), and showing language badges on the CV.
- **Docs:** [CLAIMS.md](CLAIMS.md) (Languages section).

## Proof integrity: copied, edited and forged proof; issuer links (PR #25)
- **What:** Catches fakers who reuse someone else's proof. Every file is fingerprinted on the admin
  side and compared with other accounts: identical file, same PDF text, same certificate number,
  near-identical image (re-saved or with an edited name). A file whose fingerprint was forged on the
  way in is shown in red. Users can add public certificate links from known sites only; Coursera
  certificates are checked with Coursera automatically (is the holder the same person?).
- **Where:** `/admin/claims` (under each file), "Add a verification link" on `/account/verification`.
- **Try:** upload the same diploma from two test accounts; add a Coursera link that is not yours.
- **Status:** Ready. No AI used.
- **Remember:** production needs migration 202611250001. Credly and other sites are opened by hand
  (they block automatic reading). Two real diplomas from the same template also look "near-identical":
  compare names, dates and numbers.
- **Docs:** [CLAIMS.md](CLAIMS.md) (Proof integrity).

## Career assistant chat (PR #24)
- **What:** A chat that answers career questions using only the parts of the profile the user ticks.
  Links only to real CareerForge pages; chats are not saved; 20 messages a day.
- **Where:** `/career-assistant`.
- **Status:** Live. Waiting on credits (or an `OPENAI_API_KEY` in Vercel to use OpenAI instead).
- **Docs:** [ASSISTANT.md](ASSISTANT.md).

## Project interviews (PR #23)
- **What:** A student proves a project is theirs: CareerForge reads their public GitHub repo, the AI
  prepares four questions about their own code, they answer in 20 minutes, an admin reviews.
- **Where:** `/account/projects` (student), `/admin/interviews` (admin).
- **Status:** Live. Waiting on credits.
- **Remember:** the real-AI test needs one of your public GitHub repos.
- **Docs:** [PROJECT_INTERVIEWS.md](PROJECT_INTERVIEWS.md).

## Career analysis (PR #22)
- **What:** Scores the profile against all 34 career roadmaps (code computes the scores) and an AI
  coach explains the real gaps.
- **Where:** `/career-analysis`.
- **Status:** Live. Scores work now; the AI explanation is waiting on credits.
- **Docs:** [CAREER_ANALYSIS.md](CAREER_ANALYSIS.md).

## CV vs job analysis (PR #21)
- **What:** Compares the profile with a job posting: a code score (skills, experience, role, education),
  next steps, and an AI explanation that may only mention real gaps.
- **Where:** `/cv-analysis`.
- **Status:** Live. Scores work now; the AI explanation is waiting on credits.
- **Docs:** [CV_ANALYSIS.md](CV_ANALYSIS.md).

## Timed skill checks for any skill (PR #20)
- **What:** The AI drafts question banks for any skill; an admin edits and publishes them; students
  take timed checks; a pass makes the skill "Verified".
- **Where:** `/admin/skill-checks` (studio), `/skill-checks` (students).
- **Status:** Live. Published banks work now; drafting new banks is waiting on credits.
- **Docs:** [SKILL_CHECKS.md](SKILL_CHECKS.md).

## AI proof check (PR #19)
- **What:** In the review queue the AI reads a diploma or certificate and code compares the name,
  institution, title and dates with the claim. A hint only; the reviewer decides.
- **Where:** `/admin/claims` → "Run AI check".
- **Status:** Live. Waiting on credits.

## Claims, proof and trust badges; profile strength ring (PR #18)
- **What:** Every degree, job and skill has a badge (Self-declared → Proof submitted → Reviewed /
  Verified). Users upload private proof; admins approve or reject with a reason. The profile ring
  shows how complete and proven the profile is.
- **Where:** `/account/verification`, `/admin/claims`, ring on `/account`.
- **Status:** Live. Admin: 102230023@mu.edu.lb.
- **Remember:** admins cannot review their own claims; use a second account to test.
- **Docs:** [CLAIMS.md](CLAIMS.md).

## AI profile autofill and "Generate with AI" (PR #17)
- **What:** Upload a CV (or paste notes) and the AI fills the profile; every value is checked against
  the source so nothing is invented. The builder's "Generate with AI" writes real drafts.
- **Where:** `/account` ("I have a CV"), the CV & Portfolio builder.
- **Status:** Live. Waiting on credits.
- **Remember:** AI usage limits: 5 per user per day per feature, 150 per day site-wide, answers
  cached 30 days. Add credits at openrouter.ai/settings/credits (no redeploy needed).
- **Docs:** [AI.md](AI.md).
