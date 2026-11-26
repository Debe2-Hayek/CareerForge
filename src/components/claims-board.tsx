"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { claimStatusInfo, trustSummary, type ClaimItem, type ClaimKind } from "@/lib/claims/model";
import { issuerForLink, ISSUER_NAMES } from "@/lib/claims/issuers";
import { ClaimBadge } from "./claim-badge";
import { AppIcon } from "./app-icons";
import { SkillCheckRunner } from "./skill-check-runner";

/** A skill check opened right here, over the Verification page. */
function CheckDialog({ skill, learnHref, onClose }: { skill: string; learnHref: string | null; onClose: (passed: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const passed = useRef(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="check-dialog" aria-label={`${skill} check`} onClose={() => onClose(passed.current)} onCancel={event => { event.preventDefault(); dialog.current?.close(); }}>
    <button type="button" className="check-dialog-x" aria-label="Close" onClick={() => dialog.current?.close()}><AppIcon name="close" /></button>
    <SkillCheckRunner skill={skill} onProfile learnHref={learnHref} onClose={() => dialog.current?.close()} onFinished={outcome => { passed.current = outcome.passed; }} />
  </dialog>;
}

const GROUPS: { kind: ClaimKind; title: string; proof: string; empty: string; add: { href: string; label: string } }[] = [
  { kind: "degree", title: "Education", proof: "Diploma, transcript or graduation certificate", empty: "No education records yet.", add: { href: "/account/history", label: "Add education" } },
  { kind: "employment", title: "Work experience", proof: "Work certificate, contract or reference letter", empty: "No jobs yet.", add: { href: "/account/history", label: "Add experience" } },
  { kind: "language", title: "Languages", proof: "Test score report (IELTS, TOEFL, Duolingo, DELF/DALF, TCF, Goethe…) or a language certificate", empty: "No languages yet.", add: { href: "/account/history#languages", label: "Add languages" } },
  { kind: "skill", title: "Skills", proof: "Course certificate or a CareerForge skill check", empty: "No skills yet.", add: { href: "/account", label: "Add skills" } }
];
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const sentText = (item: ClaimItem) => [item.evidenceCount ? plural(item.evidenceCount, "file") : "", item.linkCount ? plural(item.linkCount, "link") : ""].filter(Boolean).join(" and ") || "Proof";
const dateFormat = new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" });

function ProofButton({ item, onDone }: { item: ClaimItem; onDone: (message: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canAdd = item.status !== "reviewed" && item.status !== "verified" && item.evidenceCount < 5;

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!/\.(pdf|png|jpe?g)$/i.test(file.name)) { setError("Choose a PDF, PNG or JPG file."); return; }
    if (file.size > 4 * 1024 * 1024) { setError("Choose a file smaller than 4 MB."); return; }
    const form = new FormData();
    form.set("kind", item.kind);
    if (item.kind === "skill") form.set("skill", item.skill ?? ""); else form.set("recordId", item.recordId ?? "");
    form.set("file", file);
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/v1/claims/evidence", { method: "POST", body: form, signal: AbortSignal.timeout(60000) });
      const body = await response.json().catch(() => null);
      if (!response.ok) { setError(body?.error?.message ?? "The proof could not be uploaded."); return; }
      onDone(`Proof sent for “${item.title}”. A reviewer will check it.`);
    } catch { setError("The upload did not finish. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  if (!canAdd) return null;
  const label = item.status === "evidence_submitted" ? (item.evidenceCount ? "Add another file" : "Add a file") : item.status === "rejected" || item.status === "changed" ? "Send new proof" : "Add proof";
  return <div className="claim-proof">
    <input ref={input} type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={upload} disabled={busy} aria-label={`${label} for ${item.title}`} tabIndex={-1} />
    <button type="button" className={item.status === "self_declared" || item.status === "rejected" || item.status === "changed" ? "button primary claim-proof-button" : "text-button"} onClick={() => input.current?.click()} disabled={busy}>
      {busy ? "Uploading…" : label}
    </button>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}

/** Adds a public verification link (Coursera, Credly...) as proof for one fact. */
function LinkButton({ item, onDone }: { item: ClaimItem; onDone: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (item.status === "reviewed" || item.status === "verified" || item.linkCount >= 3) return null;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!issuerForLink(url)) { setError(`Paste the public verification link from ${ISSUER_NAMES.slice(0, 4).join(", ")} or another listed issuer.`); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/v1/claims/links", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ kind: item.kind, recordId: item.kind === "skill" ? null : item.recordId, skill: item.kind === "skill" ? item.skill : null, url: url.trim() }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) { setError(body?.error?.message ?? "The link could not be saved."); return; }
      setOpen(false); setUrl("");
      onDone(`${body?.issuer ?? "Verification"} link added for “${item.title}”. A reviewer will check it with the issuer.`);
    } catch { setError("The link did not save. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  if (!open) return <button type="button" className="text-button claim-link-toggle" onClick={() => setOpen(true)}><AppIcon name="external" />Add a verification link</button>;
  return <form className="claim-link-form" onSubmit={save}>
    <label htmlFor={`link-${item.key}`}>Public verification link</label>
    <div>
      <input id={`link-${item.key}`} type="url" inputMode="url" autoComplete="off" spellCheck={false} maxLength={500} placeholder="https://www.coursera.org/verify/…" value={url} onChange={event => setUrl(event.target.value)} disabled={busy} autoFocus aria-describedby={`link-help-${item.key}`} />
      <button type="submit" className="button primary" disabled={busy || !url.trim()}>{busy ? "Saving…" : "Add link"}</button>
      <button type="button" className="text-button" onClick={() => { setOpen(false); setError(""); }} disabled={busy}>Cancel</button>
    </div>
    <small id={`link-help-${item.key}`}>Accepted: {ISSUER_NAMES.join(", ")}. Coursera certificates are confirmed with Coursera directly.</small>
    {error && <p className="form-error" role="alert">{error}</p>}
  </form>;
}

export function ClaimsBoard({ items, learnHrefs = {} }: { items: ClaimItem[]; learnHrefs?: Record<string, string | null> }) {
  const router = useRouter();
  const [checking, setChecking] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const summary = trustSummary(items);
  const percent = summary.total ? Math.round((summary.confirmed / summary.total) * 100) : 0;

  function done(text: string) { setMessage(text); router.refresh(); }

  return <div className="claims-board">
    <section className="panel claims-summary" aria-label="Verification summary">
      <div>
        <p className="eyebrow">YOUR TRUST LEVEL</p>
        <h2>{summary.total ? `${summary.confirmed} of ${summary.total} facts confirmed` : "Nothing to verify yet"}</h2>
        <p>Employers trust what is proven. Add proof to each fact; a CareerForge reviewer checks it, and confirmed facts get a badge on your CV.</p>
      </div>
      <div className="claims-meter" role="img" aria-label={`${percent}% of your facts are confirmed`}>
        <div className="claims-meter-bar"><span style={{ width: `${percent}%` }} /></div>
        <dl>
          <div><dt><span className="claim-badge-dot tone-verified" />Confirmed</dt><dd>{summary.confirmed}</dd></div>
          <div><dt><span className="claim-badge-dot tone-pending" />In review</dt><dd>{summary.pending}</dd></div>
          <div><dt><span className="claim-badge-dot tone-neutral" />Self-declared</dt><dd>{summary.selfDeclared}</dd></div>
        </dl>
      </div>
    </section>

    <details className="claims-legend">
      <summary>What the badges mean</summary>
      <ul>{(["self_declared", "evidence_submitted", "reviewed", "verified", "rejected"] as const).map(status => <li key={status}><ClaimBadge status={status} /><span>{claimStatusInfo[status].help}</span></li>)}</ul>
    </details>

    <div aria-live="polite">{message && <p className="notice claims-message" role="status">✓ {message}</p>}</div>

    <Link href="/account/certificates" className="panel claims-project-link">
      <span className="claims-project-icon" aria-hidden="true">✓</span>
      <span><strong>Earn a CareerForge certificate</strong><small>Complete a CareerForge workshop and get a certificate anyone can check online.</small></span>
      <span aria-hidden="true">→</span>
    </Link>

    <Link href="/account/projects" className="panel claims-project-link">
      <span className="claims-project-icon" aria-hidden="true">{"</>"}</span>
      <span><strong>Prove a project you built</strong><small>Answer four questions about your own GitHub code in 20 minutes. A reviewed interview is strong evidence.</small></span>
      <span aria-hidden="true">→</span>
    </Link>

    {GROUPS.map(group => {
      const list = items.filter(item => item.kind === group.kind);
      return <section key={group.kind} className="panel claims-group" aria-labelledby={`claims-${group.kind}`}>
        <header>
          <div><h3 id={`claims-${group.kind}`}>{group.title}</h3><p>Accepted proof: {group.proof}. PDF, PNG or JPG, up to 4 MB, or a public verification link. Only you and CareerForge reviewers can open your files.</p></div>
          <Link href={group.add.href} className="text-button">{group.add.label} <span aria-hidden="true">→</span></Link>
        </header>
        {!list.length ? <p className="claims-empty">{group.empty}</p> : <ul className="claims-list">
          {list.map(item => <li key={item.key} className="claim-row" data-status={item.status}>
            <div className="claim-main">
              <strong>{item.title}</strong>
              {item.kind !== "skill" && <span>{item.detail}</span>}
              {item.status === "verified" && item.method && <small>{item.method}{item.date ? ` · ${dateFormat.format(new Date(item.date))}` : ""}</small>}
              {item.status === "reviewed" && item.date && <small>Reviewed · {dateFormat.format(new Date(item.date))}</small>}
              {item.status === "evidence_submitted" && <small>{sentText(item)} sent · waiting for a reviewer</small>}
              {item.status === "rejected" && item.note && <small className="claim-note">Reviewer: {item.note}</small>}
              {item.status === "changed" && <small>You edited this after sending proof.</small>}
            </div>
            <ClaimBadge status={item.status} />
            <div className="claim-actions">
              {item.checkAvailable && <button type="button" className="claim-check-button" onClick={() => setChecking(item.title)}><AppIcon name="checks" /><span>Take the check<small>instant ✓</small></span></button>}
              <ProofButton item={item} onDone={done} />
              <LinkButton item={item} onDone={done} />
            </div>
          </li>)}
        </ul>}
      </section>;
    })}
    {checking && <CheckDialog skill={checking} learnHref={learnHrefs[checking.toLowerCase()] ?? null} onClose={passed => { setChecking(null); if (passed) done(`${checking} is now Verified.`); else router.refresh(); }} />}
  </div>;
}
