import Link from "next/link";
import { summarizeCourse } from "@/lib/learning/catalog";
import type { LearningCourse } from "@/lib/learning/schema";
import type { LearningSettings } from "@/lib/learning/plan";
import { CourseSetupForm } from "./course-setup-form";
import styles from "./learning.module.css";

/** First visit to a path: what it covers, then three quick questions. */
export function CourseIntro({ course, defaults, storageAvailable }: { course: LearningCourse; defaults: LearningSettings; storageAvailable: boolean }) {
  const summary = summarizeCourse(course);
  const corePhases = course.phases.filter(phase => !phase.branch);
  const specialisations = course.phases.filter(phase => phase.branch);
  return <div className={styles.page}>
    <nav aria-label="Breadcrumb"><ol className={styles.breadcrumb}><li><Link href="/learning-roadmap">Learning roadmap</Link></li><li aria-current="page">{course.title}</li></ol></nav>
    <header className={styles.courseHeader}>
      <div>
        <p className={styles.kicker}>Guided path · {course.difficulty}</p>
        <h1>{course.title}</h1>
        <p className={styles.lede}>{course.summary}</p>
      </div>
      <aside className={styles.stats} aria-label="Path facts">
        <dl className={styles.statList}>
          <div><dt>Topics</dt><dd>{summary.topicCount}</dd></div>
          <div><dt>Projects</dt><dd>{summary.projectCount}</dd></div>
          <div><dt>Core effort</dt><dd>≈ {summary.coreHours} h</dd></div>
          <div><dt>Cost</dt><dd>Free resources</dd></div>
        </dl>
        <ul className={styles.outcomes}>{course.outcomes.map(outcome => <li key={outcome}>{outcome}</li>)}</ul>
      </aside>
    </header>
    {!storageAvailable && <p className={styles.notice} role="status">Saving is temporarily unavailable. You can still preview your personalised roadmap.</p>}
    <div className={styles.setup}>
      <section aria-labelledby="setup-heading">
        <p className={styles.kicker}>Step 1 of 2 · About you</p>
        <h2 id="setup-heading" style={{ margin: "8px 0 16px", fontSize: 26, fontWeight: 500 }}>Personalise your roadmap</h2>
        <CourseSetupForm courseId={course.id} goals={course.goals} initial={defaults} enrolled={false} />
      </section>
      <section aria-labelledby="structure-heading">
        <p className={styles.kicker}>What the path covers</p>
        <h2 id="structure-heading" style={{ margin: "8px 0 16px", fontSize: 26, fontWeight: 500 }}>From first program to portfolio</h2>
        <ol className={styles.overviewList}>
          {corePhases.map((phase, index) => <li key={phase.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{phase.title}</strong><p>{phase.goal}</p></div></li>)}
        </ol>
        <p className={styles.kicker} style={{ marginTop: 22 }}>Choose one specialisation through your goal</p>
        <ul className={styles.overviewList} style={{ marginTop: 10 }}>
          {specialisations.map(phase => <li key={phase.id}><span>+</span><div><strong>{phase.title.replace("Specialisation: ", "").replace(/^./, letter => letter.toUpperCase())}</strong><p>{phase.goal}</p></div></li>)}
        </ul>
      </section>
    </div>
  </div>;
}
