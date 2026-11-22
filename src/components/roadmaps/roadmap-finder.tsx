"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import type { RoadmapArea } from "@/lib/roadmaps/schema";
import { AreaIcon } from "./area-icon";
import styles from "./roadmaps.module.css";

export type FinderItem = {
  id: string;
  kind: "role" | "skill";
  title: string;
  area: RoadmapArea;
  topics: number;
  inDepth: boolean;
  /** null when not started. */
  percent: number | null;
  search: string;
};

const groups = [
  { kind: "role", title: "Career roles", text: "Start here if you know the job you want." },
  { kind: "skill", title: "Skills", text: "Start here to learn one technology." }
] as const;

/** One search box and two plain lists: choosing a roadmap should take seconds. */
export function RoadmapFinder({ items }: { items: FinderItem[] }) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const visible = useMemo(() => {
    const terms = deferred.toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter(item => terms.every(term => item.search.includes(term)));
  }, [items, deferred]);

  return <section className={styles.block} aria-label="All roadmaps">
    <div className={styles.searchBar}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4" /></svg>
      <label htmlFor="roadmap-search" className="sr-only">Search roadmaps</label>
      <input id="roadmap-search" type="search" value={query} onChange={event => setQuery(event.target.value.slice(0, 60))} placeholder="Search a role or skill" autoComplete="off" />
    </div>
    <p className="sr-only" role="status" aria-live="polite">{deferred ? `${visible.length} roadmaps found` : ""}</p>
    {groups.map(group => {
      const list = visible.filter(item => item.kind === group.kind);
      if (!list.length) return null;
      return <div key={group.kind} className={styles.group}>
        <div className={styles.groupHead}><h2>{group.title}</h2><p>{group.text}</p><span aria-label={`${list.length} roadmaps`}>{list.length}</span></div>
        <ul className={styles.grid}>
          {list.map(item => <li key={item.id}>
            <Link href={`/learning-roadmap/${item.id}`} className={styles.card} data-area={item.area} data-started={item.percent !== null || undefined}>
              <span className={styles.icon}><AreaIcon area={item.area} /></span>
              <span className={styles.cardText}><strong>{item.title}</strong><small>{item.topics} topics{item.inDepth ? " · full lessons" : ""}</small></span>
              {item.percent === null
                ? <span className={styles.cardArrow} aria-hidden="true">→</span>
                : <span className={styles.cardPercent}>{item.percent}%<span className="sr-only"> done</span></span>}
              {item.percent !== null && <span className={styles.cardBar} aria-hidden="true"><span style={{ width: `${item.percent}%` }} /></span>}
            </Link>
          </li>)}
        </ul>
      </div>;
    })}
    {!visible.length && <div className={styles.empty}>
      <p>No roadmap matches “{deferred}”.</p>
      <button type="button" className={styles.ghostButton} onClick={() => setQuery("")}>Show all roadmaps</button>
    </div>}
  </section>;
}
