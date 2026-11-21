import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LearningDashboard } from "@/components/learning/learning-dashboard";
import { loadLearningAccount } from "@/lib/learning/page-data";

export const metadata = { title: "Learning roadmap - CareerForge", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ target?: string | string[]; track?: string | string[] }> }) {
  // Earlier links (jobs dialog, bookmarks) put role targets on this URL; they now live under Career roadmaps.
  const { target, track } = await searchParams;
  if (target !== undefined || track !== undefined) {
    const query = new URLSearchParams();
    if (typeof target === "string" && target.length <= 100) query.set("target", target);
    if (typeof track === "string" && track.length <= 40) query.set("track", track);
    redirect(`/learning-roadmap/careers${query.size ? `?${query}` : ""}`);
  }
  const account = await loadLearningAccount();
  if (account.status !== "ready") {
    return <AppShell pageTitle="Learning roadmap" privateAccount><div className="empty-state"><h1>Your learning roadmap is temporarily unavailable.</h1><p>We could not confirm your account or profile. Your saved progress is unchanged.</p><Link href="/learning-roadmap" className="button primary">Try again</Link></div></AppShell>;
  }
  return <AppShell pageTitle="Learning roadmap" privateAccount displayName={account.profile.name}>
    <LearningDashboard snapshot={account.snapshot} />
  </AppShell>;
}
