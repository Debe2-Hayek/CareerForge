# Owner review log

A short, plain-language note for every feature built, so it can be reviewed later and act as a
reminder. Newest first. Each entry: **what** it does, **where** to find it, **how to try** it,
**status**, and **remember** (anything still pending). Technical details live in the linked docs.

Status words: **Live** = on careerforge-phi.vercel.app. **Ready** = built and tested on development,
waiting for its production database step and merge (none right now). **Waiting on credits** = works, but its AI
part needs OpenRouter credits before it gives real answers.

---

## Skill checks: no timer, part of verification, and connected everywhere
- **What:** Skill checks are now clearly part of verification: passing one is the fastest way to make a
  skill Verified ✓. There is **no time limit** any more: take your time, leave and come back, even reload;
  your answers wait. To keep it fair without a clock, every attempt shows the questions and the answers in
  a **new order**, the server does the grading, and after a failed attempt you can try that skill again
  **24 hours later** (you see exactly when). The check itself is calmer: one question at a time with a
  progress bar, keys A B C, a review screen before sending, and a clear result (pass: "React is now
  Verified" with links to your CV and to jobs that ask for React; not yet: when you can retry, plus the free
  roadmap).
- **Connected where it belongs:** the Verification page (the check opens right there in a window), your
  profile (skills that have a check get a direct link), job details (skills in the posting that have a check),
  skill roadmaps ("Prove React when you are ready"), career analysis gaps ("Prove it"), CV analysis next steps,
  and `/skill-checks?skill=React` opens a check directly. A skill that isn't on your profile can be added and
  started in one click.
- **Note:** your project report (requirement R1) mentions "a time limit"; this follows your request to remove it.
- **Where:** `/skill-checks`, `/account/verification`, `/account`, `/jobs`, `/learning-roadmap/react`, `/career-analysis`.
- **Status:** Live since 26 Nov 2026 (migration 202611260002 applied to production, PR #49).

## My profile, CV & Portfolio and the homepage slider, redesigned
- **My profile:** the form is now grouped like a settings page in a well-made app: The basics, Your story,
  Education and Skills, each with a one-line explanation on the left and the fields on the right. Skills
  are tags: type one and press Enter (or paste a list); suggestions are the skills employers ask for; proven
  skills show a ✓. A small map at the top of the form shows each part with a ✓ once it is filled in, and
  jumps to it; your sign-in email sits apart, in the shortcuts card. The save bar stays quietly at the end and only follows you down the page when there is
  something to save, with a Discard button. Once all seven profile steps are done, the checklist steps aside.
- **No CV or portfolio yet?** The profile shows one clear card, "You don't have a CV or portfolio yet",
  with a picture of the result and a button to CV & Portfolio. After saving, the message points there too.
  Once you have one, a side card shows "Your portfolio is live" with its link (or "Finish and publish").
- **CV & Portfolio:** the top bar is one calm row: the name, "Saved" and "Live at /u/…" on the left; Notes,
  a "More" menu (saved-profile CV, profile portfolio) and one main button (Publish website / Manage live
  site) on the right. The notes panel opens with the three steps: write, generate, edit and publish.
  The editing toolbar is one row: Web portfolio / CV, then only the controls that change what you see (CV
  style; colour for the portfolio and the Modern CV; light or dark for the portfolio), and Download PDF as the
  main button. One short line under it says what the chosen CV style is for.
- **Homepage:** the 3D ring is replaced by a 2D slider. Tabs on top (Profile, Skill checks, Roadmaps,
  Workshops, CV, Jobs, Applications, AI assistant, Portfolio); each slide explains the tool with three
  points and a true number, next to a live-looking example of the tool itself (a profile with checked
  facts, a skill-check question, a roadmap, a certificate, a CV, matched jobs, an application board, an AI
  answer, and a portfolio website like the builder's). All examples use one fictional person and say
  "Example". Swipe, drag, arrows, tabs or the keyboard; it moves on by itself only while you are not using it.
- **References used:** Mobbin (edit-profile and settings screens from Base44, Buy Me a Coffee, Flodesk and Lindy;
  feature-tab sections from Ada and Heron AI), SaaSFrame (user-profile and empty-state guides), Page Flows (profile
  flows), Godly, Dribbble and Awwwards for overall polish. Principles only; nothing copied.
- **Where:** `/account`, `/documents`, the homepage "Everything inside" section.
- **Status:** Live since 26 Nov 2026 (PR #48, no database change).

## AI assistant: chats are saved to your account, and the page looks like ChatGPT or Claude
- **What:** Every chat with the AI assistant is saved to your account, like ChatGPT or Claude. Come back to a
  helpful chat any time: after a refresh, another page, signing out, or on your phone. A sidebar lists your
  chats by day (Today, Yesterday, Previous 7 days...); click one to continue it, rename it, search them, start
  a "New chat", or delete one or all. Each chat has its own link, so a refresh reopens the same chat. If the page
  closes while an answer is being written, the answer is still saved. The page now looks like the chat apps
  people know: one calm reading column, answers as clean text next to the globe with numbered and bulleted
  lists, your messages in soft bubbles, and one message box with the "Share" choices inside it. A new chat shows
  the greeting, the box and the suggestions together in the middle. On phones the chat list slides in from the
  menu button.
- **Privacy:** only you can see your chats (checked by the database itself, not just the page). Delete any chat,
  or all of them, whenever you like; deleting your account deletes them too.
- **Where:** `/career-assistant`.
- **How to try:** ask a question, then refresh, sign out and in again, or open it on your phone: the chat is in
  the sidebar. Rename it with the pencil, delete it with the bin.
- **Status:** Live since 26 Nov 2026 (migration 202611260001 applied to production, PR #47).

## A full showcase test case, and three builder fixes it found
- **What:** A new script, `scripts/demo-showcase.mjs`, runs CareerForge end to end on the development copy with the
  real AI, as one fictional student (Karim Nassar, a computer science graduate in Beirut), and writes a pass/fail
  report with screenshots. 15 test cases: new account; AI reads his CV and fills the profile; languages with an
  IELTS score; proof for the degree and the English score; a reviewer runs the AI check and approves; a React
  skill check; a workshop certificate issued by a trainer and checked by a visitor; the best jobs saved and
  tracked; CV vs job with an AI explanation; career analysis with the AI coach; the AI assistant; a CV and
  portfolio written by AI from rough notes and published as a website; the public page of checked facts; and the
  Overview in dark, white and phone views. Result: **15/15 passed**. The demo accounts stay on the development copy
  so they can be shown; their passwords are only in the private `.deployment` folder. Each run starts clean.
- **Bugs it found and fixed (CV & Portfolio builder):**
  - After "Generate with AI", missing contact details were kept from the built-in sample, so a real person's
    portfolio could show the sample's email, phone, LinkedIn and GitHub. Now only details the person typed are kept.
  - If the AI found nothing usable in the notes, the builder wiped the preview and still said "Done". Now it keeps
    the preview and explains what to write.
  - Names, job titles, companies and projects that come back all in lowercase get capitals ("karim nassar" →
    "Karim Nassar", "bs in computer science" → "BS in Computer Science"); sentences stay as written.
  - The demo-mode note no longer mentions an old AI key.
- **Where:** `/documents`, published portfolios; the script in `scripts/`.
- **Status:** Live since 26 Nov 2026 (PR #46, no database change).


## Faster, more private CV & Portfolio page
- **What:** Measured every signed-in page on a real production build (signed in): all answer in 0.25–0.5 s
  with no heavy browser work. The learning roadmap and workshops were fine (their earlier slow numbers were
  development-mode overhead). One page needed work, CV & Portfolio:
  - **One session check instead of two:** the page asked Supabase "who is this?" twice in a row before
    loading your draft. Now once, which makes the page about 0.5 s faster to arrive.
  - **Fonts from CareerForge, not Google:** the builder's two typefaces were fetched from Google Fonts when
    it appeared (so each visitor's address went to Google, and the big name could flash in a fallback font).
    They are now served by CareerForge itself, preloaded. Published portfolios use the same fonts.
  - **The top of the preview appears at once:** its fade-in now starts on the first paint instead of
    waiting for the page's script; sections further down still fade in as you scroll.
  - Result on the production build: the builder is fully drawn about 0.9 s after opening the page.
- **Where:** `/documents` and published portfolios (`/u/<name>`).
- **Tests:** the full account live test passes (it includes the builder, saving and publishing).
- **Status:** Live since 25 Nov 2026 (no database change).


## Faster "Find opportunities": short descriptions first, full text when you open a job
- **What:** The jobs page used to download every job's full description (about 900 characters each, 182
  jobs). Cards only show the first lines, so the list now gets a short excerpt (cut at a word, ending in "…"),
  and when you open a job its full description loads at once from a new private endpoint. The page went from
  354 KB to 263 KB. Search, filters, matching and saving work exactly as before.
- **Where:** `/jobs`, and the job window.
- **Tests:** new unit tests (one job by id, bad ids refused, anonymous callers refused, missing jobs 404,
  excerpts cut on a word). The live jobs test passes (176 listings, filters, paging, layouts). Its counts now
  skip expired or stale listings, as the page always has.
- **Status:** Live since 25 Nov 2026 (no database change).


## Friendlier forms everywhere (with a human touch)
- **What:** Every form now shares one calm, clear design, in both dark and white mode, with small touches
  that make it feel alive and easy.
  - **All fields:** bigger, softer inputs (48 px tall, 16 px text on phones so nothing zooms), a clear glow
    when you click in, a red ring with a message only after you have tried (never while you start typing), a
    small ✓ once a required field is filled correctly, tidy dropdown arrows, and a spinner on the button while
    a form is working. Errors arrive with a small nudge; good news pops in.
  - **Sign in and register:** a greeting for the time of day ("👋 Good evening, welcome back"), a show/hide
    password button, a Caps Lock warning, and when registering a live checklist (12+ characters, lowercase,
    uppercase, number, symbol) that ticks green as you type, plus "✓ Passwords match". Password reset uses the
    same fields.
  - **Profile:** live counters on the headline and long texts ("39 / 160", amber near the limit), your skills
    appear as chips while you type, and a floating "Unsaved changes" save bar stays in reach while you edit.
    Long names, headlines and skills now wrap instead of pushing the page sideways (an older layout bug).
  - **Education & work:** friendly examples in each field ("For example: BS in Computer Science").
  - **CV analysis:** "(optional)" stays next to its label, so the two fields line up.
  - **Jobs and applications:** the technical notes at the top moved into a small "About your data" section,
    like the Overview, so the pages open on what matters.
- **Where:** `/login`, `/register`, `/reset-password`, `/account`, `/account/history`, `/cv-analysis`,
  `/jobs`, `/applications`, and every other form (proof links, languages, skill checks, workshop submission).
- **Tests:** the full account live test passes again. Several old checks were updated to today's pages
  (the profile skills list, the constellation, the "More" features group, folded "Coming soon" tools, the
  learning gap summary), and two flaky steps were made reliable.
- **Status:** Live since 25 Nov 2026 (no database change).


## Faster Overview: 79% less to download
- **What:** The Overview used to download the whole job catalogue (up to 500 listings with descriptions) but
  only shows the 2 best matches. The server now picks the best 6 and sends only those, plus your tracked
  roles. The page went from 318 KB to 67 KB, which matters most on phones. The journey steps now load at
  the same time as the job list instead of after it. Matching works exactly as before (the same ranking
  code is now shared by the page and the server, with a new test).
- **Where:** `/dashboard` (Overview).
- **Status:** Live since 25 Nov 2026 (no database change).
- **Remember:** "Find opportunities" (`/jobs`) still loads the full list, because its filters work on all
  jobs in the browser (354 KB). Moving its filters to the server is a possible next speed step.


## AI assistant: a turning wireframe globe (after the reel you shared)
- **What:** The assistant's round orb is replaced by a small 3D wireframe globe like the Instagram reel: a net
  of thin lines with a slightly broken, jagged surface, warm sparks flickering inside (gold, green, lilac) and two
  faint halo rings, slowly turning. When the assistant is thinking it spins faster and the sparks get busier.
  - **White mode:** black ink lines with gold sparks, very close to the reel. **Dark mode:** pale mint lines.
  - **Where it shows:** the big welcome globe, the header, the "thinking" bubble, and a still version on each
    reply (still, so long chats stay light). The sidebar "AI assistant" icon is now a small globe too, and the
    homepage AI card uses the mini globe.
  - Drawn on a small canvas (no 3D library, no extra download). It stops when off screen, in a hidden tab,
    with "reduce motion", or when the Motion switch is off.
- **Where:** `/career-assistant`, the sidebar, and the homepage ring's AI card.
- **Status:** Live since 25 Nov 2026 (no database change).


## Faster, richer 3D rings (homepage and workshops)
- **What:** Both 3D rings turn smoothly and can be scrolled with the mouse wheel.
  - **Smoother:** while a ring turns, only each card's position and fade change, so the browser no longer
    restyles the whole card every frame. When a new card reaches the front, only two cards are redrawn
    instead of all of them. Mini animations run on the front card only. Measured on a local production build:
    the long pauses at each turn are gone.
  - **Homepage ring "Everything inside":** each card now has a real photo (free CC0 photos already used by
    workshops) and a true number from the app's own data: 90 free roadmaps (34 careers, 56 skills, 2,222
    topics), 26 free workshops, 5 questions per skill check, 5 application stages, 20 free assistant questions
    a day, and more. A ninth card, "Workshops with certificates", was added. Photos load before the ring comes
    into view. It starts turning sooner (3.2 s per card) and shows "Scroll, drag or use ← →".
  - **Mouse wheel:** over the ring, each wheel notch turns one card; after the last card the page scrolls on.
  - **White mode:** card text is black on white, accent links use a deep shade of their colour so they stay
    readable, and the photo header stays dark so its numbers read on any photo.
  - **Workshops ring:** the same speed fixes, and it moves on a little sooner (4.2 s per card).
- **Where:** `/` (after The Forge) and `/workshops`.
- **Try:** hover the ring and scroll the mouse wheel; switch to white mode with the sun/moon button.
- **Status:** Live since 25 Nov 2026 (no database change).

## Tested with the real AI, and a fix for "Saved" disappearing after AI profile fill
- **What:** With the new OpenRouter key (which has credits), every AI feature was tested on development with the
  real AI (DeepSeek V4.1 Flash) instead of the test AI. Passed: AI proof check (read a diploma and matched name,
  university, degree and dates), AI-drafted skill checks, CV vs job explanation, career analysis, the AI
  assistant, AI profile fill from a CV, and "Generate with AI". The whole run cost about $0.003.
  - **Bug fixed:** after the AI filled in a new profile and you pressed Save, the profile became strong enough
    that the AI panel folded away mid-save, so the "Saved" message never showed (the data was saved). The panel
    now stays open until you leave the page.
  - Two tests were updated to match today's pages (the free text check panel; a slower list refresh).
- **Where:** `/account` (AI profile fill); tests in `scripts/`.
- **Status:** Live since 25 Nov 2026 (no database change).
- **Remember:** project interviews were not tested with the real AI: that needs a real public GitHub
  repository. Since 25 Nov 2026 the live site uses the new OpenRouter key (ends …5b66), so AI works there too.

## Slim sidebar, "Your career constellation" and the homepage 3D ring
- **What:** Three design upgrades, keeping every existing animation.
  - **Slim sidebar:** narrower (236 px, 212 px on smaller laptops) with tighter rows, so the whole menu fits
    without scrolling. The four unfinished tools (Academic planner, Application agent, Application insights,
    Graduation simulator) are folded into one "Coming soon (4)" row that opens and closes. Same order, same
    collapse button, same phone menu; search (Ctrl K) still finds everything.
  - **Your career constellation (Overview):** replaces the old film banner. Every fact
    in the profile (degree, work, skill, language) is a star: checked facts glow green, facts in review shine
    amber, facts only stated are dim, and dashed "+" stars invite the next one. The stars join into a
    constellation that draws itself, with short labels, a profile-strength ring, a count ("0 of 5 facts are
    checked") and one big next-step button. The film banner is gone; if proof data cannot load, the stars
    come from the profile's skills and education.
  - **Homepage 3D ring "Everything inside":** right after The Forge, the eight tools turn on a 3D ring, each
    card with its live mini-picture (profile, skill checks, CV, jobs, tracker, learning, AI assistant,
    portfolio), its own colour and a button into the tool. It turns by itself, stops under the mouse or
    keyboard, and can be dragged, swiped, or moved with the arrows, the dots or the arrow keys. It replaces
    the grid of the same eight tiles, so nothing is shown twice.
- **Where:** the sidebar on every workspace page; `/dashboard` (Overview); `/` (homepage, after The Forge).
- **Try:** open the Overview signed in; open "Coming soon" in the sidebar; on the homepage, scroll to
  "Everything inside", hover a card, drag it, or press the arrow keys.
- **Status:** Live since 25 Nov 2026 (PR #36, no database change).
- **Remember:** all motion follows "reduce motion" and the site's motion switch; the ring's pause button
  shares the workshops ring setting.

## Design pass: immersive AI chat, "Your path" Overview, The Forge homepage (PR #34)
- **What:** Three pages redesigned to attract and guide, keeping the navigation bar and every
  existing animation (particle background, motion switch, Overview film, workshop ring, profile ring).
  - **AI assistant:** one immersive card with a living, turning orb; sharing choices as toggle chips with
    "What is sent?"; a personal welcome ("Hi Rana, what's your next move?") with four illustrated starter
    cards; avatars on messages, replies that slide in, a thinking orb, Copy buttons, link chips, and a
    floating composer that grows as you type.
  - **Overview:** opens on "Your path": a greeting, four steps (build your profile, prove it, choose a
    direction, apply) worked out from the real account, and one big next-step button. The film hero
    stays; technical notes moved to "About your data".
  - **Homepage:** new "The Forge" section: a CV, diploma, skill check and certificate fly into a profile
    card with sparks, checked badges and a filling ring. Text updated to today's product (four steps,
    new marquee, AI assistant tile, corrected "planned" notes).
- **Where:** `/career-assistant`, `/dashboard`, `/`.
- **Status:** Live since 25 Nov 2026.
- **Remember:** animations follow "reduce motion" and the site's motion switch; mock-up canvas kept for
  reference (private Claude artifact "CareerForge redesign mock-up").

## Downloadable workshop certificate with a QR code (PR #32)
- **What:** Learners can download their workshop certificate: "Download" on Workshops & certificates
  opens a printable A4 landscape certificate (name, result such as "passed the workshop assessment:
  88/100", workshop, dates, trainer, certificate id) with a QR code that opens the public check.
  "Print / save as PDF" saves it as one PDF page. Arabic names print correctly. Only the holder can open
  it (it shows their name); revoked certificates cannot be printed.
- **Where:** `/account/certificates` → "Download" → `/account/certificates/<id>/print`.
- **Try:** earn or create a test certificate, click Download, then Print / save as PDF.
- **Status:** Live since 24 Nov 2026.
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
- **Status:** Live since 24 Nov 2026.
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
