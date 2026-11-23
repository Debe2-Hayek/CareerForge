import { claimStatusInfo, type ClaimStatus } from "@/lib/claims/model";

/** Trust level chip: a colour dot plus a word, so meaning never depends on colour alone. */
export function ClaimBadge({ status, compact = false }: { status: ClaimStatus; compact?: boolean }) {
  const info = claimStatusInfo[status];
  return <span className={`claim-badge tone-${info.tone}${compact ? " compact" : ""}`} title={info.help}>
    <span className="claim-badge-dot" aria-hidden="true" />{info.label}
  </span>;
}
