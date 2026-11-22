import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CoursesPage } from "@/components/roadmaps/library-pages";
import { loadLearningAccount } from "@/lib/learning/page-data";
import { readLibraryQuery } from "@/lib/roadmaps/library-query";

export const metadata = { title: "Free courses - CareerForge", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const account = await loadLearningAccount();
  if (account.status !== "ready") {
    return <AppShell pageTitle="Learning roadmap" privateAccount><div className="empty-state"><h1>Free courses are temporarily unavailable.</h1><p>We could not confirm your account.</p><Link href="/learning-roadmap/courses" className="button primary">Try again</Link></div></AppShell>;
  }
  return <AppShell pageTitle="Learning roadmap" privateAccount displayName={account.profile.name}>
    <CoursesPage search={readLibraryQuery(await searchParams)} />
  </AppShell>;
}
