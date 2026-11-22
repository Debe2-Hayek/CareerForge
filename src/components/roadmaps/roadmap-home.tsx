import Link from "next/link";
import type { LearningSnapshot } from "@/lib/learning/api";
import { roadmaps, topicCount } from "@/lib/roadmaps/catalog";
import { activeRoadmaps, headStart, suggestRoadmaps } from "@/lib/roadmaps/progress";
import { areaLabels } from "@/lib/roadmaps/schema";
import { AreaIcon } from "./area-icon";
import { LearnFooter, LearnHeader } from "./learn-header";
import { RoadmapFinder, type FinderItem } from "./roadmap-finder";
import styles from "./roadmaps.module.css";

export function RoadmapHome({ snapshot, profile }: { snapshot: LearningSnapshot | null; profile: { headline: string; skills: string[] } }) {
  const active = activeRoadmaps(snapshot);
  const percentById = new Map(active.map(item => [item.roadmap.id, item.summary.percent]));
  const suggestions = suggestRoadmaps(profile, new Set(percentById.keys()));
  const items: FinderItem[] = roadmaps.map(roadmap => ({
    id: roadmap.id,
    kind: roadmap.kind,
    title: roadmap.title,
    area: roadmap.area,
    topics: topicCount(roadmap),
    inDepth: roadmap.inDepth,
    percent: percentById.get(roadmap.id) ?? null,
    headStart: percentById.has(roadmap.id) ? 0 : headStart(roadmap, snapshot),
    search: `${roadmap.title} ${areaLabels[roadmap.area]} ${roadmap.keywords.join(" ")}`.toLowerCase()
  }));

  return <div className={styles.page}>
    <LearnHeader active="roadmaps" title="Choose your path." text="Pick a roadmap, follow the boxes from top to bottom, and tick them off as you learn. Everything is free." />

    {!snapshot && <p className={styles.notice} role="status">Saved progress is temporarily unavailable. You can still explore every roadmap; saving will work again once the connection recovers.</p>}

    {active.length > 0 && <section className={styles.block} aria-labelledby="continue-heading">
      <h2 id="continue-heading" className={styles.blockTitle}>Continue learning</h2>
      <ul className={styles.continueRow}>
        {active.slice(0, 4).map(({ roadmap, summary }) => <li key={roadmap.id}>
          <Link className={styles.continueCard} data-area={roadmap.area} href={`/learning-roadmap/${roadmap.id}${summary.nextId ? `?topic=${summary.nextId}` : ""}`}>
            <span className={styles.continueTop}><strong>{roadmap.title}</strong><span>{summary.percent}%</span></span>
            <span className={styles.bar} role="img" aria-label={`${summary.done} of ${summary.total} core topics done`}><span style={{ width: `${summary.percent}%` }} /></span>
            <span className={styles.continueNext}>{summary.nextTitle ? <>Next: {summary.nextTitle}</> : "All core topics done"}</span>
          </Link>
        </li>)}
      </ul>
    </section>}

    {suggestions.length > 0 && <section className={styles.block} aria-labelledby="suggest-heading">
      <h2 id="suggest-heading" className={styles.blockTitle}>Suggested for you</h2>
      <ul className={styles.suggestRow}>
        {suggestions.map(({ roadmap, reason }) => <li key={roadmap.id}>
          <Link className={styles.suggestCard} data-area={roadmap.area} href={`/learning-roadmap/${roadmap.id}`}>
            <span className={styles.icon}><AreaIcon area={roadmap.area} /></span>
            <span><strong>{roadmap.title}</strong><small>{reason}</small></span>
          </Link>
        </li>)}
      </ul>
    </section>}

    <RoadmapFinder items={items} />
    <LearnFooter />
  </div>;
}
