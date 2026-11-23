import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountProfileEditor, type ProfileTrust } from "@/components/account-profile";
import { createClient } from "@/lib/supabase/server";
import { profileFromRow } from "@/lib/account/schemas";
import { readClaimsOverview } from "@/lib/claims/server";
import { trustSummary } from "@/lib/claims/model";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  if (!(await cookies()).getAll().some(cookie => cookie.name.startsWith("sb-"))) redirect("/login");
  let result;
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (!error && user) {
      const { data, error: profileError } = await client.from("profiles").select("full_name,headline,location,bio,education_summary,project_summary,self_reported_skills").eq("id", user.id).maybeSingle();
      if (profileError || !data) result = { unavailable: true as const };
      else {
        const profile = profileFromRow(data);
        // The strength ring and badges are an addition: if they cannot load, the profile still opens.
        let trust: ProfileTrust = null;
        try {
          const items = await readClaimsOverview(client, user.id, profile.skills);
          const summary = trustSummary(items);
          trust = {
            ...summary,
            counts: {
              education: items.filter(item => item.kind === "degree").length,
              experience: items.filter(item => item.kind === "employment").length,
              claims: { proofSent: items.filter(item => item.evidenceCount > 0).length, confirmed: summary.confirmed }
            },
            skillStatus: Object.fromEntries(items.filter(item => item.kind === "skill").map(item => [item.title.toLowerCase(), item.status]))
          };
        } catch { trust = null; }
        result = { profile, email: user.email ?? "your account", trust };
      }
    }
  } catch { result = { unavailable: true as const }; }
  if (!result) redirect("/login");
  if ("unavailable" in result) return <main className="account-content"><div className="empty-state"><h1>Your account is temporarily unavailable.</h1><p>We could not load your private profile. Your data has not been replaced with a demo.</p><Link className="button primary" href="/account">Try again</Link><Link className="text-button" href="/login">Back to sign in</Link></div></main>;
  return <AccountProfileEditor profile={result.profile} email={result.email} trust={result.trust} />;
}
