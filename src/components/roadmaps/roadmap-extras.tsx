import Link from "next/link";
import { curatedWorkshops } from "@/data/workshops/curated";
import { getRoadmap } from "@/lib/roadmaps/catalog";
import { coursesFor, hostOf } from "@/lib/roadmaps/open-catalog";
import type { Roadmap } from "@/lib/roadmaps/schema";
import { AreaIcon } from "./area-icon";
import { LearnFooter } from "./learn-header";
import styles from "./roadmaps.module.css";

/** Below the map: a few full courses, related roadmaps and attribution. */
export function RoadmapExtras({ roadmap }: { roadmap: Roadmap }) {
  const courses = coursesFor(roadmap);
  // Matched by stable roadmap id, never by text. Self-paced only, so nothing here can expire.
  const practice = curatedWorkshops.filter(workshop => workshop.format === "Self-Paced / Recorded" && workshop.relatedRoadmaps?.includes(roadmap.id)).sort((a, b) => (a.priority ?? 500) - (b.priority ?? 500)).slice(0, 3);
  const related = roadmap.related.flatMap(id => getRoadmap(id) ?? []);
  return <>
    {practice.length > 0 && <section className={styles.block} aria-labelledby="practice-heading">
      <div className={styles.blockHead}><h2 id="practice-heading" className={styles.blockTitle}>Practice this skill</h2><Link href="/workshops">All workshops</Link></div>
      <ul className={styles.suggestRow}>
        {practice.map(workshop => <li key={workshop.id}><Link className={styles.suggestCard} href={`/workshops?workshop=${workshop.id}`}><span><strong>{workshop.title}</strong><small>{workshop.outcomeHook}</small></span></Link></li>)}
      </ul>
    </section>}
    {courses.length > 0 && <section className={styles.block} aria-labelledby="courses-heading">
      <div className={styles.blockHead}><h2 id="courses-heading" className={styles.blockTitle}>Free courses</h2><Link href={`/learning-roadmap/courses?topic=${encodeURIComponent(roadmap.courseTopics[0])}`}>See more courses</Link></div>
      <ul className={styles.courseGrid}>
        {courses.map(course => <li key={course.url}>
          <a className={styles.courseCard} href={course.url} target="_blank" rel="noopener noreferrer">
            <span className={styles.courseTopic}>{course.topic}</span>
            <strong>{course.title}</strong>
            <small>{course.by || hostOf(course.url)}</small>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </li>)}
      </ul>
    </section>}
    {related.length > 0 && <section className={styles.block} aria-labelledby="related-heading">
      <h2 id="related-heading" className={styles.blockTitle}>Related roadmaps</h2>
      <ul className={styles.suggestRow}>
        {related.map(item => <li key={item.id}><Link className={styles.suggestCard} data-area={item.area} href={`/learning-roadmap/${item.id}`}>
          <span className={styles.icon}><AreaIcon area={item.area} /></span><span><strong>{item.title}</strong><small>{item.tagline}</small></span>
        </Link></li>)}
      </ul>
    </section>}
    <LearnFooter>
      This roadmap is original CareerForge content. Resources open on their publishers’ own sites.
      {courses.length > 0 && <> Course list from <a href="https://github.com/EbookFoundation/free-programming-books" target="_blank" rel="noopener noreferrer">Free Programming Books</a> (CC BY 4.0).</>}
      {roadmap.roadmapSh && <> Want a second view? See the community version on <a href={`https://roadmap.sh/${roadmap.roadmapSh}`} target="_blank" rel="noopener noreferrer">roadmap.sh<span className="sr-only"> (opens in a new tab)</span></a>; it is a separate site and not affiliated with CareerForge.</>}
    </LearnFooter>
  </>;
}
