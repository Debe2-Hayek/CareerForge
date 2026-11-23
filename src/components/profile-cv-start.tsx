"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { autofillResponseSchema, type ProfileAutofill } from "@/lib/ai/profile-autofill";
import type { AccountProfile } from "@/lib/account/schemas";
import { AppIcon } from "./app-icons";
import { ProfileAutofillReview } from "./profile-autofill-review";

type Reply = { result: ProfileAutofill; cached: boolean; remaining: number | null };
const MAX_BYTES = 4 * 1024 * 1024;
const PROGRESS = { cv: ["Reading your CV…", "Finding your education and experience…", "Checking every fact against your CV…"], notes: ["Reading what you wrote…", "Organising your details…", "Checking every fact against your text…"] };

function fileProblem(file: File) {
  // The server checks the real file type and size again; this only gives quick feedback.
  if (!/\.(pdf|docx)$/i.test(file.name)) return "Choose a PDF or Word (.docx) CV.";
  if (!file.size) return "This file is empty. Choose a CV with content.";
  if (file.size > MAX_BYTES) return "This file is too large. Choose a CV smaller than 4 MB.";
  return "";
}

export function ProfileCVStart({ disabled = false, profile, dirty = false, onSaved }: { disabled?: boolean; profile: AccountProfile; dirty?: boolean; onSaved: (profile: AccountProfile) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<"cv" | "notes" | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [reply, setReply] = useState<Reply | null>(null);

  useEffect(() => {
    if (!busy) return;
    const id = window.setInterval(() => setProgress(step => Math.min(step + 1, PROGRESS[busy].length - 1)), 2600);
    return () => window.clearInterval(id);
  }, [busy]);

  function choose(next: File | undefined) {
    if (!next) return;
    const problem = fileProblem(next);
    setError(problem);
    setFile(problem ? null : next);
  }
  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    choose(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
  }
  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (!locked) choose(event.dataTransfer.files?.[0]);
  }
  function removeFile() {
    setFile(null);
    setError("");
    input.current?.focus();
  }

  async function ask(source: "cv" | "notes") {
    if (busy) return;
    if (!consent) { setError("Tick the box above to agree before the AI reads your text."); return; }
    const form = new FormData();
    form.set("source", source);
    form.set("consent", "yes");
    if (source === "cv") { if (!file) return; form.set("file", file); }
    else form.set("text", notes);
    setBusy(source); setProgress(0); setError(""); setReply(null);
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
  const step = reply ? 3 : consent ? 2 : 1;

  return <section className="profile-cv-start" aria-labelledby="profile-start-title">
    <div className="profile-start-heading">
      <p className="eyebrow">START YOUR PROFILE</p>
      <h2 id="profile-start-title">Let AI fill in your profile<span>.</span></h2>
      <p>Upload your CV or describe yourself. The AI suggests your details, CareerForge removes anything that isn&apos;t in your own text, and you choose what to save.</p>
    </div>

    <ol className="profile-ai-steps" aria-label="How it works">
      {["Agree", "Add your CV or notes", "Review and save"].map((label, i) => <li key={label} className={i + 1 < step ? "done" : i + 1 === step ? "current" : undefined} aria-current={i + 1 === step ? "step" : undefined}>
        <span aria-hidden="true">{i + 1 < step ? "✓" : i + 1}</span>{label}
      </li>)}
    </ol>

    <label className={`profile-ai-consent${consent ? " agreed" : ""}`}>
      <input type="checkbox" checked={consent} onChange={event => { setConsent(event.target.checked); setError(""); }} disabled={locked} />
      <span className="profile-ai-consent-icon" aria-hidden="true"><AppIcon name="shield" /></span>
      <span><strong>I agree to send my CV text or notes to DeepSeek</strong> to get suggestions. DeepSeek is an AI service with servers in China. Your file is not stored; the answer is kept privately for 30 days so the same text never uses AI twice.</span>
    </label>

    <div className="profile-start-options">
      <section className="panel profile-start-card" aria-labelledby="existing-cv-title">
        <p className="eyebrow">HAVE A CV?</p>
        <h3 id="existing-cv-title">Upload your CV</h3>
        <p>The AI reads it and suggests your details, education and work experience.</p>
        <div className={`profile-cv-drop${dragging ? " dragging" : ""}${file ? " has-file" : ""}`} onDragOver={event => { event.preventDefault(); if (!locked) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
          {file ? <div className="profile-cv-file" role="status">
            <span className="profile-cv-file-icon" aria-hidden="true"><AppIcon name="cv" /></span>
            <p><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB · ready</span></p>
            <button type="button" className="text-button" onClick={removeFile} disabled={locked} aria-label={`Remove ${file.name}`}>Remove</button>
          </div> : <>
            <span className="profile-cv-drop-icon" aria-hidden="true"><AppIcon name="cv" /></span>
            <p><strong>Drop your CV here</strong> or <label htmlFor="profile-cv-file" className="profile-cv-browse">choose a file</label></p>
            <small id="profile-cv-format">PDF or Word (.docx), up to 4 MB and 8 pages</small>
          </>}
          <input ref={input} id="profile-cv-file" className="profile-cv-input" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={selectFile} disabled={locked} aria-describedby="profile-cv-format" />
        </div>
        <div className="profile-start-actions">
          <button type="button" className="button primary" onClick={() => ask("cv")} disabled={locked || !file}>{busy === "cv" ? <><span className="profile-ai-spinner" aria-hidden="true" />Reading…</> : <><AppIcon name="spark" />Read my CV with AI</>}</button>
          <Link href="#account-name" className="text-button">Enter details by hand <span aria-hidden="true">↓</span></Link>
        </div>
      </section>

      <section className="panel profile-start-card" aria-labelledby="new-cv-title">
        <p className="eyebrow">NO CV YET?</p>
        <h3 id="new-cv-title">Describe yourself</h3>
        <p>Where you studied, where you worked, what you know and what you built. Write it the way you&apos;d tell a friend.</p>
        <label className="profile-ai-notes">
          <span className="sr-only">About you</span>
          <textarea rows={5} maxLength={6000} value={notes} onChange={event => setNotes(event.target.value)} disabled={locked} placeholder="I study computer science at… I interned at… I know… I built…" aria-describedby="profile-ai-notes-count" />
          <small id="profile-ai-notes-count" className={notesLength >= 40 ? "ready" : undefined}>{notesLength < 40 ? `${40 - notesLength} more characters to go` : `${notesLength.toLocaleString("en")} / 6,000`}</small>
        </label>
        <div className="profile-start-actions">
          <button type="button" className="button primary" onClick={() => ask("notes")} disabled={locked || notesLength < 40}>{busy === "notes" ? <><span className="profile-ai-spinner" aria-hidden="true" />Thinking…</> : <><AppIcon name="spark" />Suggest my details</>}</button>
          <Link href="/documents" className="text-button">Build a CV instead <span aria-hidden="true">↗</span></Link>
        </div>
      </section>
    </div>

    <div aria-live="polite" className="profile-ai-live">
      {busy && <p className="profile-ai-progress"><span className="profile-ai-spinner" aria-hidden="true" />{PROGRESS[busy][progress]}</p>}
      {error && <p className="form-error profile-ai-error" role="alert">{error}</p>}
    </div>
    {reply && <ProfileAutofillReview key={JSON.stringify(reply.result)} result={reply.result} cached={reply.cached} remaining={reply.remaining} profile={profile} dirty={dirty} onSaved={onSaved} onDiscard={() => setReply(null)} />}
  </section>;
}
