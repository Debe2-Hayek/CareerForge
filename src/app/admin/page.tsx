import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { authorizeReview, readReviewQueue, type QueueItem } from "@/lib/claims/server";
import { readDraftsOverview } from "@/lib/skill-check-drafts-server";
import { readInterviewQueue } from "@/lib/project-interview/server";
import { readWorkshops } from "@/lib/certified-workshops-server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin dashboard - CareerForge", robots: { index: false, follow: false } };

const KIND: Record<QueueItem["kind"], string> = { degree: "Degree", employment: "Work", skill: "Skill", language: "Language" };
const ago = (iso: string, now: number) => {
  const hours = Math.max(0, Math.round((now - Date.parse(iso)) / 3600000));
  return hours < 1 ? "just now" : hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
};
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Beirut" });

/** The time this request is served (a server page renders once per request). */
function requestTime() { return Date.now(); }

/** The admin home: what needs a decision now, and how checks and workshops are doing. Admins only. */
export default async function AdminDashboard() {
  if (!(await cookies()).getAll().some(cookie => cookie.name.startsWith("sb-"))) redirect("/login");
  let access;
  try { access = await authorizeReview(); } catch { access = null; }
  if (!access) notFound();
  const client = access.client;
  // Each part loads on its own: if one fails, the rest of the dashboard still shows.
  const [queue, interviews, checks, workshops] = await Promise.all([
    readReviewQueue(client).catch(() => null),
    readInterviewQueue(client).catch(() => null),
    readDraftsOverview(client).catch(() => null),
    readWorkshops(client).catch(() => null)
  ]);
  const now = requestTime();
  const proof = (queue ?? []).filter(item => !item.own);
  const flagged = proof.filter(item => item.evidence.some(file => file.fingerprint === "altered" || file.matches.length > 0 || file.duplicateOwners > 0));
  const toScore = (interviews ?? []).filter(item => item.submittedAt && !item.own);
  const live = checks?.live ?? [];
  const drafts = (checks?.drafts ?? []).filter(draft => draft.status === "draft");
  const attempts = live.reduce((sum, bank) => sum + bank.attempts, 0);
  const passes = live.reduce((sum, bank) => sum + bank.passes, 0);
  const upcoming = (workshops ?? []).filter(workshop => workshop.status === "open" && Date.parse(workshop.endsAt) > now).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const waiting = proof.length + toScore.length;

  return <AppShell pageTitle="Admin dashboard" privateAccount displayName="CareerForge Admin">
    <div className="account-content admin-home">
      <div className="page-heading admin-heading">
        <div>
          <p className="eyebrow">ADMIN</p>
          <h1>{waiting ? <>{waiting} {waiting === 1 ? "thing needs" : "things need"} you<span>.</span></> : <>All caught up<span>.</span></>}</h1>
          <p>Review proof, keep skill checks fresh and run workshops. Every decision here changes what employers can trust.</p>
        </div>
      </div>

      <div className="admin-stats">
        <Link href="/admin/claims" className="admin-stat" data-tone={proof.length ? "warn" : "ok"}>
          <span className="admin-stat-label">Proof waiting</span>
          <strong>{queue ? proof.length : "–"}</strong>
          <small>{queue ? (flagged.length ? `${flagged.length} flagged: altered or copied files` : "No warning signs") : "Could not load"}</small>
        </Link>
        <Link href="/admin/interviews" className="admin-stat" data-tone={toScore.length ? "warn" : "ok"}>
          <span className="admin-stat-label">Interviews to score</span>
          <strong>{interviews ? toScore.length : "–"}</strong>
          <small>{interviews ? `${(interviews ?? []).length} in total` : "Could not load"}</small>
        </Link>
        <Link href="/admin/skill-checks" className="admin-stat">
          <span className="admin-stat-label">Skill checks live</span>
          <strong>{checks ? live.length : "–"}</strong>
          <small>{checks ? `${attempts} attempts · ${attempts ? Math.round(passes / attempts * 100) : 0}% pass${drafts.length ? ` · ${drafts.length} draft${drafts.length === 1 ? "" : "s"}` : ""}` : "Could not load"}</small>
        </Link>
        <Link href="/admin/workshops" className="admin-stat">
          <span className="admin-stat-label">Workshops open</span>
          <strong>{workshops ? upcoming.length : "–"}</strong>
          <small>{workshops ? `${workshops.length} in total` : "Could not load"}</small>
        </Link>
      </div>

      <div className="admin-grid">
        <section className="panel admin-panel" aria-labelledby="admin-proof-title">
          <header><h2 id="admin-proof-title">Proof waiting for you</h2><Link href="/admin/claims" className="text-button">Open the queue <span aria-hidden="true">→</span></Link></header>
          {!queue ? <p className="admin-empty">The review queue could not be loaded. Open it to try again.</p>
            : !proof.length ? <p className="admin-empty">Nothing waiting. New uploads appear here.</p>
            : <ul className="admin-list">{proof.slice(0, 6).map(item => {
              const warn = item.evidence.some(file => file.fingerprint === "altered" || file.matches.length > 0 || file.duplicateOwners > 0);
              return <li key={item.id} data-warn={warn || undefined}>
                <span className="admin-kind">{KIND[item.kind]}</span>
                <span className="admin-item"><b>{item.subject}</b><small>{item.ownerName} · {item.evidence.length} file{item.evidence.length === 1 ? "" : "s"}{item.links.length ? ` · ${item.links.length} link${item.links.length === 1 ? "" : "s"}` : ""} · {ago(item.updatedAt, now)}</small></span>
                {warn && <span className="admin-flag">Check carefully</span>}
              </li>;
            })}</ul>}
        </section>

        <section className="panel admin-panel" aria-labelledby="admin-checks-title">
          <header><h2 id="admin-checks-title">Skill checks</h2><Link href="/admin/skill-checks" className="text-button">Studio <span aria-hidden="true">→</span></Link></header>
          {!checks ? <p className="admin-empty">Skill checks could not be loaded.</p>
            : !live.length ? <p className="admin-empty">No checks published yet. Draft one in the studio.</p>
            : <ul className="admin-list">{live.map(bank => <li key={bank.skill}>
              <span className="admin-kind">v{bank.version}</span>
              <span className="admin-item"><b>{bank.skill}</b><small>{bank.attempts} attempt{bank.attempts === 1 ? "" : "s"} · {bank.passes} passed</small></span>
              <span className="admin-bar" aria-label={`${bank.attempts ? Math.round(bank.passes / bank.attempts * 100) : 0}% pass rate`}><i style={{ width: `${bank.attempts ? Math.round(bank.passes / bank.attempts * 100) : 0}%` }} /></span>
            </li>)}</ul>}
          {drafts.length > 0 && <p className="admin-note">{drafts.length} draft{drafts.length === 1 ? "" : "s"} waiting to be reviewed and published: {drafts.slice(0, 4).map(draft => draft.skill).join(", ")}.</p>}
        </section>

        <section className="panel admin-panel" aria-labelledby="admin-workshops-title">
          <header><h2 id="admin-workshops-title">Upcoming workshops</h2><Link href="/admin/workshops" className="text-button">Manage <span aria-hidden="true">→</span></Link></header>
          {!workshops ? <p className="admin-empty">Workshops could not be loaded.</p>
            : !upcoming.length ? <p className="admin-empty">No open workshops. Create one to start issuing certificates.</p>
            : <ul className="admin-list">{upcoming.slice(0, 5).map(workshop => <li key={workshop.id}>
              <span className="admin-kind">{workshop.mode === "online" ? "Online" : "In person"}</span>
              <span className="admin-item"><b>{workshop.title}</b><small>{day.format(new Date(workshop.startsAt))} · {workshop.trainerDisplay || "No trainer yet"} · {workshop.capacity} seats</small></span>
            </li>)}</ul>}
        </section>

        <section className="panel admin-panel admin-rules" aria-labelledby="admin-rules-title">
          <header><h2 id="admin-rules-title">Good to know</h2></header>
          <ul>
            <li>You can&apos;t approve your own proof. Keep a separate student account for testing.</li>
            <li>A red flag means the file was edited, or the same file, text or certificate number appears in another account.</li>
            <li>Published checks are graded on the server, with a new question order every attempt and a 24-hour wait after a fail.</li>
          </ul>
        </section>
      </div>
    </div>
  </AppShell>;
}
