import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AdminTabs } from "@/components/admin-tabs";
import { SkillDraftStudio } from "@/components/skill-draft-studio";
import { authorizeReview } from "@/lib/claims/server";
import { readDraftsOverview } from "@/lib/skill-check-drafts-server";
import type { BankOverview, DraftRow } from "@/lib/skill-check-drafts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Skill checks studio - CareerForge", robots: { index: false, follow: false } };

export default async function Page() {
  if (!(await cookies()).getAll().some(cookie => cookie.name.startsWith("sb-"))) redirect("/login");
  let access;
  let data: { drafts: DraftRow[]; live: BankOverview[] } = { drafts: [], live: [] };
  try {
    access = await authorizeReview();
    if (access) data = await readDraftsOverview(access.client);
  } catch {
    return <AppShell pageTitle="Skill checks studio" privateAccount><div className="empty-state"><h1>The studio is temporarily unavailable.</h1><Link href="/admin/skill-checks" className="button primary">Try again</Link></div></AppShell>;
  }
  if (!access) notFound();
  return <AppShell pageTitle="Skill checks studio" privateAccount>
    <div className="account-content">
      <div className="page-heading"><div><p className="eyebrow">ADMIN · SKILL CHECKS</p><h1>Skill checks studio<span>.</span></h1><p>Prepare timed checks for any skill. The AI drafts, you decide what students see.</p></div></div>
      <AdminTabs current="skill-checks" />
      <SkillDraftStudio drafts={data.drafts} live={data.live} />
    </div>
  </AppShell>;
}
