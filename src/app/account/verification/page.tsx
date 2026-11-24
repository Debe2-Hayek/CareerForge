import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ClaimsBoard } from "@/components/claims-board";
import { authorizeProfile } from "@/lib/account/server";
import { readClaimsOverview } from "@/lib/claims/server";
import { createClient } from "@/lib/supabase/server";
import type { ClaimItem } from "@/lib/claims/model";
import { TrustShare } from "@/components/trust-share";
import { TrustFacts } from "@/components/trust-facts";
import { readOwnTrustPage } from "@/lib/trust-page-server";
import { factCount } from "@/lib/trust-page";
import { siteOrigin } from "@/lib/site-url";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify your profile - CareerForge", robots: { index: false, follow: false } };

export default async function Page() {
  if (!(await cookies()).getAll().some(cookie => cookie.name.startsWith("sb-"))) redirect("/login");
  let access;
  let items: ClaimItem[] = [];
  let trust: Awaited<ReturnType<typeof readOwnTrustPage>> | null = null;
  try {
    access = await authorizeProfile();
    if (access) {
      const profile = await access.read();
      const client = await createClient();
      [items, trust] = await Promise.all([
        readClaimsOverview(client, access.userId, profile?.skills ?? []),
        // Sharing is optional: if it cannot load, the rest of the page still works.
        readOwnTrustPage(client, access.userId).catch(() => null)
      ]);
    }
  } catch {
    return <AppShell pageTitle="Verify your profile" privateAccount><div className="empty-state"><h1>Verification is temporarily unavailable.</h1><p>We could not load your claims. Please try again.</p><Link href="/account/verification" className="button primary">Try again</Link><Link href="/account" className="text-button">Back to profile</Link></div></AppShell>;
  }
  if (!access) redirect("/login");
  return <AppShell pageTitle="Verify your profile" privateAccount>
    <div className="account-content">
      <div className="page-heading"><div><p className="eyebrow">PROVE WHAT YOU CLAIM</p><h1>Verify your profile<span>.</span></h1><p>Add proof for your education, work and skills. Confirmed facts earn a badge employers can trust.</p></div><Link href="/account" className="text-button">← Back to profile</Link></div>
      <ClaimsBoard items={items} />
      {trust && <TrustShare initialSlug={trust.state.slug} origin={siteOrigin} count={factCount(trust.facts)} preview={<TrustFacts facts={trust.facts} headingLevel={3} />} />}
    </div>
  </AppShell>;
}
