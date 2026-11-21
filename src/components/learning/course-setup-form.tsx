"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { ExperienceLevel, ResourceFormat } from "@/lib/learning/schema";
import type { LearningSettings } from "@/lib/learning/plan";
import { saveEnrollment } from "./learning-client";
import styles from "./learning.module.css";

const levels: { id: ExperienceLevel; title: string; text: string }[] = [
  { id: "new", title: "New to programming", text: "Start from the very beginning with full explanations." },
  { id: "some", title: "Some experience", text: "You have written code before. Fundamentals are flagged for quick review." },
  { id: "experienced", title: "Experienced developer", text: "Skim the basics, mark what you know and focus on new material." }
];
const formats: { id: ResourceFormat; title: string; text: string }[] = [
  { id: "mixed", title: "No preference", text: "Keep each topic's recommended order." },
  { id: "reading", title: "Reading", text: "Official docs and books first." },
  { id: "video", title: "Video & courses", text: "Lectures and structured courses first." },
  { id: "interactive", title: "Hands-on", text: "Interactive lessons and exercises first." }
];

/**
 * Personalisation form. Before enrolment it is a plain GET form that previews
 * the roadmap (works without JavaScript). Once enrolled it saves changes;
 * progress is keyed by topic, so changing goal or level never erases it.
 */
export function CourseSetupForm({ courseId, goals, initial, enrolled }: {
  courseId: string;
  goals: { id: string; title: string; description: string }[];
  initial: LearningSettings;
  enrolled: boolean;
}) {
  const router = useRouter();
  const [hours, setHours] = useState(initial.weeklyHours);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  async function submit(event: FormEvent<HTMLFormElement>) {
    if (!enrolled) return; // GET preview navigation.
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setMessage({ tone: "info", text: "Saving your plan…" });
    const result = await saveEnrollment({
      courseId,
      goalId: String(data.get("goal")),
      level: String(data.get("level")) as ExperienceLevel,
      weeklyHours: Number(data.get("hours")),
      format: String(data.get("format")) as ResourceFormat
    });
    if (!result.ok) { setMessage({ tone: "error", text: result.message }); return; }
    setMessage({ tone: "info", text: "Plan updated. Your progress is unchanged." });
    startTransition(() => router.refresh());
  }

  return <form className={styles.setupForm} action={`/learning-roadmap/${courseId}`} method="get" onSubmit={submit} aria-describedby={`${courseId}-setup-note`}>
    <fieldset>
      <legend>What do you want to achieve?</legend>
      <div className={styles.optionGrid}>
        {goals.map(goal => <label key={goal.id} className={styles.option}>
          <input type="radio" name="goal" value={goal.id} defaultChecked={goal.id === initial.goalId} required />
          <strong>{goal.title}</strong><span>{goal.description}</span>
        </label>)}
      </div>
    </fieldset>
    <fieldset>
      <legend>Your current experience</legend>
      <div className={styles.optionGrid}>
        {levels.map(level => <label key={level.id} className={styles.option}>
          <input type="radio" name="level" value={level.id} defaultChecked={level.id === initial.level} required />
          <strong>{level.title}</strong><span>{level.text}</span>
        </label>)}
      </div>
    </fieldset>
    <fieldset>
      <legend>Weekly study time</legend>
      <p className={styles.fieldHint}>Used to estimate your finish date and plan each week. It never removes topics.</p>
      <div className={styles.range}>
        <input id={`${courseId}-hours`} type="range" name="hours" min={1} max={40} step={1} value={hours} onChange={event => setHours(Number(event.target.value))} aria-label="Weekly study hours" aria-valuetext={`${hours} hours per week`} />
        <output htmlFor={`${courseId}-hours`}>{hours} h / week</output>
      </div>
    </fieldset>
    <fieldset>
      <legend>Preferred resource format</legend>
      <p className={styles.fieldHint}>Resources matching your preference are listed first. All resources are free and currently in English.</p>
      <div className={styles.optionGrid}>
        {formats.map(format => <label key={format.id} className={styles.option}>
          <input type="radio" name="format" value={format.id} defaultChecked={format.id === initial.format} required />
          <strong>{format.title}</strong><span>{format.text}</span>
        </label>)}
      </div>
    </fieldset>
    <div className={styles.formActions}>
      <button className="button primary" type="submit" disabled={pending}>{enrolled ? "Save plan changes" : "Preview my roadmap"}</button>
      <p id={`${courseId}-setup-note`} className={styles.status} data-tone={message?.tone} role="status" aria-live="polite">
        {message?.text ?? (enrolled ? "Changing your goal keeps every completed topic." : "Nothing is saved until you choose to start.")}
      </p>
    </div>
  </form>;
}
