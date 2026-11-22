"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AppIcon } from "@/components/app-icons";
import { buildSubmission, validateEssentials, type SubmissionErrors, type SubmissionInput } from "@/lib/workshops/submission";
import { workshopCategories, workshopDifficulties, workshopFormats, workshopPriceTypes, type Workshop } from "@/lib/workshops/types";
import styles from "./workshops.module.css";

const blank: SubmissionInput = { url: "", title: "", category: "", format: "", hook: "", difficulty: "", durationMinutes: "", priceType: "", startLocal: "" };

function Field({ id, label, error, hint, children }: { id: keyof SubmissionInput; label: string; error?: string; hint?: string; children: ReactNode }) {
  return <div className={styles.field}>
    <label htmlFor={`submit-${id}`}>{label}</label>
    {children}
    {error ? <p id={`submit-${id}-error`} className={styles.fieldError}>{error}</p> : hint ? <p className={styles.fieldHint}>{hint}</p> : null}
  </div>;
}

/** Two short steps. The result is private to this device and never shown as verified. */
export function SubmitWorkshop({ existing, inAccount, onSave, onClose }: { existing: readonly Workshop[]; inAccount: boolean; onSave: (workshop: Workshop, input: SubmissionInput) => Promise<SubmissionErrors | null>; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [input, setInput] = useState(blank);
  const [errors, setErrors] = useState<SubmissionErrors>({});
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const live = input.format === "Live Online";

  useEffect(() => { const element = dialog.current; if (element && !element.open) element.showModal(); }, []);

  const bind = (id: keyof SubmissionInput) => ({
    id: `submit-${id}`,
    value: input[id],
    "aria-invalid": errors[id] ? true : undefined,
    "aria-describedby": errors[id] ? `submit-${id}-error` : undefined,
    onChange: (event: { target: { value: string } }) => {
      const value = event.target.value;
      setInput(current => ({ ...current, [id]: value }));
      setErrors(current => ({ ...current, [id]: undefined }));
    }
  });
  function showErrors(found: SubmissionErrors) {
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) requestAnimationFrame(() => dialog.current?.querySelector<HTMLElement>(`#submit-${first}`)?.focus());
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (step === 1) {
      const found = validateEssentials(input, existing);
      if (Object.keys(found).length) { showErrors(found); return; }
      setErrors({});
      setStep(2);
      requestAnimationFrame(() => dialog.current?.querySelector<HTMLElement>("#submit-hook")?.focus());
      return;
    }
    const result = await buildSubmission(input, existing, Date.now());
    if ("errors" in result) {
      if (result.errors.url || result.errors.title || result.errors.category || result.errors.format) setStep(1);
      showErrors(result.errors);
      return;
    }
    setSaving(true);
    const refused = await onSave(result.workshop, input);
    setSaving(false);
    if (!refused) { dialog.current?.close(); return; }
    setStep(1);
    showErrors(refused);
  }

  return <dialog ref={dialog} className={styles.modal} aria-labelledby="submit-heading" onClose={onClose} onClick={event => { if (event.target === dialog.current) dialog.current?.close(); }}>
    <form onSubmit={event => void submit(event)} noValidate>
      <div className={styles.modalTop}>
        <h2 id="submit-heading">Add a workshop</h2>
        <button type="button" className={styles.iconButton} aria-label="Close" onClick={() => dialog.current?.close()}><AppIcon name="close" /></button>
      </div>
      <p className={styles.modalNote}>{inAccount ? "Saved to your account and visible only to you. You can suggest it to everyone afterwards." : "Saved on this device and visible only to you. CareerForge does not publish or check it."}</p>

      {step === 1 ? <>
        <Field id="url" label="Workshop link" error={errors.url}><input {...bind("url")} type="url" inputMode="url" placeholder="https://" maxLength={500} autoComplete="off" /></Field>
        <Field id="title" label="Title" error={errors.title}><input {...bind("title")} type="text" maxLength={140} autoComplete="off" /></Field>
        <div className={styles.fieldRow}>
          <Field id="category" label="Topic" error={errors.category}><select {...bind("category")}><option value="">Choose</option>{workshopCategories.map(item => <option key={item}>{item}</option>)}</select></Field>
          <Field id="format" label="Format" error={errors.format}><select {...bind("format")}><option value="">Choose</option>{workshopFormats.map(item => <option key={item}>{item}</option>)}</select></Field>
        </div>
      </> : <>
        <Field id="hook" label="What will you be able to do?" error={errors.hook}><input {...bind("hook")} type="text" maxLength={160} placeholder="Build and deploy a small API" autoComplete="off" /></Field>
        {live && <Field id="startLocal" label="Starts" error={errors.startLocal} hint="In your local time."><input {...bind("startLocal")} type="datetime-local" /></Field>}
        <div className={styles.fieldRow}>
          <Field id="difficulty" label="Level" error={errors.difficulty}><select {...bind("difficulty")}><option value="">Choose</option>{workshopDifficulties.map(item => <option key={item}>{item}</option>)}</select></Field>
          <Field id="durationMinutes" label="Minutes" error={errors.durationMinutes}><input {...bind("durationMinutes")} type="number" inputMode="numeric" min={5} max={60000} /></Field>
          <Field id="priceType" label="Cost" error={errors.priceType}><select {...bind("priceType")}><option value="">Choose</option>{workshopPriceTypes.map(item => <option key={item}>{item}</option>)}</select></Field>
        </div>
      </>}

      <div className={styles.modalFoot}>
        {step === 2 ? <button type="button" className={styles.textButton} onClick={() => setStep(1)}>Back</button> : <span />}
        <button type="submit" disabled={saving} className={`button primary ${styles.primary}`}>{step === 1 ? "Continue" : "Add workshop"}</button>
      </div>
    </form>
  </dialog>;
}
