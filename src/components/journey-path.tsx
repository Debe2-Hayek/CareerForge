import Link from "next/link";
import type { Journey } from "@/lib/journey";

/** "Your path": four steps with done / now / next, and one clear next action. */
export function JourneyPath({ journey, firstName }: { journey: Journey; firstName: string }) {
  const { steps, done, current, action } = journey;
  return <section className="journey" aria-labelledby="journey-title">
    <header className="journey-head">
      <div>
        <p className="eyebrow">YOUR PATH</p>
        <h1 id="journey-title">{firstName ? `Welcome back, ${firstName}` : "Welcome back"}<span>.</span></h1>
        <p>{done === steps.length ? "You have completed every step. Keep your proof fresh and keep applying." : `You are on step ${current + 1} of ${steps.length}. One thing today moves you forward.`}</p>
      </div>
      <span className="journey-count" aria-label={`${done} of ${steps.length} steps done`}><strong>{done}</strong>/{steps.length}</span>
    </header>
    <ol className="journey-steps">
      {steps.map((step, index) => <li key={step.id} className="journey-step" data-state={step.state} aria-current={step.state === "now" ? "step" : undefined}>
        <span className="journey-mark" aria-hidden="true">{step.state === "done" ? "✓" : index + 1}</span>
        <span className="journey-step-text"><strong>{step.title}</strong><small>{step.text}</small></span>
        <span className="sr-only">{step.state === "done" ? "Done" : step.state === "now" ? "Current step" : "Later"}</span>
      </li>)}
    </ol>
    <div className="journey-action">
      <div>
        <span className="journey-action-eyebrow">{action.eyebrow}</span>
        <strong>{action.title}</strong>
        <p>{action.text}</p>
      </div>
      <Link href={action.href} className="button primary journey-go">{action.label} <span aria-hidden="true">→</span></Link>
    </div>
  </section>;
}
