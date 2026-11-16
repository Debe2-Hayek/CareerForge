# Isolated preview deployment — 16 November 2026

Live site: **https://careerforge-phi.vercel.app**.

Deployed application commit: `5b292015977b27f89deddb5d1926fc160bb1e61a`.
Current deployment: `dpl_2EtzAhw1iGTusp2Tu3q2JLc6mE6h`, confirmed READY with the
assigned domain and `fra1` functions. The application uses an isolated test backend.

The owner authorized GitHub synchronization and deployment. Main at `7ff15ac`
already contained preview PR #1 and four later profile/CV/Auth changes. The exact
main commit's GitHub CI passed. Local main was safely fast-forwarded; unrelated
`.vscode/settings.json` was preserved.

## Resources prepared

- Vercel Hobby team `izodox`, ID `team_fogkxdwXw2dDTxBmWcZIl9SV`.
- Project `careerforge`, ID `prj_1LLsErtIuzjf9R9mcGbYbMug59SQ`, Node 22.
- Assigned and verified domain: `https://careerforge-phi.vercel.app`.
- New default Free Supabase organization `CareerForge Preview`,
  ID `wsdlovqdubtdwrywaqka`.
- New project `CareerForge Preview`, ref `gmrribyxcpcmqlqhdwea`, Frankfurt
  (`eu-central-1`), created empty expressly for nonproduction preview/testing.
- All seven canonical SQL migrations were applied transactionally with the same
  advisory lock and `careerforge_internal.migrations` checksums used by the local
  runner. Every one of its eight application tables has RLS enabled.
- Its Auth Site URL is the assigned HTTPS origin. The only additional redirect
  is `https://careerforge-phi.vercel.app/auth/callback`. Email confirmation and
  undeclared Auth settings were preserved.
- Vercel's Preview and Production environments contain only `APP_ORIGIN`,
  `NEXT_PUBLIC_SUPABASE_URL` and its public publishable key. Their values were
  passed through stdin and not printed. No direct database credential is configured.
- `fra1` functions keep the application near the preview database. No paid plan,
  premium compute or custom domain purchase was made. Vercel refused Preview as
  the first deployment and required its Production slot. This was an empty new
  hosting project with no existing traffic; that slot still uses the isolated
  nonproduction backend. Later Preview deployments are supported.

The database password is retained only as Windows-user-encrypted local state in
ignored `.deployment/`; it is not part of GitHub or the Vercel source artifact.
The preview starts without existing local/production accounts or personal records.

## Scope and approval-review outcomes

The existing local environment points to the repository's documented shared
development project `nzgbryjdluzkdfmrpsep`. Its pending additive history migration
was applied with the existing checksum runner; no existing profile data was
replaced. Its history/RLS validation passed inside a fully rolled-back transaction,
with no fixture records retained.

Automatic approval review rejected uploading direct PostgreSQL credentials to
Vercel. That command did not execute. Source inspection confirmed hosted private
APIs use Supabase user sessions/RLS; direct Prisma access is only a disabled-in-
production development diagnostic. The build now generates Prisma without a
datasource URL, and the preflight requires only the three public settings.
Connection-based local tools still require explicitly configured credentials.
The revised public-only upload succeeded; no privileged credential transfer was
retried.

Review also rejected an Auth configuration change on the existing project after
the CLI identified its main branch as production. Its Auth settings were not
modified. The safe alternative was the new isolated Free preview backend above;
only that newly created preview received the hosted Site URL and callback.
Existing project accounts and settings are not copied into the preview.

## Verification before publication

- All 98 unit tests pass, including the public-only deployment configuration and
  disabled production database-probe contracts.
- Full lint passes.
- Prisma generation and the complete deployment build/TypeScript pass with
  `DATABASE_URL` and `DIRECT_URL` explicitly blank.
- The first local build encountered stale `.next/dev/types` references from the
  older Auth route locations. Only the generated route validator/type files were
  cleared; the rerun passed without source-route changes.
- Remote preview migration ledger/checksums and table RLS were verified.
- A deployment source copy is made from a Git archive; private environment files,
  local provider state, encrypted credentials and unrelated IDE files are excluded.
  The provider dry run inspected 249 upload files (3,191,697 bytes), recognized
  Next.js and found none of the private local paths.

## Published result and hosted verification

The owner explicitly approved pushing commit `5b29201` to `main`. Its
[GitHub CI run](https://github.com/hussein-hayek-mu/CareerForge/actions/runs/43830813961)
succeeded: Prisma generation, lint, type checking, 98 unit tests, offline build
and all 38 desktop/mobile browser checks passed.

The first cloud deployment became READY but the live login check found incorrect
public configuration: the key-selection helper had selected its display `prefix`
instead of its full `api_key`. The helper now selects only an actual publishable
`api_key` (or a verified legacy anon role), validates it against the public Auth
settings endpoint and never selects a secret/service-role key. Updated the public
settings and rebuilt without build cache. No application-source change was needed.
The first deployment is superseded by the current READY deployment above.

Actual hosted verification then passed:

- HTTPS homepage and app-health 200; baseline response headers; production
  database diagnostic 404; anonymous private APIs 401. Server-rendered private
  pages use Next's documented streamed redirect marker; real desktop/mobile
  browsers subsequently reached `/login`.
- Two temporary confirmed test identities signed in through the live app.
  Sessions were Secure, HttpOnly and SameSite=Lax. Profile writes survived later reads;
  foreign-origin writes were denied.
- Education/work history, precise GPA, create retries, update revisions and stale
  write denial worked. Saved-profile CV included the owner's saved history.
  A second account saw none of the first account's records, through both app APIs
  and direct Supabase reads using that second user's session and the public key.
- The fictional catalog and tracker save, duplicate save, Applied status,
  persistence, owner isolation and removal worked.
- Authenticated password update, old-password rejection, new-password login and
  logout denial worked without sending recovery email.
- Real desktop/mobile browsers rendered the floating landing navigation and
  signed in through the actual form, with no horizontal overflow or page errors.
  Hosted screenshots were reviewed.
- Test identities were created only in the newly created isolated backend;
  passwords were generated by the database and kept only in test-process memory.
  Exact fixture IDs were used for cleanup. All temporary accounts and their
  cascading private records were removed; cleanup confirmed zero remaining.

No real signup/confirmation/reset messages were sent or inbox delivery verified.
Email confirmation remains enabled. The new backend still uses the default
Supabase test mailer, which sends only to organization-team addresses. Configure
[custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) before opening
confirmation/password-reset delivery to public users. These are hosted MVP preview
checks, not full production, physical-device or comprehensive accessibility
certification. Existing local accounts are not present in this separate backend.

Local encrypted administration state and detailed verification evidence remain in
ignored `.deployment/`; screenshots are in `test-results/hosted-preview/`.
