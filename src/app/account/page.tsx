import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountProfileEditor, type DocumentsStatus, type ProfileTrust } from "@/components/account-profile";
import { siteStatusSchema } from "@/lib/portfolio-site";
import { createClient } from "@/lib/supabase/server";
import { profileFromRow } from "@/lib/account/schemas";
import { readClaimsOverview } from "@/lib/claims/server";
import { trustSummary } from "@/lib/claims/model";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  if (!(await cookies()).getAll().some(cookie => cookie.name.startsWith("sb-"))) redirect("/login");
  let result;
  let adminHome = false;
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (!error && user) {
      // Admin accounts have no student profile: they land on the admin dashboard.
      const { data: isAdmin } = await client.rpc("careerforge_is_admin");
      if (isAdmin === true) adminHome = true;
      const { data, error: profileError } = await client.from("profiles").select("full_name,headline,location,bio,education_summary,project_summary,self_reported_skills").eq("id", user.id).maybeSingle();
      if (profileError || !data) result = { unavailable: true as const };
      else {
        const profile = profileFromRow(data);
        // The strength ring and badges are an addition: if they cannot load, the profile still opens.
        let trust: ProfileTrust = null;
        // Whether a CV & portfolio exists yet, so people without one are sent to make it. Read with the
        // owner's session; if it cannot be read, the page simply leaves the card out.
        const documents: Promise<DocumentsStatus> = Promise.resolve(client.rpc("get_portfolio_site")).then(({ data, error: siteError }) => {
          if (siteError) return null;
          const site = siteStatusSchema.safeParse(data);
          if (!site.success) return null;
          return { hasDraft: site.data.draft !== null, isPublic: site.data.isPublic, slug: site.data.slug, hasUnpublishedChanges: site.data.hasUnpublishedChanges };
        }, () => null);
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
            skillStatus: Object.fromEntries(items.filter(item => item.kind === "skill").map(item => [item.title.toLowerCase(), item.status])),
            // Skills on the profile that have a check not passed yet: each links straight to its check.
            provable: items.filter(item => item.kind === "skill" && item.checkAvailable).map(item => item.title)
          };
        } catch { trust = null; }
        result = { profile, email: user.email ?? "your account", trust, documents: await documents };
      }
    }
  } catch { result = { unavailable: true as const }; }
  if (adminHome) redirect("/admin");
  if (!result) redirect("/login");
  if ("unavailable" in result) return <main className="account-content"><div className="empty-state"><h1>Your account is temporarily unavailable.</h1><p>We could not load your private profile. Your data has not been replaced with a demo.</p><Link className="button primary" href="/account">Try again</Link><Link className="text-button" href="/login">Back to sign in</Link></div></main>;
  return <AccountProfileEditor profile={result.profile} email={result.email} trust={result.trust} documents={result.documents} />;
}
