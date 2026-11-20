export type ExportedIssue = {
  fingerprint: string; kind: string; route: string; label: string; occurrences: number; affectedUsers: number;
  durationMs?: number; lastSeen: string; priorityScore: number;
};
export type ExportedFeedback = { nodeId: string; upvotes: number; frictionReports: number; priorityScore: number };

const issueWeight: Record<string, number> = {
  "ui-error": 90,
  "promise-rejection": 85,
  "api-error": 84,
  "abandoned-flow": 68,
  "rage-click": 62,
  "slow-api": 58,
  "empty-search": 52
};

export function prioritizeIssues<T extends Omit<ExportedIssue, "priorityScore">>(issues: T[]): Array<T & { priorityScore: number }> {
  return issues.map(issue => ({
    ...issue,
    priorityScore: Math.min(100, (issueWeight[issue.kind] ?? 40)
      + Math.min(6, Math.floor(Math.log2(Math.max(1, issue.occurrences))))
      + Math.min(4, Math.max(0, issue.affectedUsers - 3))
      + (issue.durationMs && issue.durationMs > 3000 ? 2 : 0))
  })).sort((left, right) => right.priorityScore - left.priorityScore || right.occurrences - left.occurrences || left.fingerprint.localeCompare(right.fingerprint));
}

export function prioritizeFeedback(counts: Record<string, { upvotes: number; frictionReports: number }>): ExportedFeedback[] {
  return Object.entries(counts).map(([nodeId, count]) => ({
    nodeId,
    upvotes: count.upvotes,
    frictionReports: count.frictionReports,
    priorityScore: Math.min(100, count.frictionReports * 8 + count.upvotes * 2)
  })).sort((left, right) => right.priorityScore - left.priorityScore || left.nodeId.localeCompare(right.nodeId));
}
