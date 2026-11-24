import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ClaimReviewQueue } from "@/components/claim-review-queue";
import { AdminTabs } from "@/components/admin-tabs";
import { authorizeReview, readReviewQueue, refreshFingerprints, type QueueItem } from "@/lib/claims/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata = { title: "Review claims - CareerForge", robots: { index: false, follow: false } };

export default async function Page() {
  if (!(await cookies()).getAll().some(cookie => cookie.name.startsWith("sb-"))) redirect("/login");
  let access;
  let items: QueueItem[] = [];
  try {
    access = await authorizeReview();
    if (access) {
      // Recompute fingerprints of new files from the stored bytes first; a failure only delays it.
      await refreshFingerprints(access.client).catch(() => 0);
      items = await readReviewQueue(access.client);
    }
  } catch {
    return <AppShell pageTitle="Review claims" privateAccount><div className="empty-state"><h1>The review queue is temporarily unavailable.</h1><Link href="/admin/claims" className="button primary">Try again</Link></div></AppShell>;
  }
  // Non-admins get the same answer as for a page that does not exist.
  if (!access) notFound();
  return <AppShell pageTitle="Review claims" privateAccount>
    <div className="account-content">
      <div className="page-heading"><div><p className="eyebrow">ADMIN · REVIEW QUEUE</p><h1>Review claims<span>.</span></h1><p>Open each file and compare it with the claim: the name, the institution or company, the title and the dates. Approve only when the proof matches; reject with a reason the user will see. Every file is fingerprinted and compared with proof from other accounts.</p></div><span className="outline-label">{items.length} waiting</span></div>
      <AdminTabs current="claims" />
      <ClaimReviewQueue items={items} />
    </div>
  </AppShell>;
}
