import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProjectInterviews } from "@/components/project-interviews";
import { signedInClient } from "@/lib/cv-analysis/server";
import { readOwnInterviews, type InterviewRow } from "@/lib/project-interview/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Project interviews - CareerForge", robots: { index: false, follow: false } };

export default async function Page() {
  if (!(await cookies()).getAll().some(cookie => cookie.name.startsWith("sb-"))) redirect("/login");
  let rows: InterviewRow[] | null = null;
  let signedOut = false;
  try {
    const session = await signedInClient();
    if (!session) signedOut = true;
    else rows = await readOwnInterviews(session.client, session.userId);
  } catch { rows = null; }
  if (signedOut) redirect("/login");
  if (!rows) return <AppShell pageTitle="Project interviews" privateAccount><div className="empty-state"><h1>Project interviews are temporarily unavailable.</h1><Link href="/account/projects" className="button primary">Try again</Link></div></AppShell>;
  return <AppShell pageTitle="Project interviews" privateAccount>
    <div className="account-content">
      <div className="page-heading"><div><p className="eyebrow">PROVE WHAT YOU BUILT</p><h1>Project interviews<span>.</span></h1><p>Answer questions about your own code. A reviewed interview is strong evidence that the project is really yours.</p></div><Link href="/account/verification" className="text-button">← Verify your profile</Link></div>
      <ProjectInterviews rows={rows} serverNow={new Date().toISOString()} />
    </div>
  </AppShell>;
}
