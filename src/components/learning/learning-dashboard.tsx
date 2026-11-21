import Link from "next/link";
import { categoryLabels, courses, summarizeCourse } from "@/lib/learning/catalog";
import { buildLearningPlan } from "@/lib/learning/plan";
import type { LearningSnapshot } from "@/lib/learning/api";
import { getLearningTracks, type LearningTrackId } from "@/lib/learning-path";
import { CourseCatalog, type CatalogItem } from "./course-catalog";
import { ProgressBar } from "./progress-bar";
import styles from "./learning.module.css";

const trackCategories: Record<LearningTrackId, string[]> = {
  frontend: [categoryLabels.web],
  backend: [categoryLabels.web, categoryLabels.programming],
  "full-stack": [categoryLabels.web, categoryLabels.programming],
  "data-analyst": [categoryLabels.data],
  "ux-design": [categoryLabels.design],
  devops: [categoryLabels.devops]
};

const formatHours = (hours: number) => hours >= 10 ? `${Math.round(hours)} h` : `${hours} h`;

export function LearningDashboard({ snapshot }: { snapshot: LearningSnapshot | null }) {
  const active = (snapshot?.enrollments ?? []).flatMap(enrollment => {
    const course = courses.find(candidate => candidate.id === enrollment.courseId);
    if (!course) return [];
    const plan = buildLearningPlan(course, enrollment, snapshot?.progress[course.id]);
    return [{ course, plan }];
  });
  const activeIds = new Set(active.map(item => item.course.id));

  const items: CatalogItem[] = [
    ...courses.map(course => {
      const summary = summarizeCourse(course);
      return {
        id: course.id,
        kind: "course" as const,
        title: course.title,
        tagline: course.tagline,
        categories: course.categories.map(category => categoryLabels[category]),
        difficulty: course.difficulty,
        effort: `${summary.topicCount} topics · ${summary.projectCount} projects · core ≈ ${summary.coreHours} h`,
        outcomes: course.outcomes,
        href: `/learning-roadmap/${course.id}`,
        featured: true,
        status: activeIds.has(course.id) ? "In progress" : undefined
      };
    }),
    ...getLearningTracks().map(track => ({
      id: track.id,
      kind: "career" as const,
      title: track.title,
      tagline: track.audience,
      categories: trackCategories[track.id],
      difficulty: "Role-based",
      effort: `${track.phaseCount} phases · ${track.topicCount} practical steps`,
      outcomes: [track.outcome],
      href: `/learning-roadmap/careers?track=${track.id}`
    }))
  ];

  return <div className={styles.page}>
    <header className={styles.hero}>
      <div>
        <p className={styles.kicker}>Learning roadmap</p>
        <h1>Learn for free. Build real projects. Show the evidence.</h1>
        <p className={styles.lede}>Pick a path, tell CareerForge your experience, goal and weekly time, and get an ordered plan with free official resources, practice, projects and progress that follows you across devices.</p>
      </div>
      <ol className={styles.journey} aria-label="How it works">
        <li><span><strong>Choose a path or career</strong>Guided courses and role roadmaps.</span></li>
        <li><span><strong>Personalise it</strong>Your level, goal and weekly hours shape the plan.</span></li>
        <li><span><strong>Learn for free</strong>Official docs, university courses and interactive practice.</span></li>
        <li><span><strong>Build and prove it</strong>Projects unlock as you learn and feed your portfolio.</span></li>
      </ol>
    </header>

    {!snapshot && <p className={styles.notice} role="status">Saved progress is temporarily unavailable. You can still explore and preview every path; saving will work again once the connection recovers.</p>}

    {active.length > 0 && <section className={styles.section} aria-labelledby="continue-heading">
      <div className={styles.sectionHead}>
        <div><p className={styles.kicker}>Continue learning</p><h2 id="continue-heading">Pick up where you left off</h2></div>
      </div>
      <div className={styles.continueGrid}>
        {active.map(({ course, plan }) => <article key={course.id} className={styles.continueCard}>
          <div className={styles.cardTop}><span className={`${styles.badge} ${styles.badgeAccent}`}>{plan.goal.title}</span></div>
          <h3>{course.title}</h3>
          <ProgressBar percent={plan.progress.percent} label={`${course.title} progress`} />
          <div className={styles.continueMeta}>
            <span>{plan.progress.completed} of {plan.progress.requiredTotal - plan.progress.known} topics completed</span>
            {plan.progress.weeksRemaining > 0 && <span>≈ {plan.progress.weeksRemaining} {plan.progress.weeksRemaining === 1 ? "week" : "weeks"} left at {plan.settings.weeklyHours} h/week</span>}
          </div>
          {plan.nextTopic && <p className={styles.nextLine}>{plan.nextIsOptional ? "Optional next" : "Next"}: <strong>{plan.nextTopic.title}</strong> · {formatHours(plan.nextTopic.hours)}</p>}
          <div className={styles.headerActions}>
            <Link className="button primary" href={plan.nextTopic ? `/learning-roadmap/${course.id}?topic=${plan.nextTopic.id}` : `/learning-roadmap/${course.id}`}>
              {plan.nextTopic?.status === "in_progress" ? "Continue topic" : plan.nextTopic ? "Start next topic" : "Review roadmap"}
            </Link>
            <Link className={styles.secondaryButton} href={`/learning-roadmap/${course.id}`}>Open roadmap</Link>
          </div>
        </article>)}
      </div>
    </section>}

    <section className={styles.section} aria-labelledby="catalog-heading">
      <div className={styles.sectionHead}>
        <div><p className={styles.kicker}>{active.length ? "Explore more" : "Start here"}</p><h2 id="catalog-heading">Find your learning path</h2></div>
        <p>Guided paths are complete, personalised courses with progress tracking. Career roadmaps compare your profile with a role and point you to what to practise.</p>
      </div>
      <CourseCatalog items={items} />
    </section>

    <footer className={styles.footerLinks}>
      <span>Resources are free and link to their original publishers. CareerForge is not affiliated with roadmap.sh or any linked provider.</span>
      <Link href="/learning-roadmap/product">How CareerForge itself evolves</Link>
    </footer>
  </div>;
}
