"use client";

import { useEffect, useState } from "react";

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
