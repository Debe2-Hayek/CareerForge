"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { AppIcon } from "@/components/app-icons";
import type { DirectoryItem, DirectorySection } from "@/lib/feature-directory";
import styles from "./feature-directory.module.css";

function Tile({ item, fact, planned = false }: { item: DirectoryItem; fact?: string; planned?: boolean }) {
  return <Link href={item.href} className={planned ? styles.plannedTile : styles.tile} data-feature={item.id}>
    <span className={styles.icon}><AppIcon name={item.icon} /></span>
    <span className={styles.text}>
      <strong>{item.label}{item.pilot && <em>Pilot</em>}</strong>
      <small>{item.text}</small>
      {fact && <span className={styles.fact}>{fact}</span>}
    </span>
    <span className={styles.arrow} aria-hidden="true"><AppIcon name="arrow" /></span>
  </Link>;
}

/** Every tool, grouped by what the learner wants to do. Facts are the learner's own saved records. */
export function FeatureDirectory({ sections, planned, facts }: { sections: DirectorySection[]; planned: DirectoryItem[]; facts: Record<string, string> }) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const { ready, later, total } = useMemo(() => {
    const terms = deferred.toLowerCase().split(/\s+/).filter(Boolean);
    const match = (item: DirectoryItem) => terms.every(term => item.search.includes(term));
    const ready = sections.map(section => ({ ...section, items: section.items.filter(match) })).filter(section => section.items.length);
    const later = planned.filter(match);
    return { ready, later, total: ready.reduce((sum, section) => sum + section.items.length, 0) + later.length };
  }, [deferred, sections, planned]);
  const searching = deferred.trim().length > 0;

  return <div className={styles.page}>
    <header className={styles.head}>
      <div><h1>All features</h1><p>Everything in CareerForge, grouped by what you want to do.</p></div>
      <div className={styles.search}>
        <AppIcon name="search" />
        <label htmlFor="feature-search" className="sr-only">Find a feature</label>
        <input id="feature-search" type="search" value={query} placeholder="Find a feature" autoComplete="off" maxLength={40} onChange={event => setQuery(event.target.value)} />
      </div>
    </header>
    <p className="sr-only" role="status" aria-live="polite">{searching ? `${total} ${total === 1 ? "feature" : "features"} found` : ""}</p>

    <div className={styles.sections}>
      {ready.map(section => <section key={section.id} className={styles.section} aria-labelledby={`features-${section.id}`}>
        <div className={styles.sectionHead}><h2 id={`features-${section.id}`}>{section.title}</h2><p>{section.text}</p></div>
        <ul>{section.items.map(item => <li key={item.id}><Tile item={item} fact={facts[item.id]} /></li>)}</ul>
      </section>)}
    </div>

    {later.length > 0 && <section className={styles.later} aria-labelledby="features-later">
      <div className={styles.sectionHead}><h2 id="features-later">Coming later</h2><p>Designed, not built yet. Open one to read the plan.</p></div>
      <ul>{later.map(item => <li key={item.id}><Tile item={item} planned /></li>)}</ul>
    </section>}

    {!total && <div className={styles.empty}><p>No feature matches “{deferred}”.</p><button type="button" onClick={() => setQuery("")}>Show all features</button></div>}
  </div>;
}
