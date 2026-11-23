# Supplied CV and portfolio builder integration

Owner update, 29 October 2026: the updated supplied component belongs inside
CareerForge under one **CV & Portfolio** navigation entry. This replaces the
previous separate CV/portfolio entry points and standalone builder shell.
Comments and provider suggestions in the supplied source are implementation
material, not independent authorization to enable services or certify facts.

## Source and routes

`src/components/PortfolioBuilder.jsx` preserves the owner's supplied editor,
portfolio/CV views and visual controls. CareerForge adds only documented
integration hooks around that core: initial saved state, change reporting and
the notes-panel collapsed state. The account command bar, autosave, publication
workflow and responsive shell live in `supplied-document-builder.tsx` and
`supplied-builder.css`; they do not replace the supplied document designs.

The canonical private destination is `/documents`, rendered within the existing
CareerForge `AppShell`. The sidebar and feature directory have one **CV & Portfolio**
entry. The component retains its own Web portfolio/CV tabs and original layouts,
colors, light/dark mode, photo control, editing, effects and print action. It
starts with its original Web portfolio tab. Legacy `/cv` and `/portfolio` links
redirect to `/documents`.

Saved-profile CV functionality remains at `/cv/saved`; reviewed publication
management remains at `/portfolio/publication`. Both are contextual account tools
under the merged navigation entry. Existing reviewed public snapshots remain at
`/p/[slug]`; builder websites use `/u/[slug]` and do not change that contract.

## Workspace organisation

The page is organised as one document studio rather than a collection of
unrelated controls:

- A command bar identifies the studio and groups save/live status into compact
  badges. Its primary actions are **Notes editor** and **Publish website** (or
  **Manage live site**); saved-profile CV and reviewed profile portfolio remain
  quieter account tools.
- Opening publication expands one labelled region below the command bar, keeping
  the address, publish/update action, live link and take-offline control together.
- The editor area contains the private notes panel and one preview stage. The
  stage's view, theme, CV-style and print controls form its own toolbar; its hint
  and preview share one bordered visual surface.
- The page uses one document scroll. The desktop command bar stays below the app
  header while the narrow-phone version returns to normal document flow, avoiding
  a large sticky control block.

Workspace controls use CareerForge tokens. Portfolio themes remain scoped to the
document preview, so changing a CV/portfolio colour never recolours save,
publication or navigation controls.

## Editing and evidence boundaries

The update adds education/language editing, example contact details, contact icon
controls, printable contact information, a Download CV action, scroll progress
and back-to-top. Together with existing text, skill and photo controls, these let
users edit a CV and portfolio in the same builder.

For an available account store, notes, structured content, photos and appearance
choices autosave as an owner-only, revision-checked builder draft. A failed read
leaves a clearly labelled local sample builder with saving disabled. Publication
is separate and explicit: visitors see only the selected Web portfolio snapshot
at `/u/<address>`, never the private notes; later draft edits stay private until
the owner chooses **Update live site**. The component still starts with fictional
Sara Khoury/Google example content. Builder edits do not rewrite the normalized
profile, assessment evidence, saved-profile CV or reviewed profile publication,
and sample work history, contacts, education, languages and skills are not
validated claims.

The separate saved-profile CV still includes only selected skills with a current
supported passing assessment. Other profile details remain self-reported.
Publication management retains ownership, source/revision checks, explicit
approval, frozen selected-field snapshots and revocation. It remains separate
from explicit builder-site publication. Claim-specific validation remains future
work under R1.

## Generation compatibility

The editor posts `{ text }` to `/api/generate`. The authenticated,
same-origin, bounded-input compatibility route sends the notes to DeepSeek
when `DEEPSEEK_API_KEY` is set, validates the answer and removes every fact not
found in the notes (see [AI.md](AI.md)), then returns the data object the
supplied component expects. Errors are returned as the string it expects; the
daily limit returns 429 with `Retry-After`. The canonical versioned API
(`/api/v1/documents/generate`) returns `{ document }` and the standard error shape.

Without a key, valid requests still return HTTP 501 and the component shows its
labeled demo fallback. Its original `ANTHROPIC_API_KEY` hint remains unchanged
source text; that message appears only in this fallback.

## Notes collapse, motion and accessibility

The **Notes editor** control has an explicit **Hide notes** / **Show notes**
accessible name, exposes `aria-expanded`, and points through `aria-controls` to
the complete `builder-notes-panel` region. Collapsing does not unmount the editor,
so draft notes and generated edits remain intact. The hidden region receives
`aria-hidden` and `inert`, is removed from pointer and keyboard interaction, and
cannot retain focus while the preview uses the released space.

On wide layouts the notes column, panel opacity and horizontal position animate
together into a full-width preview. At 1000px and below, the builder stays one
column and the panel collapses vertically instead; the preview never becomes a
second off-screen column. Phone actions stack when necessary, saved-document
tools remain reachable, and coarse-pointer controls follow the existing 44px
target contract. `prefers-reduced-motion: reduce` removes grid, panel, chevron
and action transitions as well as the save-status pulse, while preserving the
same final expanded/collapsed states.

The builder uses a shared document scroll, with section anchors offset below the
workspace header and no nested panel/preview scrollers. The portfolio canvas is
fluid and centered, with symmetric gutters and a 1120px maximum width.

## Integration and acceptance

The source remains JSX with a TypeScript import declaration and narrowly scoped
lint exceptions. Wrapper CSS handles global-style collisions, narrow layouts and
shell-free printing while preserving the supplied portfolio and CV presentations.
It also keeps newly added skill chips visible when the supplied observer misses
them and reveals removal controls for touch and keyboard use. External fonts,
canvas effects and original accessibility behavior remain; comprehensive
accessibility or universal ATS compatibility is not claimed.

The additive appearance and portfolio-site migrations and their Prisma/API
contracts are retained. Builder draft persistence and explicit `/u/` publication
do not change the normalized profile or reviewed `/p/` publication records.

Acceptance covers one active desktop/mobile navigation entry; private
`/documents` access and legacy redirects; draft editing/autosave; explicit
publication; account-source isolation; animated and reduced-motion notes states;
responsive layout; print/PDF output; saved-profile CV and reviewed-publication
regressions; lint, types, tests and the offline production build.

## Verification - 22 November 2026

ESLint, strict TypeScript, all 192 unit/render tests and the offline production
build passed. The builder-only authenticated browser run passed at 320, 768,
1440 and 1920 CSS pixels and removed its temporary account and related records.
It verified the organised command bar, autosave/publication regressions, keyboard
and pointer notes toggling, `aria-expanded`/`aria-controls`, collapsed
`aria-hidden`/`inert`, hidden-focus denial, retained draft and preview edits,
released desktop preview width, single-column phone fit, reduced-motion behavior,
printing/CV controls and absence of horizontal overflow.

This evidence covers the tested Edge browser and responsive emulation. It does
not claim a physical-device, assistive-technology or universal print/ATS audit.
