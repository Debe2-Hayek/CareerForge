"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CERTIFICATE_LIMITS, formatDay, kindHelp, kindLabel, sessionText, type CertifiedWorkshop } from "@/lib/certified-workshops";

type Enrollment = { workshopId: string; status: "enrolled" | "withdrawn"; showName: boolean; attended: boolean | null };
type Certificate = { id: string; workshopId: string; kind: "attendance" | "assessed"; scope: string; issuedAt: string; revokedAt: string | null };

function WorkshopCard({ workshop, enrollment, now, onDone }: { workshop: CertifiedWorkshop; enrollment?: Enrollment; now: string; onDone: (text: string) => void }) {
  const router = useRouter();
  const enrolled = enrollment?.status === "enrolled";
  const [showName, setShowName] = useState(enrollment?.showName ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const upcoming = Date.parse(workshop.startsAt) > Date.parse(now);

  async function send(action: "enroll" | "withdraw", name = showName) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/v1/certified-workshops", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000),
        body: JSON.stringify(action === "enroll" ? { action, workshopId: workshop.id, showName: name } : { action, workshopId: workshop.id }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) { setError(body?.error?.message ?? "The change could not be saved."); return; }
      onDone(action === "withdraw" ? `You left “${workshop.title}”.` : enrolled ? "Your choice is saved." : `You are enrolled in “${workshop.title}”.`);
      router.refresh();
    } catch { setError("The change did not save. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  return <li className="learner-workshop" data-enrolled={enrolled ? "yes" : "no"}>
    <div className="learner-workshop-main">
      <p className="eyebrow">{kindLabel[workshop.certificateKind].toUpperCase()}{workshop.passMark ? ` · PASS MARK ${workshop.passMark}` : ""}</p>
      <h3>{workshop.title}</h3>
      <p className="learner-workshop-when">{sessionText(workshop.startsAt, workshop.endsAt)} · {workshop.mode === "online" ? "Online" : "In person"}{workshop.location ? ` · ${workshop.location}` : ""}{workshop.trainerDisplay ? ` · with ${workshop.trainerDisplay}` : ""}</p>
      {workshop.summary && <p>{workshop.summary}</p>}
      <small>{kindHelp[workshop.certificateKind]}</small>
    </div>
    <div className="learner-workshop-actions">
      {upcoming && <label className="learner-consent"><input type="checkbox" checked={showName} onChange={event => { setShowName(event.target.checked); if (enrolled) void send("enroll", event.target.checked); }} disabled={busy} />
        Show my name when someone checks my certificate</label>}
      {enrolled ? <>
        <span className="learner-enrolled">✓ Enrolled</span>
        {upcoming && <button type="button" className="text-button" onClick={() => send("withdraw")} disabled={busy}>Leave</button>}
      </> : upcoming && workshop.status === "open" ? <button type="button" className="button primary" onClick={() => send("enroll")} disabled={busy}>{busy ? "Saving…" : "Enroll"}</button>
        : <span className="muted-note">Enrollment closed</span>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </li>;
}

/** Learner view: CareerForge workshops to join, and the certificates earned. */
export function LearnerWorkshops({ workshops, enrollments, certificates, origin, now }: { workshops: CertifiedWorkshop[]; enrollments: Enrollment[]; certificates: Certificate[]; origin: string; now: string }) {
  const [message, setMessage] = useState("");
  const mine = new Map(enrollments.map(item => [item.workshopId, item]));
  const titles = new Map(workshops.map(item => [item.id, item.title]));
  const listed = workshops.filter(item => item.status === "open" || mine.get(item.id)?.status === "enrolled");

  return <div className="learner-workshops">
    <div aria-live="polite">{message && <p className="notice" role="status">✓ {message}</p>}</div>
    <section className="panel" aria-labelledby="my-certificates-title">
      <h2 id="my-certificates-title">Your certificates</h2>
      {!certificates.length ? <p className="claims-empty">No certificates yet. Complete a CareerForge workshop below to earn one.</p> : <ul className="certificate-list">
        {certificates.map(item => <li key={item.id} data-revoked={item.revokedAt ? "yes" : "no"}>
          <span className="certificate-seal" aria-hidden="true">{item.revokedAt ? "!" : "✓"}</span>
          <div>
            <strong>{titles.get(item.workshopId) ?? "CareerForge workshop"}</strong>
            <span>{kindLabel[item.kind]} · {item.scope}</span>
            <small>{item.revokedAt ? `Revoked on ${formatDay(item.revokedAt)}` : `Issued ${formatDay(item.issuedAt)} · check at ${origin.replace(/^https:\/\//, "")}/certificates/${item.id.slice(0, 8)}…`}</small>
          </div>
          <a className="text-button" href={`/certificates/${item.id}`} target="_blank" rel="noopener noreferrer">Public check ↗</a>
        </li>)}
      </ul>}
      <p className="muted-note">{CERTIFICATE_LIMITS} Valid certificates also appear on your checked-profile page.</p>
    </section>
    <section className="panel" aria-labelledby="open-workshops-title">
      <h2 id="open-workshops-title">CareerForge workshops</h2>
      {!listed.length ? <p className="claims-empty">No CareerForge workshops are open right now. Check back soon, or browse free workshops from other organisers.</p>
        : <ul className="learner-workshop-list">{listed.map(item => <WorkshopCard key={item.id} workshop={item} enrollment={mine.get(item.id)} now={now} onDone={setMessage} />)}</ul>}
    </section>
  </div>;
}
