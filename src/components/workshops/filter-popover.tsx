"use client";

import { useEffect, useRef, useState } from "react";
import { AppIcon } from "@/components/app-icons";
import { activeFilterCount, defaultFilters, sortLabels, sortOptions, type DiscoveryFilters, type WorkshopSort } from "@/lib/workshops/discovery";
import { workshopDifficulties, workshopFormats, type WorkshopDifficulty, type WorkshopFormat } from "@/lib/workshops/types";
import styles from "./workshops.module.css";

function Choice<T extends string>({ legend, name, value, options, onChange }: { legend: string; name: string; value: T | null; options: readonly { id: T; label: string }[]; onChange: (value: T | null) => void }) {
  return <fieldset className={styles.choice}>
    <legend>{legend}</legend>
    <div>
      {[{ id: null, label: "Any" }, ...options].map(option => <label key={option.label}>
        <input type="radio" name={name} checked={value === option.id} onChange={() => onChange(option.id)} /><span>{option.label}</span>
      </label>)}
    </div>
  </fieldset>;
}

/** Everything beyond search lives behind one button. */
export function FilterPopover({ filters, onChange }: { filters: DiscoveryFilters; onChange: (filters: DiscoveryFilters) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const count = activeFilterCount(filters);

  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  return <div className={styles.filter} ref={root} onBlur={event => { if (open && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={button} type="button" className={styles.filterButton} aria-expanded={open} aria-controls="workshop-filters" aria-label={count ? `Filters, ${count} active` : "Filters"} onClick={() => setOpen(value => !value)}>
      <AppIcon name="filter" /><span>Filters</span>{count > 0 && <b aria-hidden="true">{count}</b>}
    </button>
    {open && <div id="workshop-filters" ref={panel} className={styles.popover} role="dialog" aria-label="Filter workshops" tabIndex={-1}>
      <Choice<WorkshopDifficulty> legend="Difficulty" name="difficulty" value={filters.difficulty} options={workshopDifficulties.map(id => ({ id, label: id }))} onChange={difficulty => onChange({ ...filters, difficulty })} />
      <Choice<WorkshopFormat> legend="Format" name="format" value={filters.format} options={workshopFormats.map(id => ({ id, label: id === "Live Online" ? "Live" : "Self-paced" }))} onChange={format => onChange({ ...filters, format })} />
      <label className={styles.toggle}><input type="checkbox" checked={filters.freeOnly} onChange={event => onChange({ ...filters, freeOnly: event.target.checked })} /><span>Completely free only</span></label>
      <label className={styles.sort}>Sort by
        <select value={filters.sort} onChange={event => onChange({ ...filters, sort: event.target.value as WorkshopSort })}>{sortOptions.map(id => <option key={id} value={id}>{sortLabels[id]}</option>)}</select>
      </label>
      <div className={styles.popoverFoot}>
        <button type="button" className={styles.textButton} disabled={!count} onClick={() => onChange({ ...defaultFilters, query: filters.query })}>Clear</button>
        <button type="button" className={styles.secondary} onClick={() => { setOpen(false); button.current?.focus(); }}>Done</button>
      </div>
    </div>}
  </div>;
}
