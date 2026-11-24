"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ProofMatch, QueueItem, StoredLinkCheck } from "@/lib/claims/server";
import { issuerForLink } from "@/lib/claims/issuers";
import { checkResultSchema, type CheckResult } from "@/lib/claims/evidence-check";

const resultText = { match: "Matches", mismatch: "Does not match", missing: "Not found on the document", check: "Compare yourself" } as const;
const statusText = { consistent: "Consistent with the claim", attention: "Needs your attention", unreadable: "Could not be read" } as const;

/** The AI reading of one proof file, compared field by field with the claim. A hint, never a decision. */
function AiCheck({ evidenceId, initial, disabled }: { evidenceId: string; initial: CheckResult | null; disabled: boolean }) {
  const [check, setCheck] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/v1/admin/claims/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ evidenceId }), signal: AbortSignal.timeout(70000) });
      const body = await response.json().catch(() => null);
      if (!response.ok) { setError(body?.error?.message ?? "The AI check could not run."); return; }
      const parsed = checkResultSchema.safeParse(body?.check);
      if (!parsed.success) { setError("The AI answer could not be read."); return; }
      setCheck(parsed.data);
    } catch { setError("The AI check did not finish. Try again."); }
    finally { setBusy(false); }
  }
  const test = check?.model === "careerforge-test-ai";
  return <div className={`ai-check${check ? ` status-${check.status}` : ""}`}>
    <div className="ai-check-head">
      <span className="ai-check-title"><span aria-hidden="true">✦</span> AI pre-check{test && <em>test AI, not real</em>}</span>
      {check && <span className={`ai-check-status status-${check.status}`}>{statusText[check.status]}</span>}
      <button type="button" className="text-button" onClick={run} disabled={busy || disabled}>{busy ? "Reading the file…" : check ? "Check again" : "Run AI check"}</button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!check && !error && <p className="ai-check-hint">The AI reads the file and compares the name, institution, title and dates with the claim. It costs one AI request; the same file is never read twice.</p>}
    {check && check.findings.length > 0 && <table className="ai-check-table">
      <thead><tr><th scope="col">Field</th><th scope="col">Claim</th><th scope="col">Document says</th><th scope="col">Result</th></tr></thead>
      <tbody>{check.findings.map(finding => <tr key={finding.field} className={`result-${finding.result}`}>
        <th scope="row">{finding.label}</th><td>{finding.claim || "—"}</td><td>{finding.document || "—"}</td>
        <td><span className="ai-result"><span aria-hidden="true">{finding.result === "match" ? "✓" : finding.result === "mismatch" ? "✗" : "?"}</span>{resultText[finding.result]}</span></td>
      </tr>)}</tbody>
    </table>}
    {check && (check.extracted.certificateId || check.extracted.verificationUrl || check.extracted.notes.length > 0) && <ul className="ai-check-extra">
      {check.extracted.certificateId && <li><span>Certificate number</span>{check.extracted.certificateId}</li>}
      {/* Shown as text, not a link: a web address printed on a document is untrusted. */}
      {check.extracted.verificationUrl && <li><span>Verification address on the document</span><code>{check.extracted.verificationUrl}</code></li>}
      {check.extracted.notes.map((note, index) => <li key={index}><span>Note</span>{note}</li>)}
    </ul>}
    {check && <p className="ai-check-hint">The AI only reads; a convincing fake can read perfectly. Always open the file before deciding.</p>}
  </div>;
}

const matchText = {
  same_file: { label: "Identical file", help: "Byte for byte the same file." },
  same_text: { label: "Same text", help: "The same PDF text, re-saved or re-exported." },
  same_number: { label: "Same certificate number", help: "The AI check read the same number on both." },
  similar_image: { label: "Near-identical image", help: "The same picture re-saved, or the same design with edited text. Compare names, dates and numbers." }
} as const;
const claimState: Record<string, string> = { evidence_submitted: "waiting", reviewed: "approved", rejected: "rejected" };

/** Fingerprint state and matches with other accounts for one file. Hints, never a decision. */
function FileIntegrity({ file }: { file: QueueItem["evidence"][number] }) {
  if (file.fingerprint === "altered") return <div className="proof-integrity" data-state="altered" role="note">
    <p><strong>The fingerprint sent with this file is wrong.</strong> It did not arrive through CareerForge&apos;s upload form unchanged. Treat it as suspicious.</p>
    {file.matches.length > 0 && <MatchList matches={file.matches} />}
  </div>;
  if (file.matches.length) return <div className="proof-integrity" data-state="match" role="note">
    <p><strong>Matches proof from {new Set(file.matches.map(match => match.ownerName)).size === 1 ? "another account" : "other accounts"}.</strong> Open both and compare before deciding.</p>
    <MatchList matches={file.matches} />
  </div>;
  return <p className="proof-integrity" data-state={file.fingerprint}>
    {file.fingerprint === "verified" ? <><span aria-hidden="true">✓</span> Fingerprint checked · no match in other accounts</> : "Fingerprint pending: reload in a moment."}
  </p>;
}

function MatchList({ matches }: { matches: ProofMatch[] }) {
  return <ul className="proof-matches">
    {matches.map(match => <li key={`${match.path}-${match.reason}`}>
      {match.mime.startsWith("image/") && match.url ? <a href={match.url} target="_blank" rel="noopener noreferrer" className="review-thumb small">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={match.url} alt={`Matching proof from ${match.ownerName}`} loading="lazy" />
      </a> : <span className="proof-match-icon" aria-hidden="true">{match.mime === "application/pdf" ? "PDF" : "IMG"}</span>}
      <div>
        <strong data-reason={match.reason}>{matchText[match.reason].label}</strong>
        <span>{match.ownerName} · {match.subject} · {claimState[match.status] ?? match.status}</span>
        <small>{matchText[match.reason].help}</small>
      </div>
      {match.url ? <a href={match.url} target="_blank" rel="noopener noreferrer" className="text-button">Open ↗</a> : <span className="muted-note">Link unavailable</span>}
    </li>)}
  </ul>;
}

const linkResult = {
  confirmed: "Issuer confirms",
  name_mismatch: "Different holder",
  not_found: "No certificate at this address",
  failed: "Could not reach the issuer"
} as const;

function LinkRow({ link, ownerName, disabled }: { link: QueueItem["links"][number]; ownerName: string; disabled: boolean }) {
  const [check, setCheck] = useState<StoredLinkCheck | null>(link.check);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const known = issuerForLink(link.url);
  const auto = Boolean(known?.courseraCode);
  async function run() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/v1/admin/claims/link-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ linkId: link.id }), signal: AbortSignal.timeout(30000) });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.check) { setError(body?.error?.message ?? "The link could not be checked."); return; }
      setCheck(body.check);
    } catch { setError("The check did not finish. Try again."); }
    finally { setBusy(false); }
  }
  return <li className="proof-link" data-result={check?.status ?? "none"}>
    <div className="proof-link-head">
      <span className="proof-link-issuer">{known?.issuer.name ?? "Link"}</span>
      <code title={link.url}>{link.url.replace(/^https:\/\//, "")}</code>
      <a href={link.url} target="_blank" rel="noopener noreferrer nofollow" className="text-button">Open ↗</a>
      {auto && <button type="button" className="text-button" onClick={run} disabled={busy || disabled}>{busy ? "Asking Coursera…" : check ? "Check again" : `Check with ${known!.issuer.name}`}</button>}
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {check ? <div className="proof-link-result">
      <strong><span aria-hidden="true">{check.status === "confirmed" ? "✓" : check.status === "failed" ? "?" : "✗"}</span> {linkResult[check.status]}</strong>
      {check.status === "confirmed" && <span>{check.holderName} completed “{check.title}”{check.issuer ? ` (${check.issuer})` : ""}{check.issuedOn ? `, ${check.issuedOn}` : ""}. Make sure the course supports this claim.</span>}
      {check.status === "name_mismatch" && <span>The certificate belongs to <b>{check.holderName || "someone else"}</b>, not {ownerName}{check.title ? `: “${check.title}”` : ""}.</span>}
      {check.status === "not_found" && <span>The issuer shows no certificate for this code. The link may be made up or mistyped.</span>}
      {check.status === "failed" && <span>Try again, or open the link yourself.</span>}
    </div> : <p className="ai-check-hint">{auto ? "CareerForge reads the public certificate page and compares the holder's name with the profile. Free; no AI is used." : `${known?.issuer.name ?? "This site"} cannot be read automatically. Open it and compare the name, title and date yourself.`}</p>}
  </li>;
}

const kindLabel = { degree: "Degree", employment: "Work experience", skill: "Skill" } as const;
const when = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const size = (bytes: number) => bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function ReviewCard({ item, onDecided }: { item: QueueItem; onDecided: (text: string) => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const altered = item.evidence.some(file => file.fingerprint === "altered");
  const duplicates = altered || item.evidence.some(file => file.matches.length > 0);
  const badLink = item.links.some(link => link.check && link.check.status !== "confirmed" && link.check.status !== "failed");

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

  return <article className={`panel review-card${duplicates || badLink ? " has-duplicate" : ""}`} aria-labelledby={`review-${item.id}`}>
    <header>
      <div>
        <p className="eyebrow">{kindLabel[item.kind].toUpperCase()} · {item.ownerName}</p>
        <h3 id={`review-${item.id}`}>{item.subject}</h3>
        <small>Sent {when.format(new Date(item.updatedAt))}</small>
      </div>
      {(duplicates || badLink) && <p className="review-flag" role="note"><strong>{altered ? "A file was altered on the way in." : duplicates ? "Proof matches another account." : "A verification link does not match."}</strong> See the details below before deciding.</p>}
    </header>
    {item.evidence.length > 0 && <ul className="review-files">
      {item.evidence.map(file => <li key={file.path} className="review-file">
        {file.mime.startsWith("image/") && file.url && <a href={file.url} target="_blank" rel="noopener noreferrer" className="review-thumb">
          {/* Short-lived private link; next/image cannot optimise signed URLs. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={file.url} alt={`Proof: ${file.fileName}`} loading="lazy" />
        </a>}
        <div>
          <strong>{file.fileName}</strong>
          <span>{file.mime === "application/pdf" ? "PDF" : file.mime === "image/png" ? "PNG" : "JPG"} · {size(file.size)}</span>
        </div>
        {file.url ? <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-button">Open ↗</a> : <span className="muted-note">Link unavailable</span>}
        <FileIntegrity file={file} />
        <AiCheck evidenceId={file.id} initial={file.check} disabled={busy} />
      </li>)}
    </ul>}
    {item.links.length > 0 && <section className="proof-links" aria-label="Verification links">
      <h4>Verification links</h4>
      <ul>{item.links.map(link => <LinkRow key={link.id} link={link} ownerName={item.ownerName} disabled={busy} />)}</ul>
    </section>}
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
