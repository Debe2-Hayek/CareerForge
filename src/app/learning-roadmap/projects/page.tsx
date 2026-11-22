import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ProjectsPage } from "@/components/roadmaps/library-pages";
import { loadLearningAccount } from "@/lib/learning/page-data";
import { readLibraryQuery } from "@/lib/roadmaps/library-query";

export const metadata = { title: "Projects - CareerForge", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const account = await loadLearningAccount();
  if (account.status !== "ready") {
    return <AppShell pageTitle="Learning roadmap" privateAccount><div className="empty-state"><h1>Projects are temporarily unavailable.</h1><p>We could not confirm your account.</p><Link href="/learning-roadmap/projects" className="button primary">Try again</Link></div></AppShell>;
  }
  return <AppShell pageTitle="Learning roadmap" privateAccount displayName={account.profile.name}>
    <ProjectsPage search={readLibraryQuery(await searchParams)} />
  </AppShell>;
}
