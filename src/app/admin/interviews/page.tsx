import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AdminTabs } from "@/components/admin-tabs";
import { InterviewReviewQueue } from "@/components/interview-review-queue";
import { authorizeReview } from "@/lib/claims/server";
import { readInterviewQueue, type InterviewQueueItem } from "@/lib/project-interview/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review project interviews - CareerForge", robots: { index: false, follow: false } };

export default async function Page() {
  if (!(await cookies()).getAll().some(cookie => cookie.name.startsWith("sb-"))) redirect("/login");
  let access;
  let items: InterviewQueueItem[] = [];
  try {
    access = await authorizeReview();
    if (access) items = await readInterviewQueue(access.client);
  } catch {
    return <AppShell pageTitle="Project interviews" privateAccount><div className="empty-state"><h1>The interview queue is temporarily unavailable.</h1><Link href="/admin/interviews" className="button primary">Try again</Link></div></AppShell>;
  }
  if (!access) notFound();
  return <AppShell pageTitle="Project interviews" privateAccount>
    <div className="account-content">
      <div className="page-heading"><div><p className="eyebrow">ADMIN · PROJECT INTERVIEWS</p><h1>Review project interviews<span>.</span></h1><p>Run the AI review to re-read the repository at the recorded commit, confirm the ownership code and the quoted lines, and score each answer. Then decide.</p></div><span className="outline-label">{items.length} waiting</span></div>
      <AdminTabs current="interviews" />
      <InterviewReviewQueue items={items} />
    </div>
  </AppShell>;
}
