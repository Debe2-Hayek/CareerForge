# Isolated preview deployment — 16 November 2026

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
- Vercel's preview environment contains only `APP_ORIGIN`,
  `NEXT_PUBLIC_SUPABASE_URL` and its public publishable key. Their values were
  passed through stdin and not printed. The production environment is not configured.
- `fra1` functions keep the application near the preview database. No paid plan,
  premium compute, custom domain purchase or production promotion was requested.

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

This is preparation evidence. Vercel build, HTTPS guest/account workflows,
two-user isolation and actual email delivery are not yet claimed as verified.
Do not promote this testing backend as production readiness. Hosted results belong
in the next entry when actually executed.
