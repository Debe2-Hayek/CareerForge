import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { WorkshopsExperience } from "@/components/workshops/workshops-experience";
import { getRoadmap } from "@/lib/roadmaps/catalog";
import { loadWorkshopsPage } from "@/lib/workshops/server";

export const metadata = { title: "Workshops - CareerForge", robots: { index: false, follow: false } };

export default async function WorkshopsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const data = await loadWorkshopsPage();
  if (data.status !== "ready") {
    return <AppShell pageTitle="Workshops" privateAccount><div className="empty-state"><h1>Workshops are temporarily unavailable.</h1><p>We could not confirm your account. Your saved workshops are unchanged.</p><Link href="/workshops" className="button primary">Try again</Link></div></AppShell>;
  }
  const { topic } = await searchParams;
  const ids = new Set(data.catalog.workshops.flatMap(workshop => workshop.relatedRoadmaps ?? []));
  const roadmapTitles = Object.fromEntries([...ids].flatMap(id => { const roadmap = getRoadmap(id); return roadmap ? [[id, roadmap.title]] : []; }));
  return <AppShell pageTitle="Workshops" privateAccount displayName={data.displayName || "Your workspace"}>
    <WorkshopsExperience initialCatalog={data.catalog} initialBookmarks={data.bookmarks} deviceScope={data.deviceScope}
      initialNow={data.now} initialTopic={typeof topic === "string" ? topic : null} roadmapTitles={roadmapTitles} />
  </AppShell>;
}
