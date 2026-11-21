"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import styles from "./learning.module.css";

export type CatalogItem = {
  id: string;
  kind: "course" | "career";
  title: string;
  tagline: string;
  categories: string[];
  difficulty: string;
  effort: string;
  outcomes: string[];
  href: string;
  featured?: boolean;
  status?: string;
};

const kindLabel = { course: "Guided path", career: "Career roadmap" } as const;

export function CourseCatalog({ items }: { items: CatalogItem[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);
  // Only offer categories that actually have content: no empty filters.
  const categories = useMemo(() => [...new Set(items.flatMap(item => item.categories))].sort(), [items]);
  const visible = useMemo(() => {
    const terms = deferredQuery.toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter(item => {
      if (category && !item.categories.includes(category)) return false;
      const haystack = `${item.title} ${item.tagline} ${item.categories.join(" ")} ${item.outcomes.join(" ")} ${kindLabel[item.kind]}`.toLowerCase();
      return terms.every(term => haystack.includes(term));
    });
  }, [items, category, deferredQuery]);

  return <div>
    <div className={styles.catalogTools}>
      <label className="sr-only" htmlFor="learning-search">Search learning paths</label>
      <input
        id="learning-search"
        className={styles.search}
        type="search"
        value={query}
        onChange={event => setQuery(event.target.value.slice(0, 80))}
        placeholder="Search paths, skills or careers (e.g. Python, data, API)"
        autoComplete="off"
      />
      <ul className={styles.chips} aria-label="Filter by category">
        <li><button type="button" className={styles.chip} aria-pressed={category === null} onClick={() => setCategory(null)}>All</button></li>
        {categories.map(name => <li key={name}>
          <button type="button" className={styles.chip} aria-pressed={category === name} onClick={() => setCategory(current => current === name ? null : name)}>{name}</button>
        </li>)}
      </ul>
    </div>
    <p className={styles.resultCount} role="status" aria-live="polite">{visible.length} of {items.length} learning paths</p>
    {visible.length ? <ul className={styles.cardGrid}>
      {visible.map(item => <li key={`${item.kind}-${item.id}`}>
        <Link href={item.href} className={styles.pathCard} data-featured={item.featured || undefined}>
          <div className={styles.cardTop}>
            <span className={`${styles.badge} ${item.kind === "course" ? styles.badgeAccent : ""}`}>{kindLabel[item.kind]}</span>
            <span className={styles.badge}>{item.difficulty}</span>
            {item.status && <span className={`${styles.badge} ${styles.badgeWarn}`}>{item.status}</span>}
          </div>
          <h3>{item.title}</h3>
          <p>{item.tagline}</p>
          {item.outcomes.length > 0 && <ul className={styles.outcomes}>{item.outcomes.slice(0, 3).map(outcome => <li key={outcome}>{outcome}</li>)}</ul>}
          <div className={styles.cardFoot}><span>{item.effort}</span><strong aria-hidden="true">{item.status ? "Continue →" : "Explore →"}</strong></div>
        </Link>
      </li>)}
    </ul> : <div className={styles.empty}>
      <p>No paths match “{deferredQuery}”{category ? ` in ${category}` : ""}.</p>
      <button type="button" className={styles.secondaryButton} onClick={() => { setQuery(""); setCategory(null); }}>Clear search and filters</button>
    </div>}
  </div>;
}
