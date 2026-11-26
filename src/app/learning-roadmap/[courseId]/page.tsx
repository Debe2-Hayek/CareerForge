import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { toViewRoadmap } from "@/components/roadmaps/client-types";
import { RoadmapExtras } from "@/components/roadmaps/roadmap-extras";
import { RoadmapView } from "@/components/roadmaps/roadmap-view";
import { loadLearningAccount } from "@/lib/learning/page-data";
import { slugSchema } from "@/lib/learning/schema";
import { getRoadmap } from "@/lib/roadmaps/catalog";
import { roadmapLookup } from "@/lib/roadmaps/lookup";
import { marksFor, trackFor, trackShowing } from "@/lib/roadmaps/progress";
import { readCheckableSkills } from "@/lib/skill-checks";
import { checkForRoadmap } from "@/lib/skill-check-links";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ courseId: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }) {
  const roadmap = getRoadmap((await params).courseId);
  return { title: `${roadmap?.title ?? "Learning"} roadmap - CareerForge`, robots: { index: false, follow: false } };
}

export default async function RoadmapPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  // Verify the session first so guests are redirected before any route detail is revealed.
  const account = await loadLearningAccount();
  const roadmap = getRoadmap((await params).courseId);
  if (!roadmap) notFound();
  if (account.status !== "ready") {
    return <AppShell pageTitle="Learning roadmap" privateAccount><div className="empty-state"><h1>This roadmap is temporarily unavailable.</h1><p>We could not confirm your account. Your saved progress is unchanged.</p><Link href={`/learning-roadmap/${roadmap.id}`} className="button primary">Try again</Link></div></AppShell>;
  }
  const search = await searchParams;
  const topic = slugSchema.safeParse(search.topic);
  const project = slugSchema.safeParse(search.project);
  const topicId = topic.success && roadmap.sections.some(section => section.topics.some(item => item.id === topic.data)) ? topic.data : null;
  const projectId = project.success && roadmap.projects.some(item => item.id === project.data) ? project.data : null;
  const enrollment = account.snapshot?.enrollments.find(item => item.courseId === roadmap.id);

  return <AppShell pageTitle="Learning roadmap" privateAccount displayName={account.profile.name}>
    <RoadmapView
      key={roadmap.id}
      roadmap={toViewRoadmap(roadmap, roadmapLookup)}
      initialMarks={marksFor(roadmap, account.snapshot)}
      initialProjects={account.snapshot?.progress[roadmap.id]?.projects ?? {}}
      initialTrack={trackShowing(roadmap, trackFor(roadmap, account.snapshot), topicId)}
      started={Boolean(enrollment)}
      settings={{ level: enrollment?.level ?? "new", weeklyHours: enrollment?.weeklyHours ?? 6, format: enrollment?.format ?? "mixed" }}
      storageAvailable={account.snapshot !== null}
      initialOpen={topicId ? { kind: "topic", id: topicId } : projectId ? { kind: "project", id: projectId } : null}
    >
      <RoadmapExtras roadmap={roadmap} check={checkForRoadmap(roadmap, await createClient().then(readCheckableSkills, () => []))} />
    </RoadmapView>
  </AppShell>;
}
