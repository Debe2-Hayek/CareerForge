"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent } from "react";
import { autofillResponseSchema, type ProfileAutofill } from "@/lib/ai/profile-autofill";
import type { AccountProfile } from "@/lib/account/schemas";
import { ProfileAutofillReview } from "./profile-autofill-review";

type Reply = { result: ProfileAutofill; cached: boolean; remaining: number | null };

export function ProfileCVStart({ disabled = false, profile, dirty = false, onSaved }: { disabled?: boolean; profile: AccountProfile; dirty?: boolean; onSaved: (profile: AccountProfile) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<"cv" | "notes" | null>(null);
  const [error, setError] = useState("");
  const [reply, setReply] = useState<Reply | null>(null);

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.currentTarget.files?.[0];
    if (!next) return;
    setFile(null);
    setError("");
    // The server checks the real file type and size again; this only gives quick feedback.
    if (!/\.(pdf|docx)$/i.test(next.name)) setError("Choose a PDF or Word (.docx) CV.");
    else if (!next.size) setError("This file is empty. Choose a CV with content.");
    else if (next.size > 4 * 1024 * 1024) setError("This file is too large. Choose a CV smaller than 4 MB.");
    else setFile(next);
    event.currentTarget.value = "";
  }

  function removeFile() {
    setFile(null);
    setError("");
    input.current?.focus();
  }

  async function ask(source: "cv" | "notes") {
    if (busy) return;
    if (!consent) { setError("Tick the box to agree before the AI reads your text."); return; }
    const form = new FormData();
    form.set("source", source);
    form.set("consent", "yes");
    if (source === "cv") { if (!file) return; form.set("file", file); }
    else form.set("text", notes);
    setBusy(source); setError(""); setReply(null);
    try {
      const response = await fetch("/api/v1/profile/autofill", { method: "POST", body: form, signal: AbortSignal.timeout(90000) });
      const body = await response.json().catch(() => null);
      if (!response.ok) { setError(body?.error?.message ?? "The AI could not read this. Please try again."); return; }
      const parsed = autofillResponseSchema.safeParse(body);
      if (!parsed.success) { setError("The AI answer could not be checked. Please try again."); return; }
      setReply(parsed.data);
    } catch { setError("The request did not finish. Check your connection and try again."); }
    finally { setBusy(null); }
  }

  const notesLength = notes.trim().length;
  const locked = disabled || !!busy;

  return <section className="profile-cv-start" aria-labelledby="profile-start-title">
    <div className="profile-start-heading">
      <p className="eyebrow">START YOUR PROFILE</p>
      <h2 id="profile-start-title">Let AI fill in your profile.</h2>
      <p>Upload your CV or describe yourself. The AI suggests your details, removes anything that isn&apos;t in your own text, and you choose what to save.</p>
    </div>
    <label className="profile-ai-consent">
      <input type="checkbox" checked={consent} onChange={event => { setConsent(event.target.checked); setError(""); }} disabled={locked} />
      <span>I agree to send my CV&apos;s text, or what I write below, to <strong>DeepSeek</strong>, an AI service whose servers are in China, to suggest profile details. The file itself is not stored. The AI&apos;s answer is kept privately for 30 days so the same text does not use AI twice.</span>
    </label>
    <div className="profile-start-options">
      <section className="panel profile-start-card" aria-labelledby="existing-cv-title">
        <div className="profile-start-card-heading"><h3 id="existing-cv-title">I have a CV</h3><span className="outline-label">AI autofill</span></div>
        <p>Upload your CV. The AI reads it and suggests your details, education and experience.</p>
        <div className="profile-cv-picker">
          <label htmlFor="profile-cv-file">{file ? "Choose a different CV" : "Choose a CV"}</label>
          <input ref={input} id="profile-cv-file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={selectFile} disabled={locked} aria-describedby={`profile-cv-format${error ? " profile-ai-error" : ""}`} aria-invalid={!!error && !file} />
          <small id="profile-cv-format">PDF or Word (.docx), up to 4 MB and 8 pages. Scanned image CVs can&apos;t be read yet.</small>
        </div>
        <div role="status" className="profile-cv-selection">
          {file && <><p><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB</span></p><button type="button" className="text-button" onClick={removeFile} disabled={locked}>Remove selected CV</button></>}
        </div>
        <button type="button" className="button primary" onClick={() => ask("cv")} disabled={locked || !file}>{busy === "cv" ? <><span className="profile-ai-spinner" aria-hidden="true" /> Reading your CV…</> : "Read my CV with AI"}</button>
        <Link href="#account-name" className="text-button">Enter my details manually <span aria-hidden="true">↓</span></Link>
      </section>
      <section className="panel profile-start-card" aria-labelledby="new-cv-title">
        <p className="eyebrow">NO CV YET?</p>
        <h3 id="new-cv-title">Tell the AI about yourself</h3>
        <label className="profile-ai-notes" htmlFor="profile-ai-notes">
          <span>Where you studied, where you worked, what you know and what you built. Write it the way you&apos;d tell a friend.</span>
          <textarea id="profile-ai-notes" rows={5} maxLength={6000} value={notes} onChange={event => setNotes(event.target.value)} disabled={locked} placeholder="I study computer science at… I interned at… I know… I built…" />
          <small>{notesLength < 40 ? `At least 40 characters (${notesLength} so far)` : `${notesLength} / 6,000 characters`}</small>
        </label>
        <button type="button" className="button primary" onClick={() => ask("notes")} disabled={locked || notesLength < 40}>{busy === "notes" ? <><span className="profile-ai-spinner" aria-hidden="true" /> Thinking…</> : "Suggest my details"}</button>
        <Link href="/documents" className="text-button">Or build your first CV in CV &amp; Portfolio <span aria-hidden="true">↗</span></Link>
      </section>
    </div>
    <div aria-live="polite">
      {error && <p id="profile-ai-error" className="form-error" role="alert">{error}</p>}
      {reply && <ProfileAutofillReview key={JSON.stringify(reply.result)} result={reply.result} cached={reply.cached} remaining={reply.remaining} profile={profile} dirty={dirty} onSaved={onSaved} onDiscard={() => setReply(null)} />}
    </div>
  </section>;
}
