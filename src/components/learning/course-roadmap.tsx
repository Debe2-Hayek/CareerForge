import Link from "next/link";
import type { LearningCourse, LearningTopic, TopicState } from "@/lib/learning/schema";
import { orderResources, type LearningPlan, type PlanProject, type PlanTopic, type PlanTopicStatus } from "@/lib/learning/plan";
import type { Recommendation } from "@/lib/learning/recommendations";
import { CourseSetupForm } from "./course-setup-form";
import { ProgressRing } from "./progress-bar";
import { ProjectControls } from "./project-controls";
import { StartPathButton } from "./start-path-button";
import { TopicControls } from "./topic-controls";
import { TopicDialog } from "./topic-dialog";
import styles from "./learning.module.css";

export type RoadmapMode = "enrolled" | "preview";
export type RoadmapView = "path" | "overview";

const statusLabel: Record<PlanTopicStatus, string> = {
  completed: "Completed",
  known: "Already known",
  in_progress: "In progress",
  available: "Ready to start",
  locked: "Needs prerequisites"
};
const tierLabel = { essential: "Essential", recommended: "Recommended", optional: "Optional" } as const;
const levelLabel = { foundation: "Beginner", core: "Intermediate", advanced: "Advanced" } as const;
const typeLabel = { docs: "Docs", interactive: "Interactive", course: "Course", video: "Video", book: "Free book", exercises: "Exercises", article: "Guide" } as const;
const hours = (value: number) => `${value} h`;

type Hrefs = { topic: (id: string) => string; view: (view: RoadmapView) => string; close: string };

export function CourseRoadmap({ course, plan, mode, view, selectedTopicId, recommendations, hrefs, storageAvailable }: {
  course: LearningCourse;
  plan: LearningPlan;
  mode: RoadmapMode;
  view: RoadmapView;
  selectedTopicId: string | null;
  recommendations: Recommendation[];
  hrefs: Hrefs;
  storageAvailable: boolean;
}) {
  const enrolled = mode === "enrolled";
  const topicsById = new Map(course.topics.map(topic => [topic.id, topic]));
  const planTopics = plan.phases.flatMap(phase => phase.topics);
  const selected = selectedTopicId ? planTopics.find(topic => topic.id === selectedTopicId) : undefined;
  const relevantProjects = plan.projects.filter(project => project.relevant);
  const otherProjects = plan.projects.filter(project => !project.relevant);
  const remainingTopics = plan.progress.requiredTotal - plan.progress.known;

  return <div className={styles.page}>
    <nav aria-label="Breadcrumb"><ol className={styles.breadcrumb}><li><Link href="/learning-roadmap">Learning roadmap</Link></li><li aria-current="page">{course.title}</li></ol></nav>

    <header className={styles.courseHeader}>
      <div>
        <p className={styles.kicker}>{enrolled ? "Your personalised roadmap" : "Roadmap preview — not saved yet"}</p>
        <h1>{course.title}</h1>
        <p className={styles.goalLine}>Goal: <strong>{plan.goal.title}</strong>. {plan.goal.description}</p>
        <div className={styles.headerActions}>
          {plan.nextTopic && <Link className="button primary" href={hrefs.topic(plan.nextTopic.id)} scroll={false}>
            {plan.nextTopic.status === "in_progress" ? "Continue" : plan.nextIsOptional ? "Explore" : "Start"}: {plan.nextTopic.title}
          </Link>}
          {!enrolled && storageAvailable && <StartPathButton input={{ courseId: course.id, ...plan.settings }} />}
          <a className={styles.secondaryButton} href="#adjust-plan">{enrolled ? "Adjust plan" : "Change answers"}</a>
        </div>
        {!storageAvailable && <p className={styles.notice} role="status">Progress saving is temporarily unavailable, so this roadmap is read-only. Your earlier progress is safe and will reappear when the connection recovers.</p>}
      </div>
      <aside className={styles.stats} aria-label="Roadmap summary">
        <div className={styles.ring}>
          <ProgressRing percent={plan.progress.percent} />
          <div><div className={styles.ringValue}>{plan.progress.percent}%</div><div className={styles.muted}>{plan.progress.completed} of {remainingTopics} plan topics completed</div></div>
        </div>
        <dl className={styles.statList}>
          <div><dt>Remaining</dt><dd>≈ {hours(plan.progress.remainingHours)}</dd></div>
          <div><dt>At {plan.settings.weeklyHours} h/week</dt><dd>{plan.progress.weeksRemaining ? `≈ ${plan.progress.weeksRemaining} weeks` : "Done"}</dd></div>
          <div><dt>Current stage</dt><dd>{plan.currentPhase?.title ?? "Complete"}</dd></div>
          <div><dt>Marked as known</dt><dd>{plan.progress.known}</dd></div>
        </dl>
        <p className={styles.status}>Estimates assume your stated experience; they are guides, not deadlines. Topics marked as known are excluded from the percentage.</p>
      </aside>
    </header>

    <div className={styles.layout}>
      <main>
        <div className={styles.toolbar}>
          <nav className={styles.viewToggle} aria-label="Roadmap view">
            <Link href={hrefs.view("path")} aria-current={view === "path" ? "page" : undefined} scroll={false}>Guided path</Link>
            <Link href={hrefs.view("overview")} aria-current={view === "overview" ? "page" : undefined} scroll={false}>Overview map</Link>
          </nav>
          <ul className={styles.legend} aria-label="Legend">
            {(["available", "in_progress", "completed", "known", "locked"] as const).map(status => <li key={status}><span className={styles.dot} data-status={status} aria-hidden="true" />{statusLabel[status]}</li>)}
          </ul>
        </div>
        {view === "overview" ? <OverviewMap plan={plan} hrefs={hrefs} /> : <PathView plan={plan} hrefs={hrefs} />}

        <section className={styles.section} aria-labelledby="projects-heading">
          <div className={styles.sectionHead}>
            <div><p className={styles.kicker}>Practice → build → prove</p><h2 id="projects-heading">Projects for your goal</h2></div>
            <p>Projects unlock as you finish the topics they need. Finished projects with a public link are your strongest portfolio evidence.</p>
          </div>
          <div className={styles.projectGrid}>
            {relevantProjects.map(project => <ProjectCard key={project.project.id} course={course} plan={plan} item={project} enrolled={enrolled && storageAvailable} topicHref={hrefs.topic} />)}
          </div>
          {otherProjects.length > 0 && <details className={styles.panel} style={{ marginTop: 16 }}>
            <summary>Projects from other specialisations ({otherProjects.length})</summary>
            <div className={styles.projectGrid} style={{ marginTop: 12 }}>
              {otherProjects.map(project => <ProjectCard key={project.project.id} course={course} plan={plan} item={project} enrolled={enrolled && storageAvailable} topicHref={hrefs.topic} />)}
            </div>
          </details>}
        </section>

        <section id="adjust-plan" className={styles.section} aria-labelledby="adjust-heading" style={{ scrollMarginTop: 20 }}>
          <div className={styles.sectionHead}><div><p className={styles.kicker}>Personalisation</p><h2 id="adjust-heading">{enrolled ? "Adjust your plan" : "Change your answers"}</h2></div></div>
          <CourseSetupForm courseId={course.id} goals={course.goals} initial={plan.settings} enrolled={enrolled && storageAvailable} />
        </section>
      </main>

      <aside className={styles.sidebar} aria-label="Guidance">
        <section className={styles.panel} aria-labelledby="next-heading">
          <p className={styles.kicker}>What to do next</p>
          <h2 id="next-heading" className="sr-only">Recommended next steps</h2>
          {recommendations.length ? <ul className={styles.recommendations}>
            {recommendations.map(item => <li key={item.id} className={styles.recommendation} data-kind={item.kind}>
              <strong>{item.title}</strong><p>{item.reason}</p><Link href={item.href} scroll={false}>{item.action} →</Link>
            </li>)}
          </ul> : <p className={styles.muted}>You have completed this roadmap. Explore another specialisation or path.</p>}
        </section>
        {plan.thisWeek.length > 0 && <section className={styles.panel} aria-labelledby="week-heading">
          <p className={styles.kicker}>This week · {plan.settings.weeklyHours} h</p>
          <h2 id="week-heading">Suggested plan</h2>
          <ul className={styles.weekList}>
            {plan.thisWeek.map(topic => <li key={topic.id}><Link href={hrefs.topic(topic.id)} scroll={false}>{topic.title}<span>≈ {hours(topic.hours)}</span></Link></li>)}
          </ul>
        </section>}
        <EvidencePanel plan={plan} />
      </aside>
    </div>

    <footer className={styles.attribution}>
      <p>Curriculum, explanations, exercises and projects are original CareerForge material, reviewed {course.reviewedAt}. Every resource links to its original free publisher; nothing is copied or affiliated.{course.roadmapSh && <> For the community-maintained topic map, see the <a href={course.roadmapSh.url} target="_blank" rel="noopener noreferrer">{course.roadmapSh.title} on roadmap.sh<span className="sr-only"> (opens in a new tab)</span></a>.</>}</p>
    </footer>

    {selected && <TopicDialog key={selected.id} titleId="topic-title" closeHref={hrefs.close} label={`${course.title} · ${plan.phases.find(phase => phase.id === selected.phaseId)?.title ?? ""}`}>
      <TopicDetail course={course} plan={plan} topic={topicsById.get(selected.id)!} planTopic={selected} enrolled={enrolled} storageAvailable={storageAvailable} hrefs={hrefs} />
    </TopicDialog>}
  </div>;
}

function TopicBadges({ topic }: { topic: PlanTopic }) {
  return <>
    {!topic.inPlan && <span className={styles.badge}>{topic.tier === "optional" ? "Optional" : "Not in this goal"}</span>}
    {topic.inPlan && topic.tier === "recommended" && <span className={styles.badge}>Recommended</span>}
    {topic.reviewSuggested && topic.status !== "in_progress" && <span className={`${styles.badge} ${styles.badgeWarn}`}>Quick review?</span>}
    {topic.isNext && <span className={`${styles.badge} ${styles.badgeAccent}`}>Up next</span>}
  </>;
}

function PathView({ plan, hrefs }: { plan: LearningPlan; hrefs: Hrefs }) {
  return <div className={styles.phases}>
    {plan.phases.map((phase, index) => {
      const content = <>
        <ol className={styles.topicList}>
          {phase.topics.map(topic => {
            return <li key={topic.id}>
              <Link href={hrefs.topic(topic.id)} scroll={false} className={styles.topicLink} data-next={topic.isNext} data-in-plan={topic.inPlan}
                aria-label={`${topic.title}. ${statusLabel[topic.status]}. ${tierLabel[topic.tier]}. About ${topic.hours} hours.`}>
                <span className={styles.dot} data-status={topic.status} aria-hidden="true" />
                <span>
                  <span className={styles.topicTitle}>{topic.title}</span>
                  <span className={styles.topicMeta} aria-hidden="true">
                    <span>{statusLabel[topic.status]}</span><span>≈ {hours(topic.hours)}</span><span>{levelLabel[topic.level]}</span>
                    {topic.status === "locked" && <span>After {topic.missingPrerequisites.map(item => item.title).join(", ")}</span>}
                  </span>
                </span>
                <span className={styles.topicSide} aria-hidden="true"><TopicBadges topic={topic} /></span>
              </Link>
            </li>;
          })}
        </ol>
      </>;
      const head = <div className={styles.phaseHead}>
        <span className={styles.phaseIndex} aria-hidden="true">{phase.included ? String(index + 1).padStart(2, "0") : "+"}</span>
        <div><h3>{phase.title}</h3><p>{phase.goal}</p></div>
        <span className={styles.phaseCount}>{phase.required ? `${phase.done}/${phase.required} done` : phase.included ? "Optional for this goal" : "Other specialisation"}</span>
      </div>;
      return phase.included
        ? <section key={phase.id} className={styles.phase} data-included="true" aria-label={phase.title}>{head}{content}</section>
        : <details key={phase.id} className={styles.phase} data-included="false"><summary style={{ listStyle: "none", cursor: "pointer" }}>{head}</summary>{content}</details>;
    })}
  </div>;
}

function OverviewMap({ plan, hrefs }: { plan: LearningPlan; hrefs: Hrefs }) {
  return <div className={styles.overview} role="region" aria-label="Overview map of all phases" tabIndex={0}>
    {plan.phases.map(phase => <section key={phase.id} className={styles.overviewPhase} data-included={phase.included} aria-label={phase.title}>
      <h3>{phase.title}</h3>
      <p>{phase.included ? phase.required ? `${phase.done}/${phase.required} done` : "Optional" : "Other specialisation"}</p>
      <ol className={styles.nodeList}>
        {phase.topics.map(topic => <li key={topic.id}>
          <Link href={hrefs.topic(topic.id)} scroll={false} className={styles.node} data-next={topic.isNext} data-in-plan={topic.inPlan} aria-label={`${topic.title}: ${statusLabel[topic.status]}`}>
            <span className={styles.dot} data-status={topic.status} aria-hidden="true" />{topic.title}
          </Link>
        </li>)}
      </ol>
    </section>)}
  </div>;
}

function EvidencePanel({ plan }: { plan: LearningPlan }) {
  const building = plan.projects.filter(project => project.state === "building").length;
  const built = plan.projects.filter(project => project.state === "completed");
  const linked = built.filter(project => project.evidenceUrl).length;
  return <section className={styles.panel} aria-labelledby="evidence-heading">
    <p className={styles.kicker}>Your evidence</p>
    <h2 id="evidence-heading">From learning to proof</h2>
    <ul className={styles.evidenceLadder}>
      <li><span>Topics marked complete <small>(self-reported)</small></span><strong>{plan.progress.completed}</strong></li>
      <li><span>Topics marked as known <small>(self-assessed)</small></span><strong>{plan.progress.known}</strong></li>
      <li><span>Projects in progress</span><strong>{building}</strong></li>
      <li><span>Projects built</span><strong>{built.length}</strong></li>
      <li><span>Built with a public link <small>(verifiable)</small></span><strong>{linked}</strong></li>
    </ul>
    <p className={styles.status}>Completing lessons is practice, not certification. Skill checks and public project links are what reviewers can verify. <Link href="/skill-checks">See skill checks</Link></p>
  </section>;
}

function ProjectCard({ course, plan, item, enrolled, topicHref }: { course: LearningCourse; plan: LearningPlan; item: PlanProject; enrolled: boolean; topicHref: (id: string) => string }) {
  const { project } = item;
  const readiness = item.readiness === "ready" ? "Ready to build" : item.readiness === "almost" ? `${item.missing.length} topic${item.missing.length === 1 ? "" : "s"} to go` : "Locked";
  const stateLabel = item.state === "completed" ? "Built" : item.state === "building" ? "Building" : readiness;
  const entry = [
    project.title,
    project.objective,
    `Skills demonstrated: ${project.skills.join(", ")}`,
    `Built with: ${project.stack.join(", ")}`,
    item.evidenceUrl ? `Code / demo: ${item.evidenceUrl}` : "Code / demo: (add a public link)",
    `Context: built while following the CareerForge ${course.title} roadmap (${plan.goal.title}). Completion is self-reported.`
  ].join("\n");
  return <details id={`project-${project.id}`} className={styles.project} data-readiness={item.readiness} open={item.state === "building" || undefined}>
    <summary>
      <div>
        <strong>{project.title}</strong>
        <p>{project.objective}</p>
      </div>
      <div className={styles.topicSide}>
        <span className={styles.badge}>{project.level[0].toUpperCase() + project.level.slice(1)}</span>
        <span className={`${styles.badge} ${item.state === "completed" || item.readiness === "ready" ? styles.badgeAccent : ""}`}>{stateLabel}</span>
      </div>
    </summary>
    <div className={styles.projectBody}>
      {item.missing.length > 0 && !item.state && <p className={styles.status}>Finish first: {item.missing.map((topic, index) => <span key={topic.id}>{index ? ", " : ""}<Link href={topicHref(topic.id)} scroll={false}>{topic.title}</Link></span>)}</p>}
      <div className={styles.projectCols}>
        <div><h4>Requirements</h4><ul>{project.requirements.map(text => <li key={text}>{text}</li>)}</ul></div>
        <div><h4>Milestones</h4><ol>{project.milestones.map(text => <li key={text}>{text}</li>)}</ol></div>
        <div><h4>Done when</h4><ul>{project.doneWhen.map(text => <li key={text}>{text}</li>)}</ul></div>
        <div><h4>Stack &amp; skills</h4><ul><li>{project.stack.join(", ")}</li><li>Skills: {project.skills.join(", ")}</li></ul>
          {project.stretch.length > 0 && <><h4 style={{ marginTop: 12 }}>Stretch goals</h4><ul>{project.stretch.map(text => <li key={text}>{text}</li>)}</ul></>}
        </div>
      </div>
      <p className={styles.status}><strong>Portfolio value:</strong> {project.portfolioValue}</p>
      <ProjectControls key={`${project.id}-${item.state}-${item.evidenceUrl}`} courseId={course.id} projectId={project.id} state={item.state} evidenceUrl={item.evidenceUrl} enrolled={enrolled} ready={item.readiness === "ready"} portfolioEntry={entry} />
    </div>
  </details>;
}

function TopicDetail({ course, plan, topic, planTopic, enrolled, storageAvailable, hrefs }: {
  course: LearningCourse; plan: LearningPlan; topic: LearningTopic; planTopic: PlanTopic; enrolled: boolean; storageAvailable: boolean; hrefs: Hrefs;
}) {
  const ordered = plan.phases.filter(phase => phase.included).flatMap(phase => phase.topics);
  const position = ordered.findIndex(item => item.id === topic.id);
  const next = position >= 0 ? ordered.slice(position + 1).find(item => item.inPlan && item.status !== "completed" && item.status !== "known") ?? null : null;
  const resources = orderResources(topic.resources, plan.settings.format);
  const projects = plan.projects.filter(item => item.project.requires.includes(topic.id) && item.relevant);
  const state: TopicState | null = planTopic.status === "available" || planTopic.status === "locked" ? null : planTopic.status;
  const titles = new Map(course.topics.map(item => [item.id, item.title]));

  return <div className={styles.dialogInner}>
    <header className={styles.topicHeader}>
      <div className={styles.cardTop}>
        <span className={styles.badge}>{statusLabel[planTopic.status]}</span>
        <span className={styles.badge}>{tierLabel[topic.tier]}</span>
        <span className={styles.badge}>{levelLabel[topic.level]}</span>
        <span className={styles.badge}>≈ {hours(planTopic.hours)}</span>
      </div>
      <h2 id="topic-title">{topic.title}</h2>
      <p>{topic.summary}</p>
    </header>

    {planTopic.reviewSuggested && planTopic.status !== "completed" && <p className={styles.notice}>You said you have some experience. Check the criteria at the bottom: if you already meet them, mark this topic as known and move on.</p>}

    <section className={`${styles.block} ${styles.why}`} aria-labelledby="why-heading"><h3 id="why-heading">Why it matters</h3><p>{topic.why}</p></section>

    <section className={styles.block} aria-labelledby="objectives-heading"><h3 id="objectives-heading">You will be able to</h3><ul>{topic.objectives.map(text => <li key={text}>{text}</li>)}</ul></section>

    <section className={styles.block} aria-labelledby="prereq-heading">
      <h3 id="prereq-heading">Know first</h3>
      {topic.prerequisites.length ? <ul className={styles.prereqs}>
        {topic.prerequisites.map(id => {
          const status = plan.phases.flatMap(phase => phase.topics).find(item => item.id === id)?.status ?? "available";
          return <li key={id}><Link href={hrefs.topic(id)} scroll={false}><span className={styles.dot} data-status={status} aria-hidden="true" />{titles.get(id)}<span className="sr-only"> ({statusLabel[status]})</span></Link></li>;
        })}
      </ul> : <p>No prerequisites — you can start here.</p>}
    </section>

    {topic.example && <section className={styles.block} aria-labelledby="example-heading"><h3 id="example-heading">Example</h3><pre className={styles.code} tabIndex={0}><code>{topic.example.code}</code></pre></section>}

    <section className={styles.block} aria-labelledby="resources-heading">
      <h3 id="resources-heading">Learn it for free</h3>
      <ul className={styles.resources}>
        {resources.map(resource => <li key={resource.url + resource.title}>
          <a className={styles.resource} href={resource.url} target="_blank" rel="noopener noreferrer">
            <span><strong>{resource.title}</strong><br /><span>{resource.provider}</span></span>
            <span className={styles.resourceTags}>
              <span className={styles.badge}>{typeLabel[resource.type]}</span>
              <span className={`${styles.badge} ${resource.free ? styles.badgeAccent : styles.badgeWarn}`}>{resource.free ? "Free" : "Paid, optional"}</span>
              {resource.preferred && plan.settings.format !== "mixed" && <span className={styles.badge}>Your format</span>}
            </span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </li>)}
      </ul>
    </section>

    <section className={styles.block} aria-labelledby="practice-heading">
      <h3 id="practice-heading">Practise</h3>
      <ol>{topic.exercises.map(text => <li key={text}>{text}</li>)}</ol>
      {topic.miniProject && <p style={{ marginTop: 12 }}><strong>Mini-project:</strong> {topic.miniProject}</p>}
      {projects.length > 0 && <p style={{ marginTop: 12 }}>Used in: {projects.map((item, index) => <span key={item.project.id}>{index ? ", " : ""}<Link href={`${hrefs.close}#project-${item.project.id}`}>{item.project.title}</Link></span>)}</p>}
    </section>

    <TopicControls key={topic.id} courseId={course.id} topicId={topic.id} state={state} doneWhen={topic.doneWhen} enrolled={enrolled}
      saveDisabledReason={!storageAvailable ? "Progress saving is temporarily unavailable." : enrolled ? null : "Save this roadmap (“Save and start learning”) to track progress."}
      nextHref={next ? hrefs.topic(next.id) : null} nextTitle={next?.title ?? null} />

    {next && <div className={styles.nextTopic}><span className={styles.muted}>Next in your plan</span><Link href={hrefs.topic(next.id)} scroll={false}>{next.title} →</Link></div>}
  </div>;
}
