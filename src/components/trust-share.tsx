"use client";

import { useState, type ReactNode } from "react";

/**
 * Owner control for the public trust page: off by default; when on, a private link that
 * shows only checked facts. A new link makes the old one stop working.
 */
export function TrustShare({ initialSlug, origin, count, preview }: { initialSlug: string | null; origin: string; count: number; preview: ReactNode }) {
  const [slug, setSlug] = useState(initialSlug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const link = slug ? `${origin}/v/${slug}` : "";

  async function change(enabled: boolean, newLink = false) {
    if (busy) return;
    if (newLink && !window.confirm("Make a new link? The current link will stop working for anyone who has it.")) return;
    setBusy(true); setError(""); setNote("");
    try {
      const response = await fetch("/api/v1/trust-page", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled, newLink }), signal: AbortSignal.timeout(15000) });
      const body = await response.json().catch(() => null);
      if (!response.ok) { setError(body?.error?.message ?? "The change could not be saved."); return; }
      setSlug(body?.enabled ? body.slug : null);
      setNote(!body?.enabled ? "Sharing is off. The link no longer works." : newLink ? "New link ready. The old one no longer works." : "Sharing is on. Copy the link into your CV or messages.");
    } catch { setError("The change did not save. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); setNote("Link copied."); }
    catch { setNote("Select the link and copy it."); }
  }

  return <section className="panel trust-share" aria-labelledby="trust-share-title" data-enabled={slug ? "on" : "off"}>
    <div className="trust-share-head">
      <div>
        <p className="eyebrow">SHARE WHAT IS CHECKED</p>
        <h2 id="trust-share-title">Checked-profile link</h2>
        <p>A private page employers can open from your CV: it lists only the {count === 1 ? "1 fact" : `${count} facts`} CareerForge checked, with how and when. Nothing self-declared, no files, no contact details. Off until you turn it on.</p>
      </div>
      <button type="button" role="switch" aria-checked={Boolean(slug)} className="trust-switch" onClick={() => change(!slug)} disabled={busy}>
        <span aria-hidden="true" /><b>{slug ? "On" : "Off"}</b><span className="sr-only">Share a checked-profile link</span>
      </button>
    </div>
    {slug && <div className="trust-share-link">
      <label className="sr-only" htmlFor="trust-link">Your checked-profile link</label>
      <input id="trust-link" readOnly value={link} onFocus={event => event.currentTarget.select()} />
      <button type="button" className="button primary" onClick={copy}>Copy link</button>
      <a className="text-button" href={`/v/${slug}`} target="_blank" rel="noopener noreferrer">Open ↗</a>
      <button type="button" className="text-button" onClick={() => change(true, true)} disabled={busy}>Make a new link</button>
    </div>}
    <div aria-live="polite">{note && <p className="trust-share-note">✓ {note}</p>}</div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <details className="trust-share-preview">
      <summary>Preview what employers see</summary>
      {preview}
    </details>
  </section>;
}
