import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LearnerWorkshops } from "@/components/learner-workshops";
import { WorkshopRoster } from "@/components/workshop-roster";
import { createClient } from "@/lib/supabase/server";
import { readLearnerView, readRoster, type LearnerView } from "@/lib/certified-workshops-server";
import type { Roster } from "@/lib/certified-workshops";
import { siteOrigin } from "@/lib/site-url";

export const dynamic = "force-dynamic";
export const metadata = { title: "Workshops & certificates - CareerForge", robots: { index: false, follow: false } };

export default async function Page() {
  if (!(await cookies()).getAll().some(cookie => cookie.name.startsWith("sb-"))) redirect("/login");
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login");
  let view: LearnerView;
  let rosters: Roster[] = [];
  try {
    view = await readLearnerView(client, user.id);
    rosters = await Promise.all(view.teaching.map(id => readRoster(client, id)));
  } catch {
    return <AppShell pageTitle="Workshops & certificates" privateAccount><div className="empty-state"><h1>Workshops are temporarily unavailable.</h1><Link href="/account/certificates" className="button primary">Try again</Link></div></AppShell>;
  }
  const now = new Date().toISOString();
  const taught = view.teaching.flatMap((id, index) => {
    const workshop = view.workshops.find(item => item.id === id);
    return workshop ? [{ workshop, roster: rosters[index] }] : [];
  });
  return <AppShell pageTitle="Workshops & certificates" privateAccount>
    <div className="account-content">
      <div className="page-heading"><div><p className="eyebrow">LEARN · EARN · PROVE</p><h1>Workshops &amp; certificates<span>.</span></h1><p>Join CareerForge workshops run by approved trainers. Complete one and CareerForge issues a certificate anyone can check online.</p></div><Link href="/workshops" className="text-button">Free workshops from other organisers →</Link></div>
      <LearnerWorkshops workshops={view.workshops} enrollments={view.enrollments} certificates={view.certificates} origin={siteOrigin} now={now} />
      {taught.length > 0 && <section className="teaching" aria-labelledby="teaching-title">
        <h2 id="teaching-title">Workshops you teach</h2>
        <p className="muted-note">Record attendance (and scores for assessed workshops) once the session starts; issue certificates when it ends.</p>
        {taught.map(item => <WorkshopRoster key={item.workshop.id} workshop={item.workshop} roster={item.roster} isAdmin={false} now={now} />)}
      </section>}
    </div>
  </AppShell>;
}
