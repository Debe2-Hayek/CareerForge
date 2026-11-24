import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AdminTabs } from "@/components/admin-tabs";
import { WorkshopEditor } from "@/components/workshop-editor";
import { WorkshopRoster } from "@/components/workshop-roster";
import { authorizeWorkshopAdmin, readRoster, readWorkshops } from "@/lib/certified-workshops-server";
import { sessionText, type CertifiedWorkshop, type Roster } from "@/lib/certified-workshops";

export const dynamic = "force-dynamic";
export const metadata = { title: "Workshops & certificates (admin) - CareerForge", robots: { index: false, follow: false } };
const statusLabel = { draft: "Draft", open: "Open", closed: "Closed", cancelled: "Cancelled" } as const;

export default async function Page() {
  if (!(await cookies()).getAll().some(cookie => cookie.name.startsWith("sb-"))) redirect("/login");
  let access;
  let items: { workshop: CertifiedWorkshop; roster: Roster }[] = [];
  try {
    access = await authorizeWorkshopAdmin();
    if (access) {
      const client = access.client;
      const workshops = await readWorkshops(client);
      items = await Promise.all(workshops.map(async workshop => ({ workshop, roster: await readRoster(client, workshop.id) })));
    }
  } catch {
    return <AppShell pageTitle="Workshops (admin)" privateAccount><div className="empty-state"><h1>Workshops are temporarily unavailable.</h1><Link href="/admin/workshops" className="button primary">Try again</Link></div></AppShell>;
  }
  // Non-admins get the same answer as for a page that does not exist.
  if (!access) notFound();
  const now = new Date().toISOString();
  return <AppShell pageTitle="Workshops (admin)" privateAccount>
    <div className="account-content">
      <div className="page-heading"><div><p className="eyebrow">ADMIN · WORKSHOPS &amp; CERTIFICATES</p><h1>CareerForge workshops<span>.</span></h1><p>Create a workshop, assign its trainer and record the trainer agreement. The trainer (or you) records attendance; certificates are issued once, from that record, after the session ends.</p></div><span className="outline-label">{items.length} {items.length === 1 ? "workshop" : "workshops"}</span></div>
      <AdminTabs current="workshops" />
      <details className="panel workshop-new"><summary>New workshop</summary><WorkshopEditor /></details>
      {items.map(({ workshop, roster }) => <article key={workshop.id} className="admin-workshop" data-status={workshop.status}>
        <WorkshopRoster workshop={workshop} roster={roster} isAdmin now={now} />
        <details className="panel workshop-edit"><summary>Edit “{workshop.title}” · {statusLabel[workshop.status]} · {sessionText(workshop.startsAt, workshop.endsAt)}</summary>
          <WorkshopEditor workshop={workshop} agreementNote={roster.agreementNote ?? ""} trainerEmail={roster.trainerEmail ?? ""} />
        </details>
      </article>)}
    </div>
  </AppShell>;
}
