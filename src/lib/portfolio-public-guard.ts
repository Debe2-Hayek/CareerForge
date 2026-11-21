import { z } from "zod";

/** Gate before Next's global loading boundary starts a 200 streamed response. */
export async function publicPortfolioGuard(path: string, read: (slug: string) => Promise<boolean>): Promise<Response | null> {
  if (!path.startsWith("/p/")) return null;
  const slug = path.slice(3);
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Content-Type": "text/plain; charset=utf-8" };
  if (!z.uuid().safeParse(slug).success) return new Response("Portfolio not found.", { status: 404, headers });
  try {
    return await read(slug) ? null : new Response("Portfolio not found.", { status: 404, headers });
  } catch { return new Response("Portfolio temporarily unavailable. Please try again.", { status: 503, headers }); }
}

/** Same gate for builder websites at /u/<slug>: identical 404s for unknown, unpublished and malformed addresses. */
export async function publicSiteGuard(path: string, read: (slug: string) => Promise<boolean>): Promise<Response | null> {
  if (!path.startsWith("/u/")) return null;
  const slug = path.slice(3);
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Content-Type": "text/plain; charset=utf-8" };
  if (slug.length < 3 || slug.length > 40 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return new Response("Portfolio not found.", { status: 404, headers });
  try {
    return await read(slug) ? null : new Response("Portfolio not found.", { status: 404, headers });
  } catch { return new Response("Portfolio temporarily unavailable. Please try again.", { status: 503, headers }); }
}
