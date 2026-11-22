"use client";

import { AppIcon, type IconName } from "@/components/app-icons";
import { pictureFor } from "@/data/workshops/pictures";
import { callToAction, countdownTo, formatDuration, lifecycleOf } from "@/lib/workshops/lifecycle";
import type { RoadmapArea } from "@/lib/roadmaps/schema";
import type { Workshop, WorkshopCategory } from "@/lib/workshops/types";
import { DateTile, LocalTime, useMounted } from "./hooks";
import { Picture } from "./picture";
import styles from "./workshops.module.css";

/** Workshop topics share the roadmap accent colours, so a subject looks the same everywhere. */
export const areaOf: Record<WorkshopCategory, RoadmapArea> = {
  "AI & ML": "ai", "Web Dev": "web", Python: "programming", Cybersecurity: "security", "Cloud & DevOps": "cloud", "Systems & Algorithms": "cs"
};

export const topicIcon: Record<WorkshopCategory, IconName> = {
  "AI & ML": "brain", "Web Dev": "code", Python: "python", Cybersecurity: "shield", "Cloud & DevOps": "cloud", "Systems & Algorithms": "cpu"
};

export const durationLabel = (workshop: Workshop) => `${workshop.durationEstimated || workshop.durationNote ? "≈ " : ""}${formatDuration(workshop.durationMinutes)}`;

export function FormatLabel({ workshop, now, withDay = true }: { workshop: Workshop; now: number; withDay?: boolean }) {
  switch (lifecycleOf(workshop, now)) {
    case "live": return <span className={styles.liveNow}><i aria-hidden="true" />Happening Now</span>;
    case "upcoming": return <span className={styles.liveSoon}><i aria-hidden="true" />Live <LocalTime iso={workshop.startDateTime!} compact withDay={withDay} /></span>;
    case "replay": return <span>Replay Available</span>;
    default: return <span>Start Anytime</span>;
  }
}

export function Difficulty({ workshop }: { workshop: Workshop }) {
  return <span className={styles.difficulty} data-level={workshop.difficulty}><i aria-hidden="true" />{workshop.difficulty}</span>;
}

export function BookmarkButton({ saved, title, onToggle, withLabel = false }: { saved: boolean; title: string; onToggle: () => void; withLabel?: boolean }) {
  return <button type="button" className={withLabel ? styles.secondary : styles.bookmark} aria-pressed={saved} data-saved={saved || undefined}
    aria-label={withLabel ? undefined : `Save ${title}`} onClick={onToggle}>
    <AppIcon name="bookmark" />{withLabel && (saved ? "Saved" : "Save")}
  </button>;
}

export function ActionLink({ workshop, now, primary = false }: { workshop: Workshop; now: number; primary?: boolean }) {
  const action = callToAction(workshop, now);
  return <a className={primary ? `button primary ${styles.primary}` : styles.action} href={action.url} target="_blank" rel="noopener noreferrer">
    {action.label}<AppIcon name="external" /><span className="sr-only"> {workshop.title} (opens in a new tab)</span>
  </a>;
}

export function WorkshopCard({ workshop, now, saved, onOpen, onToggle }: { workshop: Workshop; now: number; saved: boolean; onOpen: () => void; onToggle: () => void }) {
  const state = lifecycleOf(workshop, now);
  return <article className={styles.card} data-area={areaOf[workshop.category]} data-state={state}>
    <div className={styles.cover}>
      <Picture name={pictureFor(workshop)} sizes="(max-width: 620px) 92vw, 380px" />
      {state === "upcoming" && <DateTile iso={workshop.startDateTime!} />}
      <p className={styles.chip}><FormatLabel workshop={workshop} now={now} withDay={false} /></p>
      <BookmarkButton saved={saved} title={workshop.title} onToggle={onToggle} />
    </div>
    <p className={styles.topic}><AppIcon name={topicIcon[workshop.category]} />{workshop.category}</p>
    <h3><button type="button" data-workshop={workshop.id} aria-haspopup="dialog" onClick={onOpen}>{workshop.title}</button></h3>
    <p className={styles.hook}>{workshop.outcomeHook}</p>
    <div className={styles.cardFoot}>
      <span className={styles.meta}>
        <Difficulty workshop={workshop} />
        <span>{durationLabel(workshop)}</span>
        <span>{workshop.priceType}</span>
        {workshop.submissionStatus === "private" && <span>Added by you</span>}
        {workshop.sourceType === "community" && <span>Suggested by a learner</span>}
      </span>
      <ActionLink workshop={workshop} now={now} />
    </div>
  </article>;
}

const pad = (value: number) => String(value).padStart(2, "0");

function CountdownClock({ workshop, now }: { workshop: Workshop; now: number }) {
  const mounted = useMounted();
  const left = countdownTo(workshop, now);
  if (!left) return null;
  const showSeconds = left.days === 0 && left.hours === 0;
  const parts = showSeconds ? [[left.minutes, "min"], [left.seconds, "sec"]] as const : [[left.days, "days"], [left.hours, "hours"], [left.minutes, "min"]] as const;
  // Only the last hour ticks visibly; screen readers get the calm full sentence once.
  return <div className={styles.countdown} role="timer" aria-live="off" aria-label={`Starts in ${left.days} days, ${left.hours} hours and ${left.minutes} minutes`}>
    {parts.map(([value, unit]) => <span key={unit} aria-hidden="true"><strong suppressHydrationWarning>{mounted ? pad(value) : "--"}</strong>{unit}</span>)}
  </div>;
}

export function Spotlight({ workshop, now, saved, onOpen, onToggle }: { workshop: Workshop; now: number; saved: boolean; onOpen: () => void; onToggle: () => void }) {
  const state = lifecycleOf(workshop, now);
  const reason = state === "live" ? "Happening Now" : state === "upcoming" ? (workshop.isFeatured ? "Featured live session" : "Next live session") : workshop.badge ?? "Start here";
  return <section className={styles.spotlight} data-area={areaOf[workshop.category]} data-state={state} aria-labelledby="spotlight-title">
    <Picture name={pictureFor(workshop)} sizes="(max-width: 760px) 100vw, 1140px" eager />
    <div className={styles.spotlightMain}>
      <p className={state === "live" ? styles.liveNow : styles.reason}>{state === "live" && <i aria-hidden="true" />}{reason}</p>
      <h2 id="spotlight-title">{workshop.outcomeHook}</h2>
      <p className={styles.spotlightTitle}><button type="button" data-workshop={workshop.id} aria-haspopup="dialog" onClick={onOpen}>{workshop.title}</button></p>
      <p className={styles.meta}>
        <Difficulty workshop={workshop} />
        <span>{state === "anytime" || state === "replay" ? "Self-paced" : "Live online"}</span>
        <span>{durationLabel(workshop)}</span>
        <span>{workshop.priceType}</span>
        <span>{workshop.instructorOrHost}</span>
      </p>
    </div>
    <div className={styles.spotlightSide}>
      {state === "upcoming" && <><CountdownClock workshop={workshop} now={now} /><p className={styles.when}><LocalTime iso={workshop.startDateTime!} /></p></>}
      <div className={styles.spotlightActions}>
        <ActionLink workshop={workshop} now={now} primary />
        <BookmarkButton saved={saved} title={workshop.title} onToggle={onToggle} />
      </div>
    </div>
  </section>;
}
