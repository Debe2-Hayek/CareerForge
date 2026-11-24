import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { profileFromRow } from "@/lib/account/schemas";
import { CareerWorkspace } from "./career-workspace";
import { trackerAccess } from "@/lib/tracker/server";
import { readClaimsOverview } from "@/lib/claims/server";
import { trustSummary } from "@/lib/claims/model";
import { profileStrength } from "@/lib/profile-strength";
import { journey, type Journey } from "@/lib/journey";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountProfile } from "@/lib/account/schemas";

/** "Your path" for the Overview. An addition: if anything fails, the Overview opens without it. */
async function readJourney(client: SupabaseClient, userId: string, profile: AccountProfile, applications: { status: string }[]): Promise<Journey | null> {
  try {
    const [items, paths] = await Promise.all([
      readClaimsOverview(client, userId, profile.skills),
      client.from("learning_enrollments").select("course_id", { count: "exact", head: true }).eq("user_id", userId)
    ]);
    const summary = trustSummary(items);
    const proofSent = items.filter(item => item.evidenceCount > 0 || item.linkCount > 0).length;
    const strength = profileStrength(profile, {
      education: items.filter(item => item.kind === "degree").length,
      experience: items.filter(item => item.kind === "employment").length,
      claims: { proofSent, confirmed: summary.confirmed }
    });
    return journey({ strength: strength.steps, proofSent, confirmed: summary.confirmed, learningPaths: paths.count ?? 0,
      applied: applications.filter(entry => entry.status !== "Saved").length, tracked: applications.length });
  } catch { return null; }
}

export async function WorkspacePage({ view }: { view: "overview" | "profile" | "jobs" | "applications" }) {
  const cookieStore = await cookies();
  // Guests need neither a database connection nor sample data in an account.
  if (!cookieStore.getAll().some(cookie => cookie.name.startsWith("sb-"))) {
    redirect("/login");
  }
  let account;
  let anonymous = false;
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) { anonymous = true; throw new Error("Session unavailable"); }
    const { data, error: profileError } = await client.from("profiles")
      .select("full_name,headline,location,bio,education_summary,project_summary,self_reported_skills")
      .eq("id", user.id).single();
    if (profileError || !data) throw new Error("Profile unavailable");
    const tracker = trackerAccess(client, user.id);
    const [jobs, applications] = await Promise.all([tracker.jobs(), tracker.list()]);
    const profile = profileFromRow(data);
    const path = view === "overview" ? await readJourney(client, user.id, profile, applications) : null;
    account = { id: user.id, profile, tracker: { jobs, applications }, journey: path };
  } catch {
    if (anonymous) {
      redirect("/login");
    }
    return <main className="account-content"><div className="empty-state"><h1>Your workspace is temporarily unavailable.</h1><p>We could not load your account, profile or opportunities. Please try again or sign in again.</p><Link href={view === "overview" ? "/dashboard" : `/${view}`} className="button primary">Try again</Link><Link href="/login" className="text-button">Sign in</Link></div></main>;
  }
  if (view === "profile") redirect("/account");
  return <CareerWorkspace key={`${account.id}:${view}`} view={view} account={account} />;
}
