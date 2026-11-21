import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { productRoadmap } from "../src/lib/product-roadmap";
import { prioritizeFeedback, prioritizeFriction, prioritizeIssues } from "./product-signals-export-lib";

const root = resolve(process.cwd());
const diagnosticsPath = resolve(root, "diagnostics/latest-issues.json");
const feedbackPath = resolve(root, "diagnostics/roadmap-feedback.json");
const frictionPath = resolve(root, "diagnostics/friction-queue.json");
const maxBytes = 1024 * 1024;
const issueSchema = z.object({
  fingerprint: z.string().regex(/^[a-f0-9]{8,64}$/),
  kind: z.enum(["ui-error", "promise-rejection", "api-error", "slow-api", "rage-click", "empty-search", "abandoned-flow", "not-found"]),
  route: z.string().regex(/^\/[^?#]*$/).max(160),
  label: z.enum(["Unhandled UI error", "Unhandled promise rejection", "API error response", "Slow API response", "Rage click pattern", "Repeated empty search", "Abandoned flow", "404 dead end"]),
  durationMs: z.number().int().min(0).max(120000).optional(),
  occurrences: z.number().int().nonnegative(),
  affectedUsers: z.number().int().min(3),
  lastSeen: z.iso.datetime({ offset: true })
}).strict();
const diagnosticsSchema = z.object({ privacyThreshold: z.literal(3), issues: z.array(issueSchema).max(1000) }).strict();
const feedbackSchema = z.object({ counts: z.record(z.string(), z.object({ upvotes: z.number().int().nonnegative(), frictionReports: z.number().int().nonnegative() }).strict()) }).strict();

function trustedOrigin() {
  const value = process.env.EVOLUTION_SOURCE_ORIGIN ?? process.env.APP_ORIGIN;
  if (!value) throw new Error("EVOLUTION_SOURCE_ORIGIN is not configured");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("EVOLUTION_SOURCE_ORIGIN must be a bare HTTPS origin");
  return url.origin;
}

async function fetchJson(origin: string, path: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${origin}${path}`, { headers: { Accept: "application/json" }, signal: controller.signal, redirect: "error" });
    if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > maxBytes) throw new Error(`${path} response is too large`);
    const text = await response.text();
    if (Buffer.byteLength(text) > maxBytes) throw new Error(`${path} response is too large`);
    return JSON.parse(text) as unknown;
  } finally { clearTimeout(timer); }
}

async function writeIfChanged(path: string, value: unknown) {
  const next = `${JSON.stringify(value, null, 2)}\n`;
  const previous = await readFile(path, "utf8").catch(() => "");
  if (next !== previous) await writeFile(path, next, "utf8");
}

async function main() {
  const origin = trustedOrigin();
  const knownNodes = new Set(productRoadmap.nodes.filter(node => node.acceptsFeedback).map(node => node.id));
  const results = await Promise.allSettled([
    fetchJson(origin, "/api/v1/diagnostics"),
    fetchJson(origin, "/api/v1/roadmap-feedback")
  ]);
  if (results[0].status === "fulfilled") {
    const body = diagnosticsSchema.parse(results[0].value);
    const issues = prioritizeIssues(body.issues);
    await writeIfChanged(diagnosticsPath, {
      generatedAt: issues.map(issue => issue.lastSeen).sort().at(-1) ?? null,
      source: `${origin}/api/v1/diagnostics (anonymous aggregates only)`,
      privacyThreshold: body.privacyThreshold,
      issues
    });
    console.log(`Exported ${issues.length} privacy-threshold diagnostic issues.`);
  } else console.warn(`Diagnostic export preserved the previous snapshot: ${results[0].reason instanceof Error ? results[0].reason.message : "request failed"}`);
  if (results[1].status === "fulfilled") {
    const body = feedbackSchema.parse(results[1].value);
    const filtered = Object.fromEntries(Object.entries(body.counts).filter(([nodeId]) => knownNodes.has(nodeId)));
    const feedback = prioritizeFeedback(filtered);
    const friction = prioritizeFriction(filtered);
    await writeIfChanged(feedbackPath, { source: `${origin}/api/v1/roadmap-feedback (aggregate counts only)`, feedback });
    await writeIfChanged(frictionPath, {
      source: `${origin}/api/v1/roadmap-feedback (aggregate counts only; private report text is never exported)`,
      queue: friction
    });
    console.log(`Exported aggregate feedback for ${feedback.length} roadmap nodes.`);
  } else console.warn(`Feedback export preserved the previous snapshot: ${results[1].reason instanceof Error ? results[1].reason.message : "request failed"}`);
}

void main().catch(error => {
  console.error(`Product signal export failed: ${error instanceof Error ? error.message : "UNKNOWN_ERROR"}`);
  process.exitCode = 1;
});
