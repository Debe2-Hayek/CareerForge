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
import { sky, type Sky } from "@/lib/constellation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountProfile } from "@/lib/account/schemas";
import { rankJobs } from "@/lib/demo-workspace";

/** "Your path" for the Overview. An addition: if anything fails, the Overview opens without it. */
async function readJourney(client: SupabaseClient, userId: string, profile: AccountProfile, applications: { status: string }[]): Promise<{ path: Journey; sky: Sky } | null> {
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
    const path = journey({ strength: strength.steps, proofSent, confirmed: summary.confirmed, learningPaths: paths.count ?? 0,
      applied: applications.filter(entry => entry.status !== "Saved").length, tracked: applications.length });
    return { path, sky: sky(items, strength.percent) };
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
    const profile = profileFromRow(data);
    const listing = tracker.jobs();
    const applications = await tracker.list();
    // The journey needs the applications; it loads while the job catalog is still arriving.
    const [catalog, guide] = await Promise.all([listing, view === "overview" ? readJourney(client, user.id, profile, applications) : null]);
    // The Overview shows only the best matches (tracked roles arrive with the applications), so it
    // sends a few jobs instead of the whole catalog. A refresh on focus loads the full list.
    const jobs = view === "overview" ? rankJobs(catalog, profile.skills).slice(0, 6) : catalog;
    account = { id: user.id, profile, tracker: { jobs, applications }, journey: guide?.path ?? null, sky: guide?.sky ?? null };
  } catch {
    if (anonymous) {
      redirect("/login");
    }
    return <main className="account-content"><div className="empty-state"><h1>Your workspace is temporarily unavailable.</h1><p>We could not load your account, profile or opportunities. Please try again or sign in again.</p><Link href={view === "overview" ? "/dashboard" : `/${view}`} className="button primary">Try again</Link><Link href="/login" className="text-button">Sign in</Link></div></main>;
  }
  if (view === "profile") redirect("/account");
  return <CareerWorkspace key={`${account.id}:${view}`} view={view} account={account} />;
}
