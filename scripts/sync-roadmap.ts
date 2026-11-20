import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { productRoadmapSchema, type ProductRoadmap } from "../src/lib/product-roadmap";
import { mergeRoadmapSnapshots, type CodebaseSnapshot, type UpstreamEntry } from "./roadmap-sync-lib";

const root = resolve(process.cwd());
const roadmapPath = resolve(root, "src/data/roadmap.json");
const githubApi = "https://api.github.com";
const maxResponseBytes = 8 * 1024 * 1024;

function git(...args: string[]) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function evidenceFor(roadmap: ProductRoadmap) {
  return Object.fromEntries(roadmap.nodes.flatMap(node => {
    if (!node.linkedFiles.length) return [];
    try {
      const value = git("log", "-1", "--format=%H%x00%cI", "--", ...node.linkedFiles);
      const [revision, committedAt] = value.split("\0");
      return revision && committedAt ? [[node.id, { revision, committedAt }]] : [];
    } catch { return []; }
  }));
}

async function readBoundedJson(url: string) {
  if (!url.startsWith(`${githubApi}/`)) throw new Error("UNTRUSTED_UPSTREAM_ORIGIN");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "CareerForge-roadmap-sync" };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const response = await fetch(url, { headers, signal: controller.signal, redirect: "follow" });
    if (!response.url.startsWith(`${githubApi}/`)) throw new Error("UNTRUSTED_UPSTREAM_REDIRECT");
    if (!response.ok) throw new Error(`UPSTREAM_HTTP_${response.status}`);
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > maxResponseBytes) throw new Error("UPSTREAM_RESPONSE_TOO_LARGE");
    const text = await response.text();
    if (Buffer.byteLength(text) > maxResponseBytes) throw new Error("UPSTREAM_RESPONSE_TOO_LARGE");
    return JSON.parse(text) as unknown;
  } finally { clearTimeout(timer); }
}

async function upstreamSnapshot(roadmap: ProductRoadmap) {
  const repository = roadmap.upstream.repository;
  const ref = encodeURIComponent(roadmap.upstream.ref);
  const [treeValue, commitValue] = await Promise.all([
    readBoundedJson(`${githubApi}/repos/${repository}/git/trees/${ref}?recursive=1`),
    readBoundedJson(`${githubApi}/repos/${repository}/commits/${ref}`)
  ]);
  const tree = treeValue as { sha?: unknown; truncated?: unknown; tree?: unknown };
  const commit = commitValue as { commit?: { committer?: { date?: unknown } } };
  if (tree.truncated || typeof tree.sha !== "string" || !Array.isArray(tree.tree)) throw new Error("INVALID_OR_TRUNCATED_UPSTREAM_TREE");
  const entries: UpstreamEntry[] = tree.tree.flatMap(value => {
    if (!value || typeof value !== "object") return [];
    const entry = value as { path?: unknown; type?: unknown; sha?: unknown };
    if (typeof entry.path !== "string" || (entry.type !== "blob" && entry.type !== "tree")) return [];
    return [{ path: entry.path, type: entry.type, sha: typeof entry.sha === "string" ? entry.sha : undefined }];
  });
  const committedAt = commit.commit?.committer?.date;
  if (typeof committedAt !== "string" || !Number.isFinite(Date.parse(committedAt))) throw new Error("INVALID_UPSTREAM_COMMIT_DATE");
  return { treeRevision: tree.sha, committedAt: new Date(committedAt).toISOString(), entries };
}

async function main() {
  const roadmap = productRoadmapSchema.parse(JSON.parse(await readFile(roadmapPath, "utf8")));
  const revision = git("rev-parse", "HEAD");
  const committedAt = new Date(git("show", "-s", "--format=%cI", "HEAD")).toISOString();
  const codebase: CodebaseSnapshot = { revision, committedAt, evidence: evidenceFor(roadmap) };
  const merged = productRoadmapSchema.parse(mergeRoadmapSnapshots(roadmap, await upstreamSnapshot(roadmap), codebase));
  const serialized = `${JSON.stringify(merged, null, 2)}\n`;
  const previous = await readFile(roadmapPath, "utf8");
  if (serialized !== previous) await writeFile(roadmapPath, serialized, "utf8");
  const discoveries = merged.nodes.filter(node => node.status === "upstream-new").length;
  console.log(`Roadmap synchronized: ${merged.tracks.length} tracks, ${merged.nodes.length} product nodes, ${discoveries} upstream discoveries.`);
}

void main().catch(error => {
  console.error(`Roadmap sync failed: ${error instanceof Error ? error.message : "UNKNOWN_ERROR"}`);
  process.exitCode = 1;
});
