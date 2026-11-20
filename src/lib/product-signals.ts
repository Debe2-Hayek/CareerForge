import { z } from "zod";
import { failure, isSameOrigin, json } from "@/lib/account/http";
import { readBoundedJson } from "@/lib/account/request-body";
import { privateWriteLimit } from "@/lib/account/attempt-limit";
import { productRoadmap } from "@/lib/product-roadmap";

export const diagnosticKinds = ["ui-error", "promise-rejection", "api-error", "slow-api", "rage-click", "empty-search", "abandoned-flow"] as const;
export const diagnosticLabels = ["Unhandled UI error", "Unhandled promise rejection", "API error response", "Slow API response", "Rage click pattern", "Repeated empty search", "Abandoned flow"] as const;
export const diagnosticSignalSchema = z.object({
  fingerprint: z.string().regex(/^[a-f0-9]{8,64}$/),
  kind: z.enum(diagnosticKinds),
  route: z.string().min(1).max(160).regex(/^\/[^?#]*$/),
  label: z.enum(diagnosticLabels),
  durationMs: z.number().int().min(0).max(120000).optional()
}).strict();
const feedbackSchema = z.object({
  nodeId: z.string().regex(/^[a-z0-9-]{1,120}$/),
  kind: z.enum(["upvote", "friction"]),
  summary: z.string().trim().min(8).max(500).optional()
}).strict().superRefine((value, context) => {
  if (value.kind === "friction" && !value.summary) context.addIssue({ code: "custom", path: ["summary"], message: "Friction reports require a summary" });
  if (value.kind === "upvote" && value.summary !== undefined) context.addIssue({ code: "custom", path: ["summary"], message: "Upvotes do not accept text" });
});

export type DiagnosticSignal = z.infer<typeof diagnosticSignalSchema>;
export type FeedbackInput = z.infer<typeof feedbackSchema>;
export type FeedbackCounts = Record<string, { upvotes: number; frictionReports: number }>;
export type DiagnosticSummary = DiagnosticSignal & { occurrences: number; affectedUsers: number; lastSeen: string };
export type ProductSignalAccess = {
  userId: string;
  feedback: (input: FeedbackInput) => Promise<void>;
  diagnostic: (input: DiagnosticSignal) => Promise<void>;
};

type Limit = (scope: "feedback" | "diagnostics", userId: string) => number;
const nodeIds = new Set(productRoadmap.nodes.map(node => node.id));
function rateLimited(wait: number) {
  const response = failure("RATE_LIMITED", "Too many product signals. Please wait and retry.", 429);
  response.headers.set("Retry-After", String(wait));
  return response;
}

export function feedbackHandlers(authorize: () => Promise<ProductSignalAccess | null>, readCounts: () => Promise<FeedbackCounts>, limit: Limit = privateWriteLimit) {
  return {
    async GET() {
      try { return json({ counts: await readCounts() }); }
      catch { return failure("SIGNALS_UNAVAILABLE", "Roadmap signals are temporarily unavailable.", 503); }
    },
    async POST(request: Request) {
      if (!isSameOrigin(request)) return failure("FORBIDDEN", "This request must come from CareerForge.", 403);
      const parsed = feedbackSchema.safeParse(await readBoundedJson(request, 2048));
      if (!parsed.success || !nodeIds.has(parsed.data.nodeId)) return failure("INVALID_INPUT", "Choose a current roadmap node and valid feedback type.", 400);
      try {
        const access = await authorize();
        if (!access) return failure("UNAUTHORIZED", "Sign in to shape the product roadmap.", 401);
        const wait = limit("feedback", access.userId);
        if (wait) return rateLimited(wait);
        await access.feedback(parsed.data);
        return json({ counts: await readCounts() }, 201);
      } catch { return failure("SIGNALS_UNAVAILABLE", "Your roadmap signal could not be saved. Please retry.", 503); }
    }
  };
}

export function diagnosticHandlers(authorize: () => Promise<ProductSignalAccess | null>, readSummary: () => Promise<DiagnosticSummary[]>, limit: Limit = privateWriteLimit) {
  return {
    async GET() {
      try { return json({ privacyThreshold: 3, issues: await readSummary() }); }
      catch { return failure("DIAGNOSTICS_UNAVAILABLE", "Diagnostic summary is temporarily unavailable.", 503); }
    },
    async POST(request: Request) {
      if (!isSameOrigin(request)) return failure("FORBIDDEN", "This request must come from CareerForge.", 403);
      const parsed = diagnosticSignalSchema.safeParse(await readBoundedJson(request, 1024));
      if (!parsed.success) return failure("INVALID_INPUT", "The diagnostic signal is not valid.", 400);
      try {
        const access = await authorize();
        // Diagnostics never interrupt the experience or encourage anonymous identifiers.
        if (!access) return json({ recorded: false, reason: "authentication_required" }, 202);
        const wait = limit("diagnostics", access.userId);
        if (wait) return rateLimited(wait);
        await access.diagnostic(parsed.data);
        return json({ recorded: true }, 202);
      } catch { return json({ recorded: false, reason: "storage_unavailable" }, 202); }
    }
  };
}
