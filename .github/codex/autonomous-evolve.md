# CareerForge bounded evolution task

Act as the repository's principal full-stack maintainer. Follow `AGENTS.md` and the owner requirements it links before editing.

The workflow has already synchronized `src/data/roadmap.json` and exported privacy-threshold product signals. Read:

- `src/data/roadmap.json`
- `diagnostics/latest-issues.json`
- `diagnostics/roadmap-feedback.json`
- `.github/codex/run-context.md`
- recent `git log` and the files linked by the highest-priority actionable item

Implement exactly one bounded change: the highest-priority reproducible bug, performance bottleneck, or UX friction item that has enough repository evidence to fix safely. Prefer diagnostic errors over votes, and friction reports over passive upvotes. If no signal is actionable, limit changes to genuine upstream roadmap synchronization; do not invent a fix or analytics result.

Constraints:

- Never modify `.github/workflows/autonomous-evolve.yml`, repository permissions, secrets, deployment configuration, database credentials, generated client code, or unrelated features.
- Do not read or infer user identities. The exported files intentionally contain aggregate signals only.
- Preserve Supabase session verification, RLS ownership, truthful demo labels, reduced-motion behavior and mobile support.
- Do not auto-merge, deploy, contact people, submit applications, buy services or weaken email/account verification.
- Keep the patch small enough for one review. Add or update focused tests for the selected behavior.
- Run the relevant checks available in the repository. The workflow will independently rerun the complete verification suite.
- Update the affected node in `src/data/roadmap.json`. Add one `selfHealedLog` entry only when an actual diagnosed issue was fixed and verified. Do not mark planned work done without linked code evidence.
- In the final message, use three short sections: `Before`, `After`, and `Verification`. Name the selected signal and any remaining limitation.
