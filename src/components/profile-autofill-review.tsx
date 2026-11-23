"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { profileSchema, type AccountProfile } from "@/lib/account/schemas";
import type { ProfileAutofill } from "@/lib/ai/profile-autofill";

type FieldKey = "name" | "headline" | "location" | "bio" | "education" | "project";
// Short fields first so they pair in the two-column grid; the long ones span the full width.
const FIELD_LABELS: Record<FieldKey, string> = { name: "Full name", headline: "Headline", location: "Location", education: "Education summary", bio: "About you", project: "Featured project" };
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

type Props = { result: ProfileAutofill; cached: boolean; remaining: number | null; profile: AccountProfile; dirty: boolean; onSaved: (profile: AccountProfile) => void; onDiscard: () => void };

function Group({ title, count, picked, onAll, disabled, children, wide }: { title: string; count: number; picked: number; onAll: (all: boolean) => void; disabled?: boolean; children: ReactNode; wide?: boolean }) {
  const all = picked === count;
  return <fieldset className="profile-ai-group" disabled={disabled}>
    <div className="profile-ai-group-head">
      <legend>{title} <span>{picked}/{count}</span></legend>
      {count > 1 && <button type="button" className="text-button" onClick={() => onAll(!all)}>{all ? "Clear all" : "Select all"}</button>}
    </div>
    <div className={wide ? "profile-ai-grid wide" : "profile-ai-grid"}>{children}</div>
  </fieldset>;
}

/** AI suggestions for review. Only ticked items are saved, as self-declared details. */
export function ProfileAutofillReview({ result, cached, remaining, profile, dirty, onSaved, onDiscard }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const fields = (Object.keys(FIELD_LABELS) as FieldKey[]).filter(key => result.profile[key] && !same(result.profile[key], profile[key]));
  const newSkills = result.profile.skills.filter(skill => !profile.skills.some(existing => same(existing, skill)));
  // Empty profile fields are filled by default; existing values change only if the user ticks the replacement.
  const [pickedFields, setPickedFields] = useState(() => new Set(fields.filter(key => !profile[key].trim())));
  const [pickedSkills, setPickedSkills] = useState(() => new Set(newSkills));
  const [pickedEducation, setPickedEducation] = useState(() => new Set(result.education.map((_, i) => i)));
  const [pickedExperience, setPickedExperience] = useState(() => new Set(result.experience.map((_, i) => i)));
  const requestIds = useMemo(() => ({ education: result.education.map(() => crypto.randomUUID()), experience: result.experience.map(() => crypto.randomUUID()) }), [result]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ education: Set<number>; experience: Set<number>; profile: boolean }>({ education: new Set(), experience: new Set(), profile: false });

  // Bring the suggestions into view and move focus to them, so keyboard and screen-reader users land here.
  useEffect(() => {
    heading.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    heading.current?.focus({ preventScroll: true });
  }, []);

  const toggle = <T,>(set: Set<T>, value: T, update: (next: Set<T>) => void) => { const next = new Set(set); if (next.has(value)) next.delete(value); else next.add(value); update(next); };
  const unsaved = (picked: Set<number>, saved: Set<number>) => [...picked].filter(index => !saved.has(index)).length;
  const selectedCount = (done.profile ? 0 : pickedFields.size + pickedSkills.size) + unsaved(pickedEducation, done.education) + unsaved(pickedExperience, done.experience);
  const found = fields.length + newSkills.length + result.education.length + result.experience.length;

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
        if (!parsed.success) failed.push(next.name.trim() ? "profile details (check field lengths)" : "profile details (tick your full name or type it in the form below)");
        else {
          const response = await fetch("/api/v1/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data), signal: AbortSignal.timeout(15000) }).catch(() => null);
          const body = await response?.json().catch(() => null);
          const confirmed = profileSchema.safeParse(body?.profile);
          if (response?.ok && confirmed.success) { onSaved(confirmed.data); saved += pickedFields.size + pickedSkills.size; setDone(current => ({ ...current, profile: true })); }
          else failed.push(body?.error?.message ?? "profile details");
        }
      }
      for (const kind of ["education", "experience"] as const) {
        for (const index of kind === "education" ? pickedEducation : pickedExperience) {
          if (done[kind].has(index)) continue;
          const item = result[kind][index];
          const fields = kind === "education"
            ? { institution: result.education[index].institution, degree: result.education[index].degree, gpa: null, gpaScale: null }
            : { company: result.experience[index].company, role: result.experience[index].role, description: result.experience[index].description };
          // A stable request id makes retrying safe: the server never creates the same record twice.
          const response = await fetch(`/api/v1/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: requestIds[kind][index], ...fields, startDate: item.startDate, endDate: item.endDate, isCurrent: item.isCurrent }), signal: AbortSignal.timeout(15000) }).catch(() => null);
          if (response?.ok) { saved++; setDone(current => ({ ...current, [kind]: new Set(current[kind]).add(index) })); }
          else {
            const body = await response?.json().catch(() => null);
            failed.push(`${"institution" in fields ? fields.institution : fields.company}${body?.error?.message ? ` (${body.error.message})` : ""}`);
          }
        }
      }
      if (failed.length) setError(`Saved ${saved}. Not saved: ${failed.join("; ")}. Fix it and press save again; saved items won't be duplicated.`);
      else setMessage(`Saved ${plural(saved, "item")} to your profile, marked self-declared until verified.`);
    } catch { setError("Saving stopped. Check your connection and press save again; saved items won't be duplicated."); }
    finally { setSaving(false); }
  }

  const allDone = !!message && !error;
  return <section className="panel profile-ai-review" aria-labelledby="profile-ai-review-title">
    <header className="profile-ai-review-head">
      <div>
        <p className="eyebrow">STEP 3 · REVIEW</p>
        <h3 id="profile-ai-review-title" ref={heading} tabIndex={-1}>Check what the AI found</h3>
        <p>Tick only what is true. Ticked items are saved as <strong>self-declared</strong>; you can verify them later.</p>
      </div>
      <dl className="profile-ai-stats">
        <div><dt>Found</dt><dd>{found}</dd></div>
        <div className={result.removed.length ? "warn" : undefined}><dt>Removed</dt><dd>{result.removed.length}</dd></div>
        <div><dt>{cached ? "AI use" : "Left today"}</dt><dd>{cached ? "None" : remaining ?? "–"}</dd></div>
      </dl>
    </header>
    {cached && <p className="profile-ai-hint">You sent this same text before, so this is the earlier answer. It did not use an AI request.</p>}

    {!!result.removed.length && <details className="profile-ai-removed">
      <summary><span aria-hidden="true">!</span>{plural(result.removed.length, "suggestion")} removed: not found in your text</summary>
      <p>The AI suggested these, but CareerForge could not find them in what you gave it, so they were left out. Add them by hand if they are true.</p>
      <ul>{result.removed.map((item, i) => <li key={i}><span>{item.field}</span><s>{item.value}</s></li>)}</ul>
    </details>}

    {!found && <p className="profile-ai-empty">Nothing new was found that isn&apos;t already in your profile.</p>}

    {!!fields.length && <Group title="Profile details" count={fields.length} picked={pickedFields.size} disabled={saving || done.profile} onAll={all => setPickedFields(new Set(all ? fields : []))}>
      {fields.map(key => <label key={key} className={`profile-ai-item${key === "bio" || key === "project" ? " span" : ""}`}>
        <input type="checkbox" checked={pickedFields.has(key)} onChange={() => toggle(pickedFields, key, setPickedFields)} />
        <span><small>{FIELD_LABELS[key]}</small><strong>{result.profile[key]}</strong>{profile[key].trim() && <em>Replaces: {profile[key]}</em>}</span>
      </label>)}
    </Group>}

    {!!newSkills.length && <Group title="New skills" count={newSkills.length} picked={pickedSkills.size} disabled={saving || done.profile} onAll={all => setPickedSkills(new Set(all ? newSkills : []))} wide>
      <div className="profile-ai-skills">{newSkills.map(skill => <label key={skill} className="profile-ai-skill">
        <input type="checkbox" checked={pickedSkills.has(skill)} onChange={() => toggle(pickedSkills, skill, setPickedSkills)} />{skill}
      </label>)}</div>
      {profile.skills.length + pickedSkills.size > 40 && <p className="form-error">Your profile keeps up to 40 skills; extra ones won&apos;t be saved.</p>}
    </Group>}

    {!!result.education.length && <Group title="Education" count={result.education.length} picked={pickedEducation.size} disabled={saving} onAll={all => setPickedEducation(new Set(all ? result.education.map((_, i) => i) : [...done.education]))}>
      {result.education.map((item, i) => <label key={i} className={`profile-ai-item${done.education.has(i) ? " saved" : ""}`}>
        <input type="checkbox" checked={pickedEducation.has(i)} disabled={done.education.has(i)} onChange={() => toggle(pickedEducation, i, setPickedEducation)} />
        <span><small>{item.years || "Dates not given"}</small><strong>{item.degree}</strong>{item.institution}{item.years && !item.startDate && !item.endDate && <em>Year only: add the months later in Education &amp; experience</em>}{done.education.has(i) && <b className="profile-ai-saved">Saved</b>}</span>
      </label>)}
    </Group>}

    {!!result.experience.length && <Group title="Work experience" count={result.experience.length} picked={pickedExperience.size} disabled={saving} onAll={all => setPickedExperience(new Set(all ? result.experience.map((_, i) => i) : [...done.experience]))}>
      {result.experience.map((item, i) => <label key={i} className={`profile-ai-item${done.experience.has(i) ? " saved" : ""}`}>
        <input type="checkbox" checked={pickedExperience.has(i)} disabled={done.experience.has(i)} onChange={() => toggle(pickedExperience, i, setPickedExperience)} />
        <span><small>{item.years || "Dates not given"}</small><strong>{item.role}</strong>{item.company}{item.description && <em>{item.description}</em>}{done.experience.has(i) && <b className="profile-ai-saved">Saved</b>}</span>
      </label>)}
    </Group>}

    {!!result.languages.length && <p className="profile-ai-hint">Languages found: <strong>{result.languages.join(", ")}</strong>. Your profile can&apos;t store languages yet; language checks are planned.</p>}

    <div className="profile-ai-actions">
      <div aria-live="polite">
        {dirty && <p className="form-error" role="status">You have unsaved edits in the form below. Save or undo them first so nothing is overwritten.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="profile-ai-done" role="status">✓ {message}</p>}
        {!dirty && !error && !message && <p className="profile-ai-count">{selectedCount ? `${plural(selectedCount, "item")} selected` : "Nothing selected"}</p>}
      </div>
      <div className="profile-ai-buttons">
        <button type="button" className="text-button" onClick={onDiscard} disabled={saving}>{allDone ? "Close" : "Discard"}</button>
        {!allDone && <button type="button" className="button primary" onClick={save} disabled={saving || dirty || !selectedCount}>{saving ? "Saving…" : `Save ${selectedCount} to my profile`}</button>}
      </div>
    </div>
  </section>;
}
