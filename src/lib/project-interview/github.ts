import { boundedFetchJson, boundedFetchText, SourceError, type FetchJson, type FetchText } from "../jobs/fetch";

/**
 * Reads a public GitHub repository at one commit: the README / .careerforge file for the
 * ownership code, and a few source files for the interview. Only api.github.com and
 * raw.githubusercontent.com are contacted, with size and time limits and no redirects.
 */
export type RepoRef = { owner: string; name: string };
export type RepoFile = { path: string; text: string };
export type RepoSnapshot = { sha: string; files: RepoFile[]; ownershipFound: boolean };
export class RepoError extends Error {
  constructor(public code: "NOT_FOUND" | "NO_CODE" | "RATE_LIMITED" | "UNAVAILABLE", message: string) { super(message); }
}

const OWNER = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
const NAME = /^[A-Za-z0-9._-]{1,100}$/;
export function parseRepoUrl(input: string): RepoRef | null {
  const match = input.trim().match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?\/?(?:[/#?].*)?$/i);
  if (!match || !OWNER.test(match[1]) || !NAME.test(match[2]) || match[2] === "." || match[2] === "..") return null;
  return { owner: match[1], name: match[2] };
}

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|py|java|kt|cs|go|rb|php|swift|c|h|cpp|hpp|rs|dart|vue|svelte|sql)$/i;
const SKIP = /(^|\/)(node_modules|dist|build|out|vendor|coverage|\.next|\.git|__pycache__|target|bin|obj|migrations?|generated|public|assets|static)\//i;
const SKIP_FILE = /(\.min\.|\.d\.ts$|\.test\.|\.spec\.|lock|config\.)/i;

/** Up to six meaningful source files: mid-sized, not generated, not tests; source folders first. */
export function pickSourceFiles(tree: { path: string; type: string; size?: number }[]): string[] {
  return tree.filter(item => item.type === "blob" && CODE_EXT.test(item.path) && !SKIP.test(item.path) && !SKIP_FILE.test(item.path) && (item.size ?? 0) >= 300 && (item.size ?? 0) <= 20_000)
    .sort((a, b) => Number(/(^|\/)(src|app|lib)\//.test(b.path)) - Number(/(^|\/)(src|app|lib)\//.test(a.path)) || (b.size ?? 0) - (a.size ?? 0))
    .slice(0, 6).map(item => item.path);
}

const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

export function githubFetchers(token?: string): { json: FetchJson; text: FetchText; headers: Record<string, string> } {
  return {
    json: boundedFetchJson(["api.github.com"], { maxBytes: 3_000_000 }),
    text: boundedFetchText(["raw.githubusercontent.com"], { maxBytes: 300_000, accept: /text|octet-stream/i, userAgent: "CareerForge-ProjectInterview/1.0" }),
    headers: token ? { Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" } : { "X-GitHub-Api-Version": "2022-11-28" }
  };
}

async function guard<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); }
  catch (error) {
    if (error instanceof RepoError) throw error;
    if (error instanceof SourceError && error.code === "RATE_LIMITED") throw new RepoError("RATE_LIMITED", "GitHub is limiting requests right now. Try again in a few minutes.");
    if (error instanceof SourceError && error.code === "HTTP_ERROR" && /40[34]/.test(error.message)) throw new RepoError("NOT_FOUND", "This repository was not found. It must be public on GitHub.");
    throw new RepoError("UNAVAILABLE", "GitHub could not be reached. Try again later.");
  }
}

/** The repository at one commit (the latest on the default branch, or the given sha). */
export async function readRepo(repo: RepoRef, code: string | null, fetchers = githubFetchers(), atSha?: string): Promise<RepoSnapshot> {
  return guard(async () => {
    const base = `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`;
    let sha = atSha;
    if (!sha) {
      const meta = await fetchers.json(base, fetchers.headers) as { private?: boolean; default_branch?: string };
      if (meta.private) throw new RepoError("NOT_FOUND", "This repository is private. Make it public for the interview.");
      const commit = await fetchers.json(`${base}/commits/${encodeURIComponent(meta.default_branch ?? "main")}`, fetchers.headers) as { sha?: string };
      sha = commit.sha;
    }
    if (!sha || !/^[0-9a-f]{40}$/.test(sha)) throw new RepoError("UNAVAILABLE", "The latest commit could not be read.");
    const tree = await fetchers.json(`${base}/git/trees/${sha}?recursive=1`, fetchers.headers) as { tree?: { path: string; type: string; size?: number }[] };
    const entries = (tree.tree ?? []).slice(0, 20_000);
    const raw = (path: string) => fetchers.text(`https://raw.githubusercontent.com/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/${sha}/${encodePath(path)}`);
    let ownershipFound = false;
    if (code) {
      const proofFiles = entries.filter(item => item.type === "blob" && (/^readme(\.\w+)?$/i.test(item.path) || item.path === ".careerforge")).map(item => item.path);
      for (const path of proofFiles) if ((await raw(path)).includes(code)) { ownershipFound = true; break; }
    }
    const paths = pickSourceFiles(entries);
    if (!paths.length) throw new RepoError("NO_CODE", "No source files were found to ask about (for example .ts, .js, .py or .java files of a few hundred lines).");
    const files: RepoFile[] = [];
    for (const path of paths) files.push({ path, text: (await raw(path)).split("\n").slice(0, 400).join("\n") });
    return { sha, files, ownershipFound };
  });
}

/** Exact lines start..end (1-based, inclusive) of a file, as stored and as shown to the student. */
export function quoteLines(text: string, start: number, end: number): string | null {
  const lines = text.split("\n");
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > lines.length || end - start > 14) return null;
  return lines.slice(start - 1, end).join("\n");
}
