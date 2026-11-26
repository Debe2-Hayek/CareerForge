"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { claimStatusInfo, type ClaimStatus } from "@/lib/claims/model";

/** Follows the value of an uncontrolled field by its id, so the form keeps its own simple state. */
function useFieldValue(id: string) {
  const [value, setValue] = useState<string | null>(null);
  useEffect(() => {
    const field = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!field) return;
    const update = () => setValue(field.value);
    update();
    field.addEventListener("input", update);
    // A reset (after saving or discarding) puts back the default value.
    field.form?.addEventListener("reset", () => setTimeout(update));
    return () => field.removeEventListener("input", update);
  }, [id]);
  return value;
}

/** "120 / 160": calm until the last tenth, then amber, so nobody is surprised by the limit. */
export function FieldCounter({ htmlFor, max }: { htmlFor: string; max: number }) {
  const value = useFieldValue(htmlFor);
  if (value === null) return null;
  const used = value.length;
  const state = used >= max ? "full" : used >= max * 0.9 ? "near" : "ok";
  // Hidden from screen readers: it sits inside the label, and maxLength already stops at the limit.
  return <small className="field-counter" data-state={state} aria-hidden="true">{used} / {max}</small>;
}

/** Skills appear as chips while they are typed, separated by commas. */
export function SkillChips({ htmlFor, limit = 40 }: { htmlFor: string; limit?: number }) {
  const value = useFieldValue(htmlFor);
  if (value === null) return null;
  const skills = [...new Map(value.split(",").map(skill => skill.trim()).filter(Boolean).map(skill => [skill.toLowerCase(), skill])).values()];
  if (!skills.length) return null;
  return <div className="skill-chips" aria-hidden="true">
    {skills.slice(0, limit).map(skill => <span key={skill.toLowerCase()} className="skill-chip">{skill}</span>)}
    {skills.length > limit && <span className="skill-chip is-over">+{skills.length - limit} over the limit</span>}
  </div>;
}

/**
 * Skills as tags, like the tag fields of the tools people already use: type a skill and press Enter or a
 * comma, paste a list, press Backspace to take the last one back, or tap × on a tag. Suggestions are the
 * skills job listings ask for. The tags travel in a hidden comma-separated field, so the form stays simple.
 */
export function SkillTags({ id, name, initial, statusOf = {}, suggestions = [], limit = 40, maxLength = 60, describedBy }: {
  id: string; name: string; initial: string[]; statusOf?: Record<string, ClaimStatus>; suggestions?: readonly string[];
  limit?: number; maxLength?: number; describedBy?: string;
}) {
  const [tags, setTags] = useState<string[]>(initial);
  const [text, setText] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [warning, setWarning] = useState("");
  const hidden = useRef<HTMLInputElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const announced = useRef(initial.join(", "));

  // Tell the form something changed (it compares drafts on input), and follow a form reset.
  useEffect(() => {
    const value = tags.join(", ");
    if (value === announced.current) return;
    announced.current = value;
    hidden.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [tags]);
  useEffect(() => {
    const form = hidden.current?.form;
    if (!form) return;
    const reset = () => { setTags(initial); setText(""); setWarning(""); };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [initial]);

  function add(raw: string) {
    const incoming = raw.split(/[,\n;]+/).map(skill => skill.trim().replace(/\s+/g, " ")).filter(Boolean);
    if (!incoming.length) return;
    let next = [...tags];
    let note = "";
    for (const skill of incoming) {
      if (skill.length > maxLength) { note = `Keep each skill under ${maxLength} characters.`; continue; }
      const existing = next.find(tag => tag.toLowerCase() === skill.toLowerCase());
      if (existing) { setFlash(existing.toLowerCase()); setTimeout(() => setFlash(null), 700); continue; }
      if (next.length >= limit) { note = `That's the limit of ${limit} skills. Remove one to add another.`; break; }
      // A suggestion typed in lower case takes its usual spelling ("react" becomes "React").
      next = [...next, suggestions.find(item => item.toLowerCase() === skill.toLowerCase()) ?? skill];
    }
    setTags(next); setText(""); setWarning(note);
  }
  function remove(skill: string) {
    setTags(current => current.filter(tag => tag !== skill)); setWarning("");
    field.current?.focus();
  }
  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if ((event.key === "Enter" || event.key === ",") && !event.nativeEvent.isComposing) { event.preventDefault(); add(text); }
    else if (event.key === "Backspace" && !text && tags.length) { event.preventDefault(); setText(tags[tags.length - 1]); setTags(tags.slice(0, -1)); }
    else if (event.key === "Escape" && text) { event.preventDefault(); setText(""); }
  }
  const listId = `${id}-suggestions`;
  const left = suggestions.filter(item => !tags.some(tag => tag.toLowerCase() === item.toLowerCase()));

  return <div className="tag-field" data-full={tags.length >= limit || undefined} onClick={event => { if (event.target === event.currentTarget) field.current?.focus(); }}>
    {tags.length > 0 && <ul className="skill-tags toolkit-list" aria-label={`Your skills: ${tags.length} of ${limit}`}>
      {tags.map(skill => {
        const status = statusOf[skill.toLowerCase()];
        const info = status ? claimStatusInfo[status] : null;
        return <li key={skill.toLowerCase()} data-status={status ?? "new"} data-flash={flash === skill.toLowerCase() || undefined} title={info?.help}>
          {info && (status === "verified" || status === "reviewed") && <span className="tag-proof" aria-hidden="true">✓</span>}
          <span>{skill}</span>
          {info && status !== "self_declared" && <span className="sr-only">, {info.label}</span>}
          <button type="button" onClick={() => remove(skill)} aria-label={`Remove ${skill}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" /></svg>
          </button>
        </li>;
      })}
    </ul>}
    <input ref={field} id={id} name={`${name}Pending`} type="text" value={text} list={left.length ? listId : undefined} autoComplete="off" maxLength={maxLength * 8}
      placeholder={tags.length ? "Add another skill" : "e.g. React, then Enter"} aria-describedby={describedBy}
      onChange={event => { const value = event.target.value; if (/[,;\n]/.test(value)) add(value); else setText(value); }}
      onKeyDown={onKey} onBlur={() => { if (text.trim()) add(text); }}
      onPaste={event => { const pasted = event.clipboardData.getData("text"); if (/[,;\n]/.test(pasted)) { event.preventDefault(); add(text + pasted); } }} />
    {left.length > 0 && <datalist id={listId}>{left.map(item => <option key={item} value={item} />)}</datalist>}
    <input ref={hidden} type="hidden" name={name} value={tags.join(", ")} />
    {warning && <p className="tag-warning" role="status">{warning}</p>}
  </div>;
}
