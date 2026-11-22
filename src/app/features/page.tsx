import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { FeatureDirectory } from "@/components/features/feature-directory";
import { plannedItems, readySections } from "@/lib/feature-directory";
import { featureFacts } from "@/lib/feature-facts";
import { loadLearningAccount } from "@/lib/learning/page-data";
import { readSkillResults } from "@/lib/skill-checks";
import { workshopService } from "@/lib/workshops/service";

export const metadata = { title: "All features - CareerForge", robots: { index: false, follow: false } };

export default async function FeaturesPage() {
  const account = await loadLearningAccount();
  if (account.status !== "ready") {
    return <AppShell pageTitle="All features" privateAccount><div className="empty-state"><h1>Your workspace is temporarily unavailable.</h1><p>We could not verify and load your account.</p><Link href="/features" className="button primary">Try again</Link></div></AppShell>;
  }
  // Each fact is optional: a slow or failing source only removes its own line.
  const [saved, checks] = await Promise.all([
    account.client.from("saved_jobs").select("job_id", { count: "exact", head: true }).eq("user_id", account.userId),
    readSkillResults(account.client, account.userId).catch(() => null)
  ]);
  const facts = featureFacts({
    snapshot: account.snapshot,
    workshops: workshopService.peek(),
    applications: saved.error ? null : saved.count,
    passedChecks: checks && [...new Set(checks.filter(check => check.passed).map(check => check.skill))],
    skills: account.profile.skills.length,
    now: workshopService.now()
  });
  return <AppShell pageTitle="All features" privateAccount displayName={account.profile.name || "Your workspace"}>
    <FeatureDirectory sections={readySections()} planned={plannedItems()} facts={facts} />
  </AppShell>;
}
