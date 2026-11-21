import "server-only";
import { createClient } from "./supabase/server";
import { publishedStateSchema, siteStatusSchema, type PublishedState, type SiteStatus } from "./portfolio-site";
import type { PortfolioSiteAccess } from "./portfolio-site-handlers";

export async function authorizePortfolioSite(): Promise<PortfolioSiteAccess | null> {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error) {
    if (error.status === 400 || error.status === 401 || error.name === "AuthSessionMissingError") return null;
    throw new Error("Session verification unavailable");
  }
  if (!user) return null;
  async function rpc(name: string, params?: Record<string, unknown>) {
    const { data, error } = await client.rpc(name, params);
    if (error) throw new Error("Portfolio site operation unavailable");
    return data as unknown;
  }
  return {
    userId: user.id,
    read: () => rpc("get_portfolio_site"),
    save: (state, revision) => rpc("save_portfolio_site", { p_draft: state, p_revision: revision }),
    publish: (slug, revision) => rpc("publish_portfolio_site", { p_slug: slug, p_revision: revision }),
    unpublish: () => rpc("unpublish_portfolio_site")
  };
}

/** The signed-in owner's saved draft and publication status, or null if unavailable. */
export async function readOwnPortfolioSite(): Promise<SiteStatus | null> {
  try {
    const access = await authorizePortfolioSite();
    if (!access) return null;
    const parsed = siteStatusSchema.safeParse(await access.read());
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

/** A published site by address. Invalid or unpublished content is treated as not found. */
export async function readPublicPortfolioSite(slug: string): Promise<{ site: PublishedState; publishedAt: string | null } | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug) || slug.length < 3 || slug.length > 40) return null;
  const client = await createClient();
  const { data, error } = await client.rpc("get_public_portfolio_site", { p_slug: slug.toLowerCase() });
  if (error || !data || typeof data !== "object") return null;
  const record = data as { site?: unknown; publishedAt?: unknown };
  const site = publishedStateSchema.safeParse(record.site);
  return site.success ? { site: site.data, publishedAt: typeof record.publishedAt === "string" ? record.publishedAt : null } : null;
}
