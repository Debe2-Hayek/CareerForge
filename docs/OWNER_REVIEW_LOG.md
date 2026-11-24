# Owner review log

A short, plain-language note for every feature built, so it can be reviewed later and act as a
reminder. Newest first. Each entry: **what** it does, **where** to find it, **how to try** it,
**status**, and **remember** (anything still pending). Technical details live in the linked docs.

Status words: **Live** = on careerforge-phi.vercel.app. **Ready** = built and tested on development,
waiting for its production database step and merge (none right now). **Waiting on credits** = works, but its AI
part needs OpenRouter credits before it gives real answers.

---

## Downloadable workshop certificate with a QR code (PR #32)
- **What:** Learners can download their workshop certificate: "Download" on Workshops & certificates
  opens a printable A4 landscape certificate (name, result such as "passed the workshop assessment:
  88/100", workshop, dates, trainer, certificate id) with a QR code that opens the public check.
  "Print / save as PDF" saves it as one PDF page. Arabic names print correctly. Only the holder can open
  it (it shows their name); revoked certificates cannot be printed.
- **Where:** `/account/certificates` → "Download" → `/account/certificates/<id>/print`.
- **Try:** earn or create a test certificate, click Download, then Print / save as PDF.
- **Status:** Ready (no database change: merging is enough).
- **Remember:** the QR code was decoded with an independent reader and opens the exact check address.
- **Docs:** [WORKSHOP_CERTIFICATES.md](WORKSHOP_CERTIFICATES.md).
## Smarter skill matching with a Hugging Face model (PR #31)
- **What:** CV analysis and career analysis now understand related skills. "PostgreSQL" or "MySQL"
  on a profile counts for a job asking "SQL"; "Django" counts for "Python"; "Next.js" for React and
  JavaScript. A close alternative (MySQL for a job asking PostgreSQL) earns half credit and the next
  step says "your MySQL is a head start". Spellings like "postgres", "ReactJS" or "k8s" are understood,
  and job titles match by meaning ("Backend Engineer" = "Backend developer"). Each match says why
  ("via Django"). Example: a profile with Django, MySQL and Next.js went from almost no skill credit to
  72% for a Backend Engineer posting.
- **How Hugging Face was used:** the free all-MiniLM-L6-v2 model compared 140 skills and proposed the
  closest ones; a person kept only the true links (the model also paired Java with Salesforce and
  English). The reviewed list lives in the project, so matching stays instant, free and identical in the
  browser and on the server — the model is never loaded by the site (its runtime is ~300 MB, too big
  for Vercel functions).
- **Where:** `/cv-analysis` (skill list shows "via …" and "close to your …"), `/career-analysis`
  (topic details say e.g. "Next.js (shows React)").
- **Status:** Ready (no database change: merging is enough).
- **Remember:** to extend the list, run `scripts/suggest-skill-relations.mjs` and review its proposals
  into `src/data/skill-relations.ts` — never copy them blindly.
- **Docs:** [CV_ANALYSIS.md](CV_ANALYSIS.md) (Related skills).

## Free text check: reads scans and photos with OCR, no AI credits (PR #29)
- **What:** In the review queue, "Read the file" makes CareerForge read a proof file on its own
  server — the PDF's text, or OCR for scans and phone photos, in English, French and Arabic — and
  look for the claimed name, institution, degree and year, plus any registration numbers printed on
  it. It works today without OpenRouter credits, and the file is never sent anywhere. Bonus: a photo
  and a PDF of the same certificate now match across accounts by their text, and the AI check (once
  credits exist) reads scanned PDFs through this text instead of giving up.
- **Why not Hugging Face here:** checked on 24 Nov 2026. Hugging Face OCR models that run inside
  the server are either line-only (TrOCR) or too heavy (Florence-2), and Hugging Face's hosted API
  would send private diplomas to a third party with a tiny free allowance. Tesseract (open source,
  Apache-2.0) read every test word for word in about 0.3–2.5 s.
- **Where:** `/admin/claims`, "Text check · free · no AI" under each file.
- **Try:** upload a photo of a certificate from a test account and click "Read the file".
- **Status:** Live since 24 Nov 2026.
- **Remember:** production migrations applied 24 Nov 2026. Finding the words does
  not prove a file is genuine; missing words can be an OCR miss — the page says so.
- **Docs:** [CLAIMS.md](CLAIMS.md) (Free text check).

## CareerForge workshops with verifiable certificates (PR #28)
- **What:** CareerForge can now run its own workshops and issue certificates anyone can check online.
  An admin creates a workshop, assigns a trainer (by their account email) and records where the signed
  trainer agreement is kept. Learners enroll and choose whether their name shows on the public check.
  After the session starts the trainer marks attendance (and scores, for assessed workshops); after it
  ends they issue certificates — only to those who qualify, only once. Admins can revoke one with a
  reason; its public check then says "Revoked". Valid certificates appear on the checked-profile page.
  Certificates always say they are not an accredited qualification.
- **Where:** admin `/admin/workshops` (new "Workshops & certificates" tab); learners and trainers
  `/account/certificates` (linked from the Verify page); public check `/certificates/<id>`.
- **Try:** create a workshop as admin, assign yourself or a test account as trainer, enroll with another.
- **Status:** Live since 24 Nov 2026. No AI used.
- **Remember:** production migrations applied 24 Nov 2026. Real
  trainer agreements must be signed outside CareerForge first; only their reference is recorded.
  Not yet: certificate PDFs, emails, trainer sign-up requests.
- **Docs:** [WORKSHOP_CERTIFICATES.md](WORKSHOP_CERTIFICATES.md).

## Checked-profile page for employers; ✓ marks on the CV (PR #27)
- **What:** A user can switch on a private link (off by default) to a page that lists only what
  CareerForge checked: reviewed degrees, jobs and languages, skills passed in a timed check, and
  project interviews, each with how and when. Nothing self-declared, no files, no contact details.
  The saved CV marks reviewed entries with ✓, lists languages, and prints the link so an employer can
  confirm it; a published portfolio shows "See the facts CareerForge checked". If a checked record is
  edited it disappears from the page until checked again. "Make a new link" kills the old one;
  switching off stops the page (and the portfolio link) at once.
- **Where:** switch and preview on the Verify page (`/account/verification`), public page `/v/<link>`,
  CV at `/cv/saved`, portfolio footer on `/u/<name>`.
- **Try:** get one fact reviewed, turn the link on, open it in a private window.
- **Status:** Live since 24 Nov 2026. No AI used.
- **Remember:** production migrations applied 24 Nov 2026. The page is hidden from
  search engines; only people with the link can open it.
- **Docs:** [CLAIMS.md](CLAIMS.md) (Checked-profile page).

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
- **Status:** Live since 24 Nov 2026. No AI used.
- **Remember:** production migrations applied 24 Nov 2026. Next steps: a CareerForge
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
- **Status:** Live since 24 Nov 2026. No AI used.
- **Remember:** production migrations applied 24 Nov 2026. Credly and other sites are opened by hand
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
