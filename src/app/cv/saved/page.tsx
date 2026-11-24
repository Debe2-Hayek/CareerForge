import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authorizeProfile } from "@/lib/account/server";
import { ProfileCV } from "@/components/profile-cv";
import { PrintCV } from "@/components/print-cv";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { eligibleCVSkills, readSkillResults } from "@/lib/skill-checks";
import { AppShell } from "@/components/app-shell";
import { readProfileHistory } from "@/lib/profile-history-server";
import type { ProfileHistory } from "@/lib/profile-history";
import type { ClaimItem } from "@/lib/claims/model";
import { readClaimsOverview } from "@/lib/claims/server";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Private CV preview — CareerForge", robots: { index: false, follow: false } };

export default async function CVPage() {
  if (!(await cookies()).getAll().some(cookie => cookie.name.startsWith("sb-"))) redirect("/login");
  let access;
  let profile;
  let history: ProfileHistory | undefined;
  let passedSkills: string[] = [];
  let claims: ClaimItem[] = [];
  let trustUrl: string | null = null;
  try {
    access = await authorizeProfile();
    if (access) {
      profile = await access.read();
      if (profile) {
        const client = await createClient();
        const [results, savedHistory, claimItems, trustPage] = await Promise.all([
          readSkillResults(client, access.userId), readProfileHistory(access.userId),
          // Trust marks are optional: without them the CV shows every entry as self-reported.
          readClaimsOverview(client, access.userId, profile.skills).catch(() => []),
          client.from("trust_pages").select("slug,enabled").eq("user_id", access.userId).maybeSingle()
        ]);
        claims = claimItems;
        trustUrl = trustPage.data?.enabled ? siteUrl(`/v/${trustPage.data.slug}`) : null;
        if (!savedHistory) throw new Error("Saved history unavailable");
        passedSkills = eligibleCVSkills(profile.skills, results);
        history = savedHistory;
      }
    }
  } catch {
    return <AppShell pageTitle="My CV" privateAccount><div className="empty-state"><h1>Your CV is temporarily unavailable.</h1><p>We could not load your saved private profile. Please try again.</p><Link className="button primary" href="/cv/saved">Try again</Link><Link className="text-button" href="/account">Back to profile</Link></div></AppShell>;
  }
  if (!access) redirect("/login");
  if (!profile?.name.trim()) return <AppShell pageTitle="My CV" privateAccount><div className="empty-state"><h1>Start with your profile.</h1><p>Save your name and the details you want included before creating a CV preview.</p><Link className="button primary" href="/account">Edit your profile</Link></div></AppShell>;
  return <AppShell pageTitle="My CV" privateAccount displayName={profile.name}><div className="cv-page"><div className="cv-tools"><Link className="text-button" href="/documents">Open CV &amp; portfolio builder</Link><Link className="text-button" href="/account">← Back to profile</Link><div className="page-heading"><div><p className="eyebrow">PRIVATE · SAVED PROFILE ONLY</p><h1>Your profile CV.</h1><p>Review your details, then use your browser’s print dialog to save a PDF.</p></div><PrintCV /></div><p className="cv-note">This preview uses your saved profile and education/work history. Save edits before refreshing it. Only selected skills with a stored passing basics check appear on this CV. Entries whose proof CareerForge reviewed are marked ✓; the rest remain self-reported. Turn on your checked-profile link on the Verify page to print it on the CV. Review before sharing.</p><Link className="text-button" href="/account/history">Edit education and work history</Link><Link className="text-button" href="/skill-checks">Check your skills ({passedSkills.length}/{profile.skills.length} eligible)</Link></div><ProfileCV profile={profile} passedSkills={passedSkills} history={history} claims={claims} trustUrl={trustUrl} /></div></AppShell>;
}
