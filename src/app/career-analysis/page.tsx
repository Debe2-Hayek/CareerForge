import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CareerAnalysis } from "@/components/career-analysis";
import { loadLearningAccount } from "@/lib/learning/page-data";
import { analyseCareers } from "@/lib/career-analysis/server";
import { readCheckableSkills } from "@/lib/skill-checks";

export const dynamic = "force-dynamic";
export const metadata = { title: "Career analysis - CareerForge", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ career?: string | string[] }> }) {
  const query = await searchParams;
  const account = await loadLearningAccount();
  if (account.status !== "ready") return <AppShell pageTitle="Career analysis" privateAccount><div className="empty-state"><h1>Career analysis is temporarily unavailable.</h1><p>We could not load your profile.</p><Link href="/career-analysis" className="button primary">Try again</Link></div></AppShell>;
  let result;
  let checks: string[] = [];
  try { [result, checks] = await Promise.all([analyseCareers(account.client, account.userId, account.profile, account.snapshot, typeof query.career === "string" ? query.career : null), readCheckableSkills(account.client)]); }
  catch { return <AppShell pageTitle="Career analysis" privateAccount><div className="empty-state"><h1>Career analysis is temporarily unavailable.</h1><Link href="/career-analysis" className="button primary">Try again</Link></div></AppShell>; }
  const empty = !account.profile.skills.length && !result.ranked.some(career => career.score > 0);
  return <AppShell pageTitle="Career analysis" privateAccount displayName={account.profile.name}>
    <div className="account-content">
      <div className="page-heading"><div><p className="eyebrow">WHERE YOU STAND</p><h1>Find the career you are closest to<span>.</span></h1><p>Every career is scored against your skills, your proof and what you have learned on CareerForge, with the gaps ranked Critical, Important or Optional.</p></div></div>
      <CareerAnalysis ranked={result.ranked} detail={result.detail} empty={empty} checks={checks} />
    </div>
  </AppShell>;
}
