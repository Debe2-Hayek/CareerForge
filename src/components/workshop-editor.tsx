"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { kindHelp, type CertifiedWorkshop } from "@/lib/certified-workshops";

type Values = { title: string; summary: string; mode: "online" | "in_person"; location: string; startsAt: string; endsAt: string; capacity: string;
  certificateKind: "attendance" | "assessed"; passMark: string; trainerDisplay: string; agreementNote: string; status: CertifiedWorkshop["status"] };
// <input type="datetime-local"> works in local time; the database stores UTC.
const toLocal = (iso: string) => { const date = new Date(iso); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const blank: Values = { title: "", summary: "", mode: "online", location: "", startsAt: "", endsAt: "", capacity: "30", certificateKind: "attendance", passMark: "70", trainerDisplay: "", agreementNote: "", status: "draft" };

/** Admin: create or edit a CareerForge workshop and assign its trainer. */
export function WorkshopEditor({ workshop, agreementNote = "", trainerEmail = "" }: { workshop?: CertifiedWorkshop; agreementNote?: string; trainerEmail?: string }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(workshop ? {
    title: workshop.title, summary: workshop.summary, mode: workshop.mode, location: workshop.location, startsAt: toLocal(workshop.startsAt), endsAt: toLocal(workshop.endsAt),
    capacity: String(workshop.capacity), certificateKind: workshop.certificateKind, passMark: String(workshop.passMark ?? 70), trainerDisplay: workshop.trainerDisplay, agreementNote, status: workshop.status
  } : blank);
  const [email, setEmail] = useState(trainerEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues(current => ({ ...current, [key]: value }));

  async function post(body: unknown) {
    const response = await fetch("/api/v1/admin/certified-workshops", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    return { ok: response.ok, data: await response.json().catch(() => null) };
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!values.startsAt || !values.endsAt) { setError("Set the start and end."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const fields = { ...values, startsAt: new Date(values.startsAt).toISOString(), endsAt: new Date(values.endsAt).toISOString(), capacity: Number(values.capacity), passMark: values.certificateKind === "assessed" ? Number(values.passMark) : null };
      const saved = await post({ action: "save", id: workshop?.id ?? null, fields });
      if (!saved.ok) { setError(saved.data?.error?.message ?? "The workshop could not be saved."); return; }
      if (email.trim() !== trainerEmail.trim()) {
        const assigned = await post({ action: "assign", workshopId: saved.data.id, email: email.trim() });
        if (!assigned.ok) { setError(assigned.data?.error?.message ?? "The trainer could not be assigned."); router.refresh(); return; }
      }
      setMessage(workshop ? "Workshop saved." : "Workshop created.");
      if (!workshop) { setValues(blank); setEmail(""); }
      router.refresh();
    } catch { setError("The change did not save. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  const id = workshop?.id ?? "new";
  return <form className="workshop-editor" onSubmit={save} noValidate>
    <div className="workshop-editor-grid">
      <label className="wide">Title<input value={values.title} onChange={event => set("title", event.target.value)} maxLength={120} required /></label>
      <label className="wide">Summary<textarea rows={2} value={values.summary} onChange={event => set("summary", event.target.value)} maxLength={600} /></label>
      <label>Format<select value={values.mode} onChange={event => set("mode", event.target.value as Values["mode"])}><option value="online">Online</option><option value="in_person">In person</option></select></label>
      <label>Place or link note<input value={values.location} onChange={event => set("location", event.target.value)} maxLength={120} placeholder={values.mode === "online" ? "Zoom link sent by email" : "Room, building, city"} /></label>
      <label>Starts<input type="datetime-local" value={values.startsAt} onChange={event => set("startsAt", event.target.value)} required /></label>
      <label>Ends<input type="datetime-local" value={values.endsAt} onChange={event => set("endsAt", event.target.value)} required /></label>
      <label>Seats<input type="number" min={1} max={500} value={values.capacity} onChange={event => set("capacity", event.target.value)} /></label>
      <label>Status<select value={values.status} onChange={event => set("status", event.target.value as Values["status"])}>
        <option value="draft">Draft (staff only)</option><option value="open">Open for enrollment</option><option value="closed">Closed</option><option value="cancelled">Cancelled</option>
      </select></label>
      <label>Certificate type<select value={values.certificateKind} onChange={event => set("certificateKind", event.target.value as Values["certificateKind"])}>
        <option value="attendance">Attendance only</option><option value="assessed">Assessed (pass mark)</option>
      </select><small>{kindHelp[values.certificateKind]}</small></label>
      {values.certificateKind === "assessed" && <label>Pass mark (out of 100)<input type="number" min={1} max={100} value={values.passMark} onChange={event => set("passMark", event.target.value)} /></label>}
      <label>Trainer name on certificates<input value={values.trainerDisplay} onChange={event => set("trainerDisplay", event.target.value)} maxLength={80} placeholder="As agreed with the trainer" /></label>
      <label>Trainer&apos;s account email<input id={`trainer-${id}`} type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="off" placeholder="They manage attendance" /></label>
      <label className="wide">Trainer agreement reference<input value={values.agreementNote} onChange={event => set("agreementNote", event.target.value)} maxLength={300} placeholder="For example: Agreement TR-2026-04 signed 20 Nov 2026, filed by the director" />
        <small>Required before certificates can be issued. Record where the signed agreement is kept; CareerForge does not sign it for anyone.</small></label>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div aria-live="polite">{message && <p className="notice" role="status">✓ {message}</p>}</div>
    <div className="workshop-editor-actions"><button type="submit" className="button primary" disabled={busy}>{busy ? "Saving…" : workshop ? "Save workshop" : "Create workshop"}</button></div>
  </form>;
}
