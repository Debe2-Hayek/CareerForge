import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ClaimsBoard } from "@/components/claims-board";
import { authorizeProfile } from "@/lib/account/server";
import { readClaimsOverview } from "@/lib/claims/server";
import { createClient } from "@/lib/supabase/server";
import type { ClaimItem } from "@/lib/claims/model";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify your profile - CareerForge", robots: { index: false, follow: false } };

export default async function Page() {
  if (!(await cookies()).getAll().some(cookie => cookie.name.startsWith("sb-"))) redirect("/login");
  let access;
  let items: ClaimItem[] = [];
  try {
    access = await authorizeProfile();
    if (access) {
      const profile = await access.read();
      items = await readClaimsOverview(await createClient(), access.userId, profile?.skills ?? []);
    }
  } catch {
    return <AppShell pageTitle="Verify your profile" privateAccount><div className="empty-state"><h1>Verification is temporarily unavailable.</h1><p>We could not load your claims. Please try again.</p><Link href="/account/verification" className="button primary">Try again</Link><Link href="/account" className="text-button">Back to profile</Link></div></AppShell>;
  }
  if (!access) redirect("/login");
  return <AppShell pageTitle="Verify your profile" privateAccount>
    <div className="account-content">
      <div className="page-heading"><div><p className="eyebrow">PROVE WHAT YOU CLAIM</p><h1>Verify your profile<span>.</span></h1><p>Add proof for your education, work and skills. Confirmed facts earn a badge employers can trust.</p></div><Link href="/account" className="text-button">← Back to profile</Link></div>
      <ClaimsBoard items={items} />
    </div>
  </AppShell>;
}
