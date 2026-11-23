import Link from "next/link";
import type { AccountProfile } from "@/lib/account/schemas";
import { profileStrength, type StrengthCounts } from "@/lib/profile-strength";

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** The profile's headline card: who you are, how strong the profile is, and the one next step. */
export function ProfileOverview({ profile, counts }: { profile: AccountProfile; counts: StrengthCounts }) {
  const { percent, steps, next, level, done } = profileStrength(profile, counts);
  const initials = profile.name.split(" ").filter(Boolean).map(word => word[0]).slice(0, 2).join("").toUpperCase() || "CF";
  return <section className="panel profile-overview" aria-labelledby="profile-strength-title">
    <div className="overview-identity">
      <div className="overview-avatar" aria-hidden="true">{initials}</div>
      <div>
        <p className="eyebrow">YOUR PRIVATE PROFILE</p>
        <h2>{profile.name || "Your name. Your next chapter."}</h2>
        <p>{profile.headline || "Add a headline: the role you are working toward."}</p>
        {profile.location && <small>⌖ {profile.location}</small>}
      </div>
    </div>

    <div className="overview-strength">
      <div className="strength-ring" role="img" aria-label={`Profile strength ${percent}%`} style={{ ["--strength" as string]: String(percent) }}>
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className="ring-track" cx="60" cy="60" r={RADIUS} />
          <circle className="ring-value" cx="60" cy="60" r={RADIUS} strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)} />
        </svg>
        <span><strong>{percent}<small>%</small></strong>strength</span>
      </div>
      <div className="strength-copy">
        <h3 id="profile-strength-title">{level.title}</h3>
        <p>{level.message}</p>
        {next ? <Link href={next.href} className="button primary strength-next">Next: {next.label} <span aria-hidden="true">→</span></Link>
          : <Link href="/cv/saved" className="button primary strength-next">See your CV <span aria-hidden="true">→</span></Link>}
      </div>
    </div>

    <ol className="strength-steps" aria-label={`Profile steps: ${done} of ${steps.length} done`}>
      {steps.map(step => <li key={step.id} className={step.done ? "done" : next?.id === step.id ? "next" : undefined}>
        <Link href={step.href}>
          <span className="step-mark" aria-hidden="true">{step.done ? "✓" : `+${step.points}`}</span>
          <span><strong>{step.label}<span className="sr-only">{step.done ? ", done" : `, not done yet, worth ${step.points} points`}</span></strong><small>{step.detail}</small></span>
        </Link>
      </li>)}
    </ol>
  </section>;
}
