import Link from "next/link";
import type { AccountProfile } from "@/lib/account/schemas";
import type { CatalogJob } from "@/lib/tracker/schemas";
import {
  buildCareerLearningPath,
  getLearningTracks,
  type CareerLearningStep,
  type LearningTrackId
} from "@/lib/learning-path";
import { strongestEvidence, type SkillEvidence } from "@/lib/learning/evidence";
import styles from "./learning-roadmap.module.css";

const statusLabels = {
  priority: "Priority gap",
  covered: "Self-reported coverage",
  recommended: "Recommended foundation"
} as const;

const evidenceLabels = { assessed: "Assessed", project: "Project evidence", practised: "Practised" } as const;

export type GuidedLink = { href: string; label: string };

function Step({ step, number, evidence, guided }: { step: CareerLearningStep; number: number; evidence: SkillEvidence | null; guided: GuidedLink | null }) {
  return <li id={`step-${step.id}`} className={styles.step} data-status={step.status}>
    <details open={step.isStart}>
      <summary>
        <span className={styles.stepNumber} aria-hidden="true">{String(number).padStart(2, "0")}</span>
        <span className={styles.stepTitle}>
          <span className={styles.stepLabel}>{step.title}</span>
          <span className={styles.stepReason}>{step.reason}</span>
        </span>
        <span className={styles.stepBadges}>
          {step.isStart && <span className={styles.startBadge}>Start here</span>}
          <span className={styles.statusBadge}>{statusLabels[step.status]}</span>
          {evidence && <span className={styles.statusBadge}>{evidenceLabels[evidence.level]}</span>}
        </span>
        <span className={styles.disclosure} aria-hidden="true" />
      </summary>
      <div className={styles.stepBody}>
        <dl>
          <div><dt>Learn</dt><dd>{step.focus}</dd></div>
          <div><dt>Build</dt><dd>{step.task}</dd></div>
          <div><dt>Ready for review when</dt><dd>{step.doneWhen}</dd></div>
          <div><dt>Your evidence</dt><dd>{evidence ? evidence.label : step.status === "covered" ? "Listed in your profile only (self-reported). Build or assess it to strengthen the claim." : "None recorded yet."}</dd></div>
        </dl>
        {guided && <Link className={styles.sourceLink} href={guided.href}>{guided.label} →</Link>}
        {step.sourceUrl
          ? <a className={styles.sourceLink} href={step.sourceUrl} target="_blank" rel="noopener noreferrer">Open the original roadmap.sh topic<span className="sr-only"> (opens in a new tab)</span></a>
          : <p className={styles.noSource}>No reviewed roadmap.sh topic maps cleanly to this role requirement yet. CareerForge kept the gap visible instead of inventing a source.</p>}
      </div>
    </details>
  </li>;
}

export function LearningRoadmap({ profile, jobs: catalog, targetId, trackId, evidence = new Map(), guidedLinks = {} }: {
  profile: AccountProfile;
  jobs: CatalogJob[];
  targetId?: string;
  trackId?: LearningTrackId;
  /** Recorded evidence by normalised skill (assessments, built projects, completed lessons). */
  evidence?: Map<string, SkillEvidence>;
  /** Career step id → matching topic in a guided path. */
  guidedLinks?: Record<string, GuidedLink>;
}) {
  const jobs = catalog.filter(job => job.skills.length > 0);
  const groups = [["Live listings", jobs.filter(job => !job.isFictional)], ["Demo roles", jobs.filter(job => job.isFictional)]] as const;
  const target = jobs.find(job => job.id === targetId);
  const plan = target || trackId ? buildCareerLearningPath(profile.skills, {
    trackId,
    targetTitle: target?.title,
    requiredSkills: target?.skills
  }) : null;
  const tracks = getLearningTracks();
  const selectedTrackId = plan?.track.id;
  // Step numbers continue across phases; computed up front (render must stay pure).
  const phaseOffsets = (plan?.phases ?? []).reduce<number[]>((offsets, phase, index, phases) => [...offsets, index === 0 ? 0 : offsets[index - 1] + phases[index - 1].steps.length], []);
  const totalSteps = (plan?.phases ?? []).reduce((sum, phase) => sum + phase.steps.length, 0);

  return <div className={styles.page}>
    <header className={styles.hero}>
      <div>
        <p className={styles.kicker}>YOUR NEXT SKILL, IN THE RIGHT ORDER</p>
        <h1>A learning roadmap built around where you want to go.</h1>
        <p className={styles.lede}>Choose a career path or a real role. CareerForge turns trusted roadmap.sh topics into an ordered plan with practical work and a clear definition of done.</p>
      </div>
      <aside className={styles.sourceCard} aria-label="Roadmap source and method">
        <span>CURATED WITH</span>
        <strong>roadmap.sh</strong>
        <p>CareerForge adds the role fit, practice brief and evidence criteria. The original topic map stays one click away.</p>
        <a href="https://roadmap.sh/" target="_blank" rel="noopener noreferrer">Visit roadmap.sh<span className="sr-only"> (opens in a new tab)</span></a>
      </aside>
    </header>

    <section className={styles.trackSection} aria-labelledby="track-heading">
      <div className={styles.sectionHeading}>
        <div><p className={styles.kicker}>01 / CHOOSE A DIRECTION</p><h2 id="track-heading">Six paths. One useful next step.</h2></div>
        <p>Each path moves from foundations to a portfolio-ready capstone. Pick one now, or use a role below to personalize it.</p>
      </div>
      <div className={styles.trackGrid}>
        {tracks.map((track, index) => {
          const targetQuery = target ? `&target=${encodeURIComponent(target.id)}` : "";
          const active = selectedTrackId === track.id;
          return <Link
            key={track.id}
            href={`/learning-roadmap/careers?track=${track.id}${targetQuery}`}
            className={styles.trackCard}
            data-active={active || undefined}
            aria-current={active ? "page" : undefined}
          >
            <span className={styles.trackIndex}>{String(index + 1).padStart(2, "0")}</span>
            <h3>{track.shortTitle}</h3>
            <p>{track.audience}</p>
            <span className={styles.trackMeta}>{track.phaseCount} phases · {track.topicCount} practical steps</span>
            <span className={styles.trackAction}>{active ? "Selected path" : "Explore path"}</span>
          </Link>;
        })}
      </div>
    </section>

    <section className={styles.targetSection} aria-labelledby="target-heading">
      <div>
        <p className={styles.kicker}>02 / MAKE IT YOURS</p>
        <h2 id="target-heading">Aim at a role you care about.</h2>
        <p>Selecting a role highlights its missing requirements without pretending that a profile keyword proves proficiency.</p>
      </div>
      {jobs.length ? <form action="/learning-roadmap/careers" method="get" className={styles.targetForm}>
        <label htmlFor="learning-target">Target role</label>
        <div>
          <select id="learning-target" name="target" defaultValue={target?.id ?? ""} required key={target?.id ?? "empty"}>
            <option value="" disabled>Select a role</option>
            {groups.filter(([, list]) => list.length).map(([label, list]) => <optgroup label={label} key={label}>{list.map(job => <option value={job.id} key={job.id}>{job.title} · {job.company}</option>)}</optgroup>)}
          </select>
          <button className="button primary" type="submit">Build my role plan</button>
        </div>
      </form> : <p className={styles.notice}>Role listings are unavailable right now. The six curated career paths above remain available.</p>}
      {targetId && !target && <p className={styles.error} role="alert">That target is no longer available. Choose a current role or continue with a career path.</p>}
    </section>

    {!profile.skills.length && <aside className={styles.profileNotice}>Your profile has no saved skills yet, so no foundation can be marked as covered. <Link href="/account">Add your current skills</Link> for a more focused path.</aside>}

    {plan ? <section className={styles.plan} aria-labelledby="plan-heading">
      <header className={styles.planHeader}>
        <div>
          <p className={styles.kicker}>03 / YOUR ROADMAP</p>
          <p className={styles.planContext}>{target ? `Built for ${target.title} at ${target.company}` : "Curated career path"}</p>
          <h2 id="plan-heading">{plan.track.title}</h2>
          <p>{plan.track.outcome}</p>
          <div className={styles.planActions}>
            {plan.startStep && <a href={`#step-${plan.startStep.id}`} className="button primary">Go to my first step</a>}
            <a href={plan.track.sourceUrl} target="_blank" rel="noopener noreferrer" className="button">See the original roadmap<span className="sr-only"> (opens in a new tab)</span></a>
          </div>
        </div>
        <div className={styles.metrics} aria-label="Roadmap summary">
          {plan.targetCoverage !== null && <div><strong>{plan.targetCoverage}%</strong><span>role skills listed in your profile</span></div>}
          <div><strong>{plan.priorityCount}</strong><span>{plan.priorityCount === 1 ? "priority gap" : "priority gaps"}</span></div>
          <div><strong>{plan.phases.length}</strong><span>ordered phases</span></div>
        </div>
      </header>

      <p className={styles.honestyNote}>Profile coverage is self-reported, not verified. Completing a task is practice evidence—not certification, assessment or an automatic CV claim.</p>

      <div className={styles.phaseList}>
        {plan.phases.map((phase, phaseIndex) => <section className={styles.phase} key={phase.id} aria-labelledby={`phase-${phase.id}`}>
          <header>
            <span>{String(phaseIndex + 1).padStart(2, "0")}</span>
            <div><p>PHASE {phaseIndex + 1}</p><h3 id={`phase-${phase.id}`}>{phase.title}</h3><p>{phase.goal}</p></div>
          </header>
          <ol>{phase.steps.map((step, stepIndex) => <Step step={step} number={phaseOffsets[phaseIndex] + stepIndex + 1} evidence={strongestEvidence(evidence, step.skills)} guided={guidedLinks[step.id] ?? null} key={`${phase.id}-${step.id}`} />)}</ol>
        </section>)}
      </div>

      <section className={styles.capstone} aria-labelledby="capstone-heading">
        <div><span>FINAL PROOF PROJECT</span><strong>{String(totalSteps + 1).padStart(2, "0")}</strong></div>
        <div><h3 id="capstone-heading">{plan.capstone.title}</h3><p>{plan.capstone.brief}</p></div>
        <div><h4>Evidence to produce</h4><p>{plan.capstone.proof}</p></div>
      </section>

      <footer className={styles.attribution}>
        <p>{plan.source.attribution}</p>
        <p>Source reviewed {plan.source.reviewedAt}. No roadmap.sh content or progress is imported into your account.</p>
      </footer>
    </section> : <section className={styles.emptyPlan}>
      <span>START WITH A DIRECTION</span>
      <h2>Your roadmap should answer “what do I do next?”</h2>
      <p>Choose one of the six career paths or select a target role. You will get an ordered plan—not a wall of disconnected topics.</p>
    </section>}
  </div>;
}
