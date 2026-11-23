"use client";

import { useMemo, useState } from "react";
import { profileSchema, type AccountProfile } from "@/lib/account/schemas";
import type { ProfileAutofill } from "@/lib/ai/profile-autofill";

type FieldKey = "name" | "headline" | "location" | "bio" | "education" | "project";
const FIELD_LABELS: Record<FieldKey, string> = { name: "Full name", headline: "Headline", location: "Location", bio: "About you", education: "Education summary", project: "Featured project" };
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

type Props = { result: ProfileAutofill; cached: boolean; remaining: number | null; profile: AccountProfile; dirty: boolean; onSaved: (profile: AccountProfile) => void; onDiscard: () => void };

/** Shows AI suggestions as unticked-by-choice items; only ticked items are saved, as self-declared details. */
export function ProfileAutofillReview({ result, cached, remaining, profile, dirty, onSaved, onDiscard }: Props) {
  const fields = (Object.keys(FIELD_LABELS) as FieldKey[]).filter(key => result.profile[key] && !same(result.profile[key], profile[key]));
  const newSkills = result.profile.skills.filter(skill => !profile.skills.some(existing => same(existing, skill)));
  // Existing values are kept unless the user ticks a replacement; empty ones are filled by default.
  const [pickedFields, setPickedFields] = useState(() => new Set(fields.filter(key => !profile[key].trim())));
  const [pickedSkills, setPickedSkills] = useState(() => new Set(newSkills));
  const [pickedEducation, setPickedEducation] = useState(() => new Set(result.education.map((_, i) => i)));
  const [pickedExperience, setPickedExperience] = useState(() => new Set(result.experience.map((_, i) => i)));
  const requestIds = useMemo(() => ({ education: result.education.map(() => crypto.randomUUID()), experience: result.experience.map(() => crypto.randomUUID()) }), [result]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ education: Set<number>; experience: Set<number>; profile: boolean }>({ education: new Set(), experience: new Set(), profile: false });

  const toggle = <T,>(set: Set<T>, value: T, update: (next: Set<T>) => void) => { const next = new Set(set); if (next.has(value)) next.delete(value); else next.add(value); update(next); };
  const nothing = !fields.length && !newSkills.length && !result.education.length && !result.experience.length;
  const pending = (picked: Set<number>, saved: Set<number>) => [...picked].filter(index => !saved.has(index)).length;
  const selectedCount = (done.profile ? 0 : pickedFields.size + pickedSkills.size) + pending(pickedEducation, done.education) + pending(pickedExperience, done.experience);

  async function save() {
    if (saving || dirty) return;
    setSaving(true); setError(""); setMessage("");
    const failed: string[] = [];
    let saved = 0;
    try {
      if (!done.profile && (pickedFields.size || pickedSkills.size)) {
        const next: AccountProfile = { ...profile, skills: [...profile.skills, ...newSkills.filter(skill => pickedSkills.has(skill))].slice(0, 40) };
        for (const key of pickedFields) next[key] = result.profile[key];
        const parsed = profileSchema.safeParse(next);
        if (!parsed.success) failed.push(next.name.trim() ? "profile details (check field lengths)" : "profile details (a full name is required)");
        else {
          const response = await fetch("/api/v1/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data), signal: AbortSignal.timeout(15000) });
          const body = await response.json().catch(() => null);
          const confirmed = profileSchema.safeParse(body?.profile);
          if (response.ok && confirmed.success) { onSaved(confirmed.data); saved++; setDone(current => ({ ...current, profile: true })); }
          else failed.push(body?.error?.message ?? "profile details");
        }
      }
      for (const kind of ["education", "experience"] as const) {
        const picked = kind === "education" ? pickedEducation : pickedExperience;
        for (const index of picked) {
          if (done[kind].has(index)) continue;
          const item = result[kind][index];
          const fields = kind === "education"
            ? { institution: result.education[index].institution, degree: result.education[index].degree, gpa: null, gpaScale: null }
            : { company: result.experience[index].company, role: result.experience[index].role, description: result.experience[index].description };
          // The request id makes a retry after an uncertain failure safe: the server will not create a duplicate.
          const response = await fetch(`/api/v1/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: requestIds[kind][index], ...fields, startDate: item.startDate, endDate: item.endDate, isCurrent: item.isCurrent }), signal: AbortSignal.timeout(15000) }).catch(() => null);
          if (response?.ok) { saved++; setDone(current => ({ ...current, [kind]: new Set(current[kind]).add(index) })); }
          else {
            const body = await response?.json().catch(() => null);
            failed.push(`${"institution" in fields ? fields.institution : fields.company}${body?.error?.message ? ` (${body.error.message})` : ""}`);
          }
        }
      }
      if (failed.length) setError(`Saved ${saved}. Not saved: ${failed.join("; ")}. Fix it and press save again; saved items will not be duplicated.`);
      else setMessage(`Saved ${saved} ${saved === 1 ? "item" : "items"} to your profile. They are self-declared until verified.`);
    } catch { setError("Saving stopped. Check your connection and press save again; saved items will not be duplicated."); }
    finally { setSaving(false); }
  }

  const allDone = !!message && !error;
  return <section className="panel profile-ai-review" aria-labelledby="profile-ai-review-title">
    <div className="profile-start-card-heading">
      <h3 id="profile-ai-review-title">Check what the AI found</h3>
      <span className="outline-label">Self-declared until verified</span>
    </div>
    <p className="muted-note">{cached ? "You already sent this text, so this is the earlier answer. No AI use counted." : remaining !== null ? `AI requests left today: ${remaining}.` : ""} Tick only what is true. Ticked items are saved as self-declared; verification comes later.</p>

    {nothing && <p>Nothing new was found that isn&apos;t already in your profile.</p>}

    {!!fields.length && <fieldset className="profile-ai-group" disabled={saving || done.profile}>
      <legend>Profile details</legend>
      {fields.map(key => <label key={key} className="profile-ai-item">
        <input type="checkbox" checked={pickedFields.has(key)} onChange={() => toggle(pickedFields, key, setPickedFields)} />
        <span><strong>{FIELD_LABELS[key]}</strong>{result.profile[key]}{profile[key].trim() && <small>Replaces: {profile[key]}</small>}</span>
      </label>)}
    </fieldset>}

    {!!newSkills.length && <fieldset className="profile-ai-group" disabled={saving || done.profile}>
      <legend>New skills</legend>
      <div className="profile-ai-skills">{newSkills.map(skill => <label key={skill} className={`profile-ai-skill${pickedSkills.has(skill) ? " picked" : ""}`}>
        <input type="checkbox" checked={pickedSkills.has(skill)} onChange={() => toggle(pickedSkills, skill, setPickedSkills)} />{skill}
      </label>)}</div>
      {profile.skills.length + pickedSkills.size > 40 && <small className="form-error">Only the first 40 skills are kept.</small>}
    </fieldset>}

    {!!result.education.length && <fieldset className="profile-ai-group" disabled={saving}>
      <legend>Education records</legend>
      {result.education.map((item, i) => <label key={i} className="profile-ai-item">
        <input type="checkbox" checked={pickedEducation.has(i)} disabled={done.education.has(i)} onChange={() => toggle(pickedEducation, i, setPickedEducation)} />
        <span><strong>{item.degree}</strong>{item.institution}{item.years && <small>{item.years}{!item.startDate && !item.endDate ? " · add exact months later in Education & experience" : ""}</small>}{done.education.has(i) && <small>Saved</small>}</span>
      </label>)}
    </fieldset>}

    {!!result.experience.length && <fieldset className="profile-ai-group" disabled={saving}>
      <legend>Work experience</legend>
      {result.experience.map((item, i) => <label key={i} className="profile-ai-item">
        <input type="checkbox" checked={pickedExperience.has(i)} disabled={done.experience.has(i)} onChange={() => toggle(pickedExperience, i, setPickedExperience)} />
        <span><strong>{item.role}</strong>{item.company}{item.years && <small>{item.years}</small>}{item.description && <small>{item.description}</small>}{done.experience.has(i) && <small>Saved</small>}</span>
      </label>)}
    </fieldset>}

    {!!result.languages.length && <p className="muted-note">Languages found: {result.languages.join(", ")}. Your profile can&apos;t store languages yet; language checks are planned.</p>}

    {!!result.removed.length && <details className="profile-ai-removed">
      <summary>Removed because they weren&apos;t in your text ({result.removed.length})</summary>
      <p className="muted-note">The AI suggested these, but CareerForge could not find them in what you gave it, so they were left out.</p>
      <ul>{result.removed.map((item, i) => <li key={i}><strong>{item.field}:</strong> {item.value}</li>)}</ul>
    </details>}

    {dirty && <p className="form-error" role="status">You have unsaved edits in the form below. Save or undo them first, so nothing is overwritten.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="notice" role="status">{message}</p>}
    <div className="profile-ai-actions">
      {!allDone && <button type="button" className="button primary" onClick={save} disabled={saving || dirty || !selectedCount}>{saving ? "Saving…" : `Save ${selectedCount} selected`}</button>}
      <button type="button" className="text-button" onClick={onDiscard} disabled={saving}>{allDone ? "Close" : "Discard suggestions"}</button>
    </div>
  </section>;
}
