"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { QueueItem } from "@/lib/claims/server";

const kindLabel = { degree: "Degree", employment: "Work experience", skill: "Skill" } as const;
const when = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const size = (bytes: number) => bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function ReviewCard({ item, onDecided }: { item: QueueItem; onDecided: (text: string) => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const duplicates = item.evidence.some(file => file.duplicateOwners > 0);

  async function decide(decision: "approve" | "reject") {
    if (busy) return;
    if (decision === "reject" && !note.trim()) { setError("Write a short reason the user will see."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/v1/admin/claims/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ claimId: item.id, decision, note: decision === "reject" ? note.trim() : "" }), signal: AbortSignal.timeout(15000) });
      const body = await response.json().catch(() => null);
      if (!response.ok) { setError(body?.error?.message ?? "The decision could not be saved."); return; }
      onDecided(decision === "approve" ? `Approved: ${item.subject}` : `Rejected: ${item.subject}`);
    } catch { setError("The decision did not finish. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  return <article className={`panel review-card${duplicates ? " has-duplicate" : ""}`} aria-labelledby={`review-${item.id}`}>
    <header>
      <div>
        <p className="eyebrow">{kindLabel[item.kind].toUpperCase()} · {item.ownerName}</p>
        <h3 id={`review-${item.id}`}>{item.subject}</h3>
        <small>Sent {when.format(new Date(item.updatedAt))}</small>
      </div>
      {duplicates && <p className="review-flag" role="note"><strong>Same file used by another account.</strong> Check it carefully.</p>}
    </header>
    <ul className="review-files">
      {item.evidence.map(file => <li key={file.path}>
        {file.mime.startsWith("image/") && file.url && <a href={file.url} target="_blank" rel="noopener noreferrer" className="review-thumb">
          {/* Short-lived private link; next/image cannot optimise signed URLs. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={file.url} alt={`Proof: ${file.fileName}`} loading="lazy" />
        </a>}
        <div>
          <strong>{file.fileName}</strong>
          <span>{file.mime === "application/pdf" ? "PDF" : file.mime === "image/png" ? "PNG" : "JPG"} · {size(file.size)}{file.duplicateOwners > 0 ? ` · also uploaded by ${file.duplicateOwners} other ${file.duplicateOwners === 1 ? "account" : "accounts"}` : ""}</span>
        </div>
        {file.url ? <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-button">Open ↗</a> : <span className="muted-note">Link unavailable</span>}
      </li>)}
    </ul>
    {item.own ? <p className="muted-note">This is your own claim; another reviewer must decide it.</p> : <>
      {rejecting && <label className="review-reason">Reason the user will see
        <textarea rows={2} maxLength={500} value={note} onChange={event => setNote(event.target.value)} placeholder="For example: the name on the diploma does not match the profile." autoFocus />
      </label>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="review-actions">
        {rejecting ? <>
          <button type="button" className="text-button" onClick={() => { setRejecting(false); setError(""); }} disabled={busy}>Cancel</button>
          <button type="button" className="button review-reject" onClick={() => decide("reject")} disabled={busy}>{busy ? "Saving…" : "Reject with reason"}</button>
        </> : <>
          <button type="button" className="text-button" onClick={() => setRejecting(true)} disabled={busy}>Reject…</button>
          <button type="button" className="button primary" onClick={() => decide("approve")} disabled={busy}>{busy ? "Saving…" : "Approve: proof matches"}</button>
        </>}
      </div>
    </>}
  </article>;
}

export function ClaimReviewQueue({ items }: { items: QueueItem[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  return <div className="review-queue">
    <div aria-live="polite">{message && <p className="notice" role="status">✓ {message}</p>}</div>
    {!items.length ? <div className="empty-state"><h2>Nothing to review.</h2><p>New proof appears here as users send it, oldest first.</p></div>
      : items.map(item => <ReviewCard key={item.id} item={item} onDecided={text => { setMessage(text); router.refresh(); }} />)}
  </div>;
}
