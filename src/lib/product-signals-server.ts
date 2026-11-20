import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { DiagnosticSignal, DiagnosticSummary, FeedbackCounts, FeedbackInput, ProductSignalAccess } from "./product-signals";

const countRows = z.array(z.object({ node_id: z.string(), upvotes: z.coerce.number().int().nonnegative(), friction_reports: z.coerce.number().int().nonnegative() }));
const summaryRows = z.array(z.object({
  fingerprint: z.string(), kind: z.string(), route: z.string(), label: z.string(), occurrences: z.coerce.number().int().nonnegative(),
  affected_users: z.coerce.number().int().nonnegative(), max_duration_ms: z.coerce.number().int().nonnegative().nullable(), last_seen: z.string()
}));

async function feedbackCounts(client: SupabaseClient): Promise<FeedbackCounts> {
  const { data, error } = await client.rpc("roadmap_feedback_counts");
  if (error) throw new Error("Feedback totals unavailable");
  return Object.fromEntries(countRows.parse(data ?? []).map(row => [row.node_id, { upvotes: row.upvotes, frictionReports: row.friction_reports }]));
}

export async function readFeedbackCounts() { return feedbackCounts(await createClient()); }

export async function readDiagnosticSummary(): Promise<DiagnosticSummary[]> {
  const client = await createClient();
  const { data, error } = await client.rpc("diagnostic_signal_summary");
  if (error) throw new Error("Diagnostic summary unavailable");
  return summaryRows.parse(data ?? []).map(row => ({
    fingerprint: row.fingerprint,
    kind: row.kind as DiagnosticSummary["kind"],
    route: row.route,
    label: row.label as DiagnosticSummary["label"],
    ...(row.max_duration_ms === null ? {} : { durationMs: row.max_duration_ms }),
    occurrences: row.occurrences,
    affectedUsers: row.affected_users,
    lastSeen: row.last_seen
  }));
}

export async function authorizeProductSignals(): Promise<ProductSignalAccess | null> {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error) {
    if (error.status === 400 || error.status === 401 || error.name === "AuthSessionMissingError") return null;
    throw new Error("Session verification unavailable");
  }
  if (!user) return null;
  return {
    userId: user.id,
    async feedback(input: FeedbackInput) {
      const { error } = await client.from("roadmap_feedback").insert({ user_id: user.id, node_id: input.nodeId, kind: input.kind, summary: input.kind === "friction" ? input.summary : null });
      if (error?.code === "23505" && input.kind === "upvote") return;
      if (error) throw new Error("Feedback write failed");
    },
    async diagnostic(input: DiagnosticSignal) {
      const { error } = await client.rpc("record_diagnostic_snapshot", {
        p_fingerprint: input.fingerprint, p_kind: input.kind, p_route: input.route, p_label: input.label, p_duration_ms: input.durationMs ?? null
      });
      if (error) throw new Error("Diagnostic write failed");
    }
  };
}
