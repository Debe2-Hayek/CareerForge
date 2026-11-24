"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { eligible, kindLabel, sessionText, type CertifiedWorkshop, type Roster } from "@/lib/certified-workshops";

async function staff(body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> | null }> {
  const response = await fetch("/api/v1/certified-workshops/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  return { ok: response.ok, data: await response.json().catch(() => null) };
}

/** Staff view of one workshop (its trainer or an admin): attendance, scores, issuing and revoking. */
export function WorkshopRoster({ workshop, roster, isAdmin, now }: { workshop: CertifiedWorkshop; roster: Roster; isAdmin: boolean; now: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [scores, setScores] = useState<Record<string, string>>(() => Object.fromEntries(roster.learners.map(learner => [learner.enrollmentId, learner.score?.toString() ?? ""])));
  const started = Date.parse(workshop.startsAt) <= Date.parse(now);
  const ended = Date.parse(workshop.endsAt) <= Date.parse(now);
  const ready = Boolean(roster.agreementNote?.trim()) && roster.hasTrainer;
  const active = roster.learners.filter(learner => learner.status === "enrolled");
  const due = active.filter(learner => eligible(learner, workshop)).length;

  async function act(key: string, body: unknown, done: (data: Record<string, unknown> | null) => string) {
    if (busy) return;
    setBusy(key); setError(""); setMessage("");
    try {
      const { ok, data } = await staff(body);
      if (!ok) { setError((data?.error as { message?: string } | undefined)?.message ?? "The change could not be saved."); return; }
      setMessage(done(data));
      router.refresh();
    } catch { setError("The change did not save. Check your connection and try again."); }
    finally { setBusy(""); }
  }
  function mark(enrollmentId: string, attended: boolean) {
    const raw = scores[enrollmentId]?.trim() ?? "";
    if (attended && workshop.certificateKind === "assessed" && !/^\d{1,3}$/.test(raw)) { setError("Enter the assessment score (0–100) before marking as present."); return; }
    void act(enrollmentId, { action: "mark", enrollmentId, attended, score: attended && workshop.certificateKind === "assessed" ? Number(raw) : null }, () => "Saved.");
  }
  function revoke(certificateId: string) {
    const reason = window.prompt("Reason for revoking this certificate (kept in the record; the public check only says it was revoked):");
    if (!reason?.trim()) return;
    void act(certificateId, { action: "revoke", certificateId, reason: reason.trim() }, () => "Certificate revoked.");
  }

  return <section className="panel workshop-roster" aria-label={`Roster for ${workshop.title}`}>
    <header>
      <div>
        <p className="eyebrow">{kindLabel[workshop.certificateKind].toUpperCase()}{workshop.passMark ? ` · PASS MARK ${workshop.passMark}` : ""}</p>
        <h3>{workshop.title}</h3>
        <small>{sessionText(workshop.startsAt, workshop.endsAt)} · {active.length} of {workshop.capacity} enrolled</small>
      </div>
      <button type="button" className="button primary" disabled={!ended || !ready || due === 0 || Boolean(busy)} onClick={() => act("issue", { action: "issue", workshopId: workshop.id }, data => `${data?.issued ?? 0} certificate(s) issued.`)}>
        {busy === "issue" ? "Issuing…" : `Issue certificates (${due})`}
      </button>
    </header>
    {!ready && <p className="workshop-warning" role="note">Certificates need an assigned trainer and a recorded trainer agreement{isAdmin ? " (edit the workshop below)." : ". Ask a CareerForge admin."}</p>}
    {!started && <p className="muted-note">Attendance can be recorded once the workshop starts.</p>}
    {started && !ended && <p className="muted-note">Record attendance now; certificates can be issued once the workshop ends.</p>}
    <div aria-live="polite">{message && <p className="notice" role="status">✓ {message}</p>}</div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!roster.learners.length ? <p className="claims-empty">No learners yet.</p> : <ul className="roster-list">
      {roster.learners.map(learner => <li key={learner.enrollmentId} data-state={learner.certificate ? (learner.certificate.revokedAt ? "revoked" : "issued") : learner.status === "withdrawn" ? "withdrawn" : learner.attended === null ? "pending" : learner.attended ? "present" : "absent"}>
        <div className="roster-who">
          <strong>{learner.name}</strong>
          <small>{learner.status === "withdrawn" ? "Withdrew" : learner.attended === null ? "Not marked yet" : learner.attended ? `Present${learner.score !== null ? ` · score ${learner.score}` : ""}` : "Absent"}{learner.showName ? "" : " · name hidden on the public check"}</small>
        </div>
        {learner.certificate ? <div className="roster-cert">
          <span>{learner.certificate.revokedAt ? "Certificate revoked" : "Certificate issued"}</span>
          <a className="text-button" href={`/certificates/${learner.certificate.id}`} target="_blank" rel="noopener noreferrer">Open ↗</a>
          {isAdmin && !learner.certificate.revokedAt && <button type="button" className="text-button" onClick={() => revoke(learner.certificate!.id)} disabled={Boolean(busy)}>Revoke…</button>}
        </div> : learner.status === "enrolled" && <div className="roster-actions">
          {workshop.certificateKind === "assessed" && <label>Score <input inputMode="numeric" value={scores[learner.enrollmentId] ?? ""} onChange={event => setScores(current => ({ ...current, [learner.enrollmentId]: event.target.value }))} disabled={!started || Boolean(busy)} aria-label={`Score for ${learner.name}`} maxLength={3} /></label>}
          <button type="button" className="text-button" onClick={() => mark(learner.enrollmentId, true)} disabled={!started || Boolean(busy)}>Present</button>
          <button type="button" className="text-button" onClick={() => mark(learner.enrollmentId, false)} disabled={!started || Boolean(busy)}>Absent</button>
        </div>}
      </li>)}
    </ul>}
  </section>;
}
