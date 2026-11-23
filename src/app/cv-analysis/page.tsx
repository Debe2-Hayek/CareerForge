import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CvAnalysis } from "@/components/cv-analysis";
import { readAnalysisJobs, readCandidate, signedInClient, type AnalysisJob } from "@/lib/cv-analysis/server";
import type { CandidateInput } from "@/lib/cv-analysis/score";

export const dynamic = "force-dynamic";
export const metadata = { title: "CV analysis - CareerForge", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ job?: string | string[] }> }) {
  if (!(await cookies()).getAll().some(cookie => cookie.name.startsWith("sb-"))) redirect("/login");
  const query = await searchParams;
  const requested = typeof query.job === "string" ? query.job : null;
  let data: { candidate: CandidateInput; name: string; jobs: AnalysisJob[] } | null = null;
  let signedOut = false;
  try {
    const session = await signedInClient();
    if (!session) signedOut = true;
    else {
      const [{ candidate, name }, jobs] = await Promise.all([readCandidate(session.client, session.userId), readAnalysisJobs(session.client, session.userId, requested)]);
      data = { candidate, name, jobs };
    }
  } catch { data = null; }
  if (signedOut) redirect("/login");
  if (!data) return <AppShell pageTitle="CV analysis" privateAccount><div className="empty-state"><h1>CV analysis is temporarily unavailable.</h1><p>We could not load your profile or saved jobs.</p><Link href="/cv-analysis" className="button primary">Try again</Link></div></AppShell>;
  return <AppShell pageTitle="CV analysis" privateAccount displayName={data.name}>
    <div className="account-content">
      <div className="page-heading"><div><p className="eyebrow">CV VS JOB</p><h1>Will your CV land this job<span>?</span></h1><p>Pick a job and see how your saved profile matches it, what is missing and what to do next. Proven skills count more.</p></div></div>
      <CvAnalysis candidate={data.candidate} jobs={data.jobs} initialJobId={requested} />
    </div>
  </AppShell>;
}
