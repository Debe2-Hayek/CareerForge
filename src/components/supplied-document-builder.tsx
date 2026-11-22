"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppIcon } from "./app-shell";
import PortfolioBuilder from "./PortfolioBuilder.jsx";
import { PHOTO_MAX_CHARS, suggestSlug, type BuilderState, type SiteStatus } from "@/lib/portfolio-site";

type SaveState = "idle" | "pending" | "saving" | "saved" | "error" | "conflict";

async function putSite(body: unknown): Promise<{ ok: true; status: SiteStatus } | { ok: false; code: string; message: string }> {
  try {
    const response = await fetch("/api/v1/portfolio-site", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload: unknown = await response.json().catch(() => null);
    if (response.ok) return { ok: true, status: payload as SiteStatus };
    const error = payload && typeof payload === "object" && "error" in payload ? (payload as { error: { code?: string; message?: string } }).error : {};
    return { ok: false, code: error.code ?? "ERROR", message: error.message ?? "Your portfolio could not be saved. Please retry." };
  } catch {
    return { ok: false, code: "OFFLINE", message: "You appear to be offline. Your edits are still on this page." };
  }
}

/** Large uploaded photos are downscaled before saving so drafts stay small and fast to publish. */
async function compactPhoto(photo: string | null): Promise<string | null> {
  if (!photo || photo.length <= PHOTO_MAX_CHARS) return photo;
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = photo;
  });
  for (const [size, quality] of [[640, 0.85], [480, 0.8], [360, 0.75]] as const) {
    const scale = Math.min(1, size / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    const compact = canvas.toDataURL("image/jpeg", quality);
    if (compact.length <= PHOTO_MAX_CHARS) return compact;
  }
  return null;
}

function savedLabel(state: SaveState, savedAt: Date | null) {
  if (state === "pending" || state === "saving") return "Saving…";
  if (state === "error") return "Not saved";
  if (state === "conflict") return "Changed elsewhere";
  if (savedAt) return `Saved ${savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  return "Autosave on";
}

export function SuppliedDocumentBuilder({ initial, origin }: { initial: SiteStatus | null; origin: string }) {
  const [notesCollapsed, setNotesCollapsed] = useState(false);
  const [site, setSite] = useState<SiteStatus | null>(initial);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [slug, setSlug] = useState(initial?.slug ?? suggestSlug(initial?.draft?.data.name ?? ""));
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const revision = useRef<string | null>(initial?.revision ?? null);
  const pending = useRef<BuilderState | null>(null);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestName = useRef(initial?.draft?.data.name ?? "");
  const storageAvailable = initial !== null;

  // One save runs at a time and drains every pending edit, so revisions stay in order.
  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (inFlight.current) return inFlight.current;
    const run = (async () => {
      while (pending.current) {
        const state = pending.current;
        pending.current = null;
        setSaveState("saving");
        const photo = await compactPhoto(state.photo).catch(() => null);
        const result = await putSite({ action: "save", state: { ...state, photo }, revision: revision.current });
        if (!result.ok) {
          pending.current ??= state; // keep the edit so a retry can save it
          setSaveState(result.code === "CONFLICT" ? "conflict" : "error");
          setMessage(result.message);
          return false;
        }
        revision.current = result.status.revision;
        setSite(result.status);
        setSavedAt(new Date());
        setMessage(state.photo && !photo ? "Your photo was too large to save even after resizing; choose a smaller image." : null);
      }
      setSaveState(current => current === "saving" ? "saved" : current);
      return true;
    })();
    inFlight.current = run;
    try { return await run; } finally { inFlight.current = null; }
  }, []);

  const onStateChange = useCallback((state: BuilderState) => {
    latestName.current = state.data.name;
    if (!storageAvailable) return;
    pending.current = state;
    setSaveState(current => current === "conflict" ? current : "pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, 1200);
  }, [flush, storageAvailable]);

  // Save outstanding edits before the tab closes or navigates away.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (pending.current || inFlight.current) { void flush(); event.preventDefault(); } };
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [flush]);

  async function publish() {
    setPublishing(true);
    setMessage(null);
    const saved = await flush();
    if (!saved || !revision.current) {
      setPublishing(false);
      if (!revision.current && saved) setMessage("Make at least one edit so your portfolio is saved before publishing.");
      return;
    }
    const result = await putSite({ action: "publish", slug, revision: revision.current });
    setPublishing(false);
    if (!result.ok) { setMessage(result.message); return; }
    setSite(result.status);
    setMessage(site?.isPublic ? "Your live site is updated." : "Your portfolio is live. Share the link below.");
  }
  async function unpublish() {
    setPublishing(true);
    const result = await putSite({ action: "unpublish" });
    setPublishing(false);
    if (!result.ok) { setMessage(result.message); return; }
    setSite(result.status);
    setMessage("Your site is offline. The address stays reserved for you.");
  }
  async function copyLink(url: string) {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setMessage("Copy failed. Select the address and copy it manually."); }
  }

  const liveUrl = site?.isPublic && site.slug ? `${origin}/u/${site.slug}` : null;
  const status = !storageAvailable ? "Saving unavailable" : savedLabel(saveState, savedAt);

  return <section className="supplied-builder-page" aria-label="CV and portfolio builder" data-notes-collapsed={notesCollapsed}>
    <header className="supplied-builder-bar">
      <div className="builder-bar-summary">
        <span className="builder-bar-kicker"><AppIcon name="portfolio" /> Document studio</span>
        <div className="builder-bar-title">
          <strong>{storageAvailable ? "Your CV & portfolio" : "Sample builder"}</strong>
          <span className="builder-save-state" data-state={saveState} role="status" aria-live="polite">
            <span className="builder-status-dot" aria-hidden="true" />{status}
          </span>
          {liveUrl && <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="builder-live-link">Live at /u/{site?.slug}<span className="sr-only"> (opens in a new tab)</span></a>}
          {site?.hasUnpublishedChanges && <span className="builder-unpublished">Unpublished changes</span>}
        </div>
      </div>
      <div className="supplied-builder-tools">
        <div className="builder-primary-tools">
          <button
            type="button"
            className="builder-notes-toggle"
            aria-label={notesCollapsed ? "Show notes" : "Hide notes"}
            aria-expanded={!notesCollapsed}
            aria-controls="builder-notes-panel"
            onClick={() => setNotesCollapsed(collapsed => !collapsed)}
          >
            <span className="builder-toggle-icon" aria-hidden="true"><AppIcon name="panel" /></span>
            <span className="builder-toggle-copy" aria-hidden="true">
              <strong>Notes editor</strong>
              <small>{notesCollapsed ? "Show writing panel" : "Hide for a wider preview"}</small>
            </span>
            <span className="builder-toggle-chevron" aria-hidden="true"><AppIcon name="chevron" /></span>
          </button>
          {storageAvailable && <button type="button" className="builder-publish-toggle" aria-expanded={panelOpen} aria-controls="builder-publish" onClick={() => {
            setPanelOpen(open => !open);
            if (!slug) setSlug(suggestSlug(latestName.current));
          }}><AppIcon name="portfolio" /><span>{site?.isPublic ? "Manage live site" : "Publish website"}</span><span className="builder-publish-chevron" aria-hidden="true"><AppIcon name="chevron" /></span></button>}
        </div>
        <nav className="builder-account-tools" aria-label="Saved document tools">
          <span className="builder-tools-label">Account tools</span>
          <Link href="/cv/saved"><AppIcon name="cv" /><span>Saved-profile CV</span></Link>
          <Link href="/portfolio/publication"><AppIcon name="portfolio" /><span>Profile portfolio</span></Link>
        </nav>
      </div>
      {panelOpen && <div id="builder-publish" className="builder-publish" role="region" aria-label="Publish your portfolio website">
        <div>
          <h2>{site?.isPublic ? "Your portfolio is live" : "Publish your portfolio as a website"}</h2>
          <p>Visitors see the Web portfolio view, without your private notes. Later edits stay private until you choose <em>Update live site</em>. You can take it offline at any time.</p>
        </div>
        <form onSubmit={event => { event.preventDefault(); void publish(); }}>
          <label htmlFor="site-slug">Web address</label>
          <div className="builder-slug">
            <span aria-hidden="true">{origin.replace(/^https?:\/\//, "")}/u/</span>
            <input id="site-slug" value={slug} onChange={event => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40))}
              minLength={3} maxLength={40} pattern="[a-z0-9]+(-[a-z0-9]+)*" required aria-describedby="site-slug-hint" spellCheck={false} />
          </div>
          <small id="site-slug-hint">3–40 lower-case letters, numbers and single hyphens, e.g. sara-khoury.</small>
          <div className="builder-publish-actions">
            <button type="submit" className="button primary" disabled={publishing || slug.length < 3}>
              {publishing ? "Publishing…" : site?.isPublic ? (site.slug === slug ? "Update live site" : "Move to this address") : "Publish website"}
            </button>
            {site?.isPublic && <button type="button" className="builder-secondary" disabled={publishing} onClick={() => void unpublish()}>Take offline</button>}
          </div>
        </form>
        {liveUrl && <div className="builder-live">
          <a href={liveUrl} target="_blank" rel="noopener noreferrer">{liveUrl}<span className="sr-only"> (opens in a new tab)</span></a>
          <button type="button" className="builder-secondary" onClick={() => void copyLink(liveUrl)}>{copied ? "Copied" : "Copy link"}</button>
        </div>}
      </div>}
      {message && <p className="builder-message" role="alert">{message}{saveState === "conflict" && <> <button type="button" className="builder-secondary" onClick={() => location.reload()}>Reload latest</button></>}</p>}
    </header>
    <PortfolioBuilder initialState={initial?.draft ?? undefined} onStateChange={onStateChange} notesCollapsed={notesCollapsed} />
  </section>;
}
