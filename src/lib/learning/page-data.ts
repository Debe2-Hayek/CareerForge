import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { profileFromRow, type AccountProfile } from "@/lib/account/schemas";
import type { LearningSnapshot } from "./api";
import { readLearningSnapshot } from "./server";

export type LearningAccount =
  | { status: "unavailable" }
  | {
    status: "ready";
    client: SupabaseClient;
    userId: string;
    profile: AccountProfile;
    /** null when progress storage could not be read; pages stay usable read-only. */
    snapshot: LearningSnapshot | null;
  };

/**
 * Server-verified session, saved profile and learning progress for the
 * authenticated learning pages. Guests are redirected to sign in. A failed
 * progress read degrades to a read-only roadmap instead of failing the page.
 */
export async function loadLearningAccount(): Promise<LearningAccount> {
  if (!(await cookies()).getAll().some(cookie => cookie.name.startsWith("sb-"))) redirect("/login");
  let client: SupabaseClient;
  let userId: string;
  try {
    client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) redirect("/login");
    userId = user.id;
  } catch (error) {
    if (isRedirect(error)) throw error;
    return { status: "unavailable" };
  }
  const [profile, snapshot] = await Promise.all([
    client.from("profiles").select("full_name,headline,location,bio,education_summary,project_summary,self_reported_skills").eq("id", userId).single(),
    readLearningSnapshot(client, userId).catch(() => null)
  ]);
  if (profile.error || !profile.data) return { status: "unavailable" };
  return { status: "ready", client, userId, profile: profileFromRow(profile.data), snapshot };
}

function isRedirect(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");
}
