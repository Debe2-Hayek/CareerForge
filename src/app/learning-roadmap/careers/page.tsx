import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { LearningRoadmap, type GuidedLink } from "@/components/learning-roadmap";
import { loadLearningAccount } from "@/lib/learning/page-data";
import { collectSkillEvidence } from "@/lib/learning/evidence";
import { parseLearningTrackId, type LearningTrackId } from "@/lib/learning-path";
import { readSkillResults } from "@/lib/skill-checks";
import { trackerAccess } from "@/lib/tracker/server";

export const metadata = { title: "Career roadmaps - CareerForge", robots: { index: false, follow: false } };

// Career-roadmap steps that a guided path teaches in depth. Links open the
// matching topic; enrolled learners keep their own settings, others get a preview.
const pythonTopics: Record<string, string> = {
  python: "how-programs-work", sql: "databases", git: "git-github", testing: "testing", http: "web-apis",
  "api-design": "rest-design", "api-security": "auth", docker: "deployment", "data-cleaning": "pandas",
  statistics: "statistics", "data-visualization": "visualization"
};
const previewGoal: Partial<Record<LearningTrackId, string>> = { backend: "backend", "full-stack": "backend", "data-analyst": "data", devops: "automation" };

export default async function CareersPage({ searchParams }: { searchParams: Promise<{ target?: string | string[]; track?: string | string[] }> }) {
  const params = await searchParams;
  const account = await loadLearningAccount();
  if (account.status !== "ready") {
    return <AppShell pageTitle="Learning roadmap" privateAccount><div className="empty-state"><h1>Career roadmaps are temporarily unavailable.</h1><p>We could not load your saved profile.</p><Link href="/learning-roadmap/careers" className="button primary">Try again</Link></div></AppShell>;
  }
  const [jobs, checks] = await Promise.all([
    trackerAccess(account.client, account.userId).jobs().catch(() => []),
    readSkillResults(account.client, account.userId).catch(() => [])
  ]);
  const evidence = collectSkillEvidence(account.snapshot, checks.filter(result => result.passed).map(result => result.skill));
  const { target } = params;
  const targetId = typeof target === "string" && target.length <= 100 ? target : target === undefined ? undefined : "invalid";
  const trackId = typeof params.track === "string" ? parseLearningTrackId(params.track) : undefined;
  const goal = (trackId && previewGoal[trackId]) ?? "foundations";
  const guidedLinks: Record<string, GuidedLink> = Object.fromEntries(Object.entries(pythonTopics).map(([step, topic]) => [step, {
    href: `/learning-roadmap/python?goal=${goal}&level=new&hours=6&format=mixed&topic=${topic}`,
    label: "Learn this step in the guided Python path"
  }]));
  return <AppShell pageTitle="Learning roadmap" privateAccount displayName={account.profile.name}>
    <nav aria-label="Breadcrumb" className="learning-breadcrumb"><Link href="/learning-roadmap">Learning roadmap</Link> <span aria-hidden="true">/</span> Career roadmaps</nav>
    <LearningRoadmap profile={account.profile} jobs={jobs} targetId={targetId} trackId={trackId} evidence={evidence} guidedLinks={guidedLinks} />
  </AppShell>;
}
