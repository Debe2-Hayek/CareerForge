import { execFileSync } from "node:child_process";
import { access, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { productRoadmapSchema, type ProductRoadmap } from "../src/lib/product-roadmap";
import {
  cachedUpstreamSnapshot,
  completionEvidenceByNode,
  mergeRoadmapSnapshots,
  type CodebaseSnapshot,
  type GitCommitSnapshot,
  type UpstreamEntry,
  type UpstreamSnapshot
} from "./roadmap-sync-lib";

const root = resolve(process.cwd());
const roadmapPath = resolve(root, "src/data/roadmap.json");
const githubApi = "https://api.github.com";
const githubRaw = "https://raw.githubusercontent.com";
const canonicalUpstreamRepository = "nilbuild/developer-roadmap";
const canonicalRawBase = `${githubRaw}/${canonicalUpstreamRepository}`;
const maxResponseBytes = 8 * 1024 * 1024;
const maxRawMarkdownBytes = 512 * 1024;

function git(...args: string[]) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function recentCommits(limit = 100): GitCommitSnapshot[] {
  const output = git("log", `-${limit}`, "--format=%x1e%H%x1f%cI%x1f%s", "--name-only", "--no-renames");
  return output.split("\x1e").flatMap(record => {
    const [header, ...changedFiles] = record.trim().split(/\r?\n/);
    if (!header) return [];
    const [revision, committedAt, subject] = header.split("\x1f");
    if (!revision || !committedAt || subject === undefined || !Number.isFinite(Date.parse(committedAt))) return [];
    return [{ revision, committedAt: new Date(committedAt).toISOString(), subject, changedFiles: changedFiles.filter(Boolean) }];
  });
}

async function existingLinkedFiles(roadmap: ProductRoadmap) {
  const paths = [...new Set(roadmap.nodes.flatMap(node => node.linkedFiles))];
  const existing = await Promise.all(paths.map(async path => {
    const candidate = resolve(root, path);
    const repositoryRelative = relative(root, candidate);
    if (!repositoryRelative || repositoryRelative.startsWith("..") || isAbsolute(repositoryRelative)) return null;
    try {
      await access(candidate);
      return path;
    } catch {
      return null;
    }
  }));
  return existing.filter((path): path is string => path !== null);
}

function codebaseSnapshot(roadmap: ProductRoadmap, commits: GitCommitSnapshot[], files: string[]): CodebaseSnapshot {
  const tracked = new Set(roadmap.nodes.flatMap(node => node.linkedFiles).filter(path => path !== "src/data/roadmap.json"));
  const relevant = commits.find(commit => commit.changedFiles.some(path => tracked.has(path.replaceAll("\\", "/"))));
  return {
    revision: relevant?.revision ?? roadmap.codebase.revision,
    committedAt: relevant?.committedAt ?? roadmap.codebase.scannedAt,
    evidence: completionEvidenceByNode(roadmap, commits, files)
  };
}

async function readBoundedJson(url: string) {
  if (!url.startsWith(`${githubApi}/`)) throw new Error("UNTRUSTED_UPSTREAM_ORIGIN");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "CareerForge-roadmap-sync" };
    const token = process.env.ROADMAP_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;
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

async function readBoundedMarkdown(url: string) {
  if (!url.startsWith(`${canonicalRawBase}/`)) throw new Error("UNTRUSTED_RAW_UPSTREAM_ORIGIN");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      headers: { Accept: "text/plain", "User-Agent": "CareerForge-roadmap-sync" },
      signal: controller.signal,
      redirect: "follow"
    });
    if (!response.url.startsWith(`${canonicalRawBase}/`)) throw new Error("UNTRUSTED_RAW_UPSTREAM_REDIRECT");
    if (!response.ok) throw new Error(`RAW_UPSTREAM_HTTP_${response.status}`);
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > maxRawMarkdownBytes) throw new Error("RAW_UPSTREAM_RESPONSE_TOO_LARGE");
    const markdown = await response.text();
    if (!markdown.trim() || Buffer.byteLength(markdown) > maxRawMarkdownBytes) throw new Error("INVALID_RAW_UPSTREAM_MARKDOWN");
  } finally {
    clearTimeout(timer);
  }
}

function rawUrl(commitSha: string, path: string) {
  const encodedPath = path.split("/").map(segment => encodeURIComponent(segment)).join("/");
  return `${canonicalRawBase}/${encodeURIComponent(commitSha)}/${encodedPath}`;
}

async function validateRawTrackSources(roadmap: ProductRoadmap, commitSha: string, entries: UpstreamEntry[]) {
  const samples = roadmap.tracks.map(track => {
    const prefix = `${track.upstreamPath}/`;
    const sample = entries.find(entry => {
      if (entry.type !== "blob" || !entry.path.startsWith(prefix)) return false;
      const remainder = entry.path.slice(prefix.length);
      return !remainder.includes("/") && remainder.endsWith(".md");
    });
    if (!sample) throw new Error(`MISSING_RAW_TRACK_SAMPLE_${track.id.toUpperCase()}`);
    return sample.path;
  });
  await Promise.all(samples.map(path => readBoundedMarkdown(rawUrl(commitSha, path))));
}

async function upstreamSnapshot(roadmap: ProductRoadmap) {
  const repository = roadmap.upstream.repository;
  const ref = encodeURIComponent(roadmap.upstream.ref);
  const [treeValue, commitValue] = await Promise.all([
    readBoundedJson(`${githubApi}/repos/${repository}/git/trees/${ref}?recursive=1`),
    readBoundedJson(`${githubApi}/repos/${repository}/commits/${ref}`)
  ]);
  const tree = treeValue as { sha?: unknown; truncated?: unknown; tree?: unknown };
  const commit = commitValue as { sha?: unknown; commit?: { committer?: { date?: unknown } } };
  if (tree.truncated || typeof tree.sha !== "string" || !Array.isArray(tree.tree)) throw new Error("INVALID_OR_TRUNCATED_UPSTREAM_TREE");
  const entries: UpstreamEntry[] = tree.tree.flatMap(value => {
    if (!value || typeof value !== "object") return [];
    const entry = value as { path?: unknown; type?: unknown; sha?: unknown };
    if (typeof entry.path !== "string" || (entry.type !== "blob" && entry.type !== "tree")) return [];
    return [{ path: entry.path, type: entry.type, sha: typeof entry.sha === "string" ? entry.sha : undefined }];
  });
  const committedAt = commit.commit?.committer?.date;
  if (typeof commit.sha !== "string" || !/^[0-9a-f]{40}$/.test(commit.sha)) throw new Error("INVALID_UPSTREAM_COMMIT_SHA");
  if (typeof committedAt !== "string" || !Number.isFinite(Date.parse(committedAt))) throw new Error("INVALID_UPSTREAM_COMMIT_DATE");
  await validateRawTrackSources(roadmap, commit.sha, entries);
  return { treeRevision: tree.sha, committedAt: new Date(committedAt).toISOString(), entries };
}

async function upstreamSnapshotWithFallback(roadmap: ProductRoadmap): Promise<{ snapshot: UpstreamSnapshot; source: "live" | "cache" }> {
  if (process.env.ROADMAP_SYNC_OFFLINE === "1") {
    console.warn("Roadmap live sync disabled; using the embedded last-known-good topic cache.");
    return { snapshot: cachedUpstreamSnapshot(roadmap), source: "cache" };
  }
  try {
    return { snapshot: await upstreamSnapshot(roadmap), source: "live" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN_UPSTREAM_ERROR";
    console.warn(`Roadmap upstream unavailable (${reason}); using the embedded last-known-good topic cache.`);
    return { snapshot: cachedUpstreamSnapshot(roadmap), source: "cache" };
  }
}

async function main() {
  const roadmap = productRoadmapSchema.parse(JSON.parse(await readFile(roadmapPath, "utf8")));
  const commits = recentCommits();
  const files = await existingLinkedFiles(roadmap);
  const codebase = codebaseSnapshot(roadmap, commits, files);
  const upstream = await upstreamSnapshotWithFallback(roadmap);
  const merged = productRoadmapSchema.parse(mergeRoadmapSnapshots(roadmap, upstream.snapshot, codebase));
  const serialized = `${JSON.stringify(merged, null, 2)}\n`;
  const previous = await readFile(roadmapPath, "utf8");
  if (serialized !== previous) await writeFile(roadmapPath, serialized, "utf8");
  const discoveries = merged.nodes.filter(node => node.status === "upstream-new").length;
  console.log(`Roadmap synchronized from ${upstream.source}: ${merged.tracks.length} tracks, ${merged.nodes.length} product nodes, ${discoveries} upstream discoveries.`);
}

void main().catch(error => {
  console.error(`Roadmap sync failed: ${error instanceof Error ? error.message : "UNKNOWN_ERROR"}`);
  process.exitCode = 1;
});
