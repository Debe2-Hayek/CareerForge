import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./supabase/server";
import { confirmedFactsSchema, type ConfirmedFacts } from "./trust-page";
import type { TrustAccess, TrustPageState } from "./trust-page-handlers";

/** Public: the confirmed facts behind a trust link, or null when the page is off or unknown. */
export async function readTrustPage(slug: string): Promise<ConfirmedFacts | null> {
  if (!z.uuid().safeParse(slug).success) return null;
  const client = await createClient();
  const { data, error } = await client.rpc("get_trust_page", { p_slug: slug }).abortSignal(AbortSignal.timeout(10000));
  if (error) throw new Error("Trust page unavailable");
  if (!data) return null;
  const parsed = confirmedFactsSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** Owner: whether the page is on, its link, and exactly what it shows. */
export async function readOwnTrustPage(client: SupabaseClient, userId: string): Promise<{ state: TrustPageState; facts: ConfirmedFacts }> {
  const [page, facts] = await Promise.all([
    client.from("trust_pages").select("slug,enabled").eq("user_id", userId).maybeSingle(),
    client.rpc("my_confirmed_facts")
  ]);
  if (page.error || facts.error) throw new Error("Trust page unavailable");
  return {
    state: { slug: page.data?.enabled ? String(page.data.slug) : null, enabled: Boolean(page.data?.enabled) },
    facts: confirmedFactsSchema.parse(facts.data)
  };
}

export async function authorizeTrustPage(): Promise<TrustAccess | null> {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error) {
    if (error.status === 400 || error.status === 401 || error.name === "AuthSessionMissingError") return null;
    throw new Error("Session verification unavailable");
  }
  if (!user) return null;
  return {
    userId: user.id,
    async set(enabled, newLink) {
      const { data, error: failed } = await client.rpc("set_trust_page", { p_enabled: enabled, p_new_link: newLink });
      if (failed) throw new Error("Trust page could not be saved");
      const result = z.object({ slug: z.uuid(), enabled: z.boolean() }).parse(data);
      return { slug: result.enabled ? result.slug : null, enabled: result.enabled };
    }
  };
}
