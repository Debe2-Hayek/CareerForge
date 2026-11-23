import type { FetchJson, FetchText } from "../jobs/fetch";

/**
 * Development-only stand-in for GitHub (enabled with AI_FAKE=1 outside production and
 * Vercel), so the interview flow can be clicked through without a real repository.
 * Its README contains the ownership code it is created for.
 */
const SHA = "0123456789abcdef0123456789abcdef01234567";
const files: Record<string, string> = {
  "src/api/users.ts": `import { db } from "../lib/db";
import { cache } from "../lib/cache";

export async function getUser(id: string, token: string | null) {
  if (!token) throw new Error("Unauthorised");
  const cached = cache.get(\`user:\${id}\`);
  if (cached) return cached;
  const user = await db.query("select id, name, email from users where id = $1", [id]);
  if (!user) return null;
  cache.set(\`user:\${id}\`, user, 60);
  return user;
}

export async function updateName(id: string, name: string) {
  const clean = name.trim().slice(0, 80);
  if (!clean) throw new Error("Name required");
  await db.query("update users set name = $2 where id = $1", [id, clean]);
  cache.delete(\`user:\${id}\`);
}
`,
  "src/lib/cache.ts": `type Entry = { value: unknown; expires: number };
const store = new Map<string, Entry>();

export const cache = {
  get(key: string) {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (entry.expires < Date.now()) { store.delete(key); return undefined; }
    return entry.value;
  },
  set(key: string, value: unknown, seconds: number) {
    if (store.size > 500) store.delete(store.keys().next().value as string);
    store.set(key, { value, expires: Date.now() + seconds * 1000 });
  },
  delete(key: string) { store.delete(key); }
};
`,
  "src/components/UserList.tsx": `import { useEffect, useState } from "react";

export function UserList({ ids }: { ids: string[] }) {
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    Promise.all(ids.map(id => fetch(\`/api/users/\${id}\`).then(r => r.json())))
      .then(list => { if (!cancelled) setUsers(list); })
      .catch(() => { if (!cancelled) setError("Could not load users"); });
    return () => { cancelled = true; };
  }, [ids]);
  if (error) return <p role="alert">{error}</p>;
  return <ul>{users.map(user => <li key={user.id}>{user.name}</li>)}</ul>;
}
`
};

export function fakeGithubFetchers(code: string | null): { json: FetchJson; text: FetchText; headers: Record<string, string> } {
  const readme = `# Demo project (test GitHub)\n\nOwnership: ${code ?? "none"}\n`;
  return {
    headers: {},
    json: async url => {
      if (/\/git\/trees\//.test(url)) return { tree: [{ path: "README.md", type: "blob", size: readme.length }, ...Object.entries(files).map(([path, text]) => ({ path, type: "blob", size: text.length }))] };
      if (/\/commits\//.test(url)) return { sha: SHA };
      return { private: false, default_branch: "main" };
    },
    text: async url => {
      const path = decodeURIComponent(url.split(`/${SHA}/`)[1] ?? "");
      if (path === "README.md") return readme;
      return files[path] ?? "";
    }
  };
}
