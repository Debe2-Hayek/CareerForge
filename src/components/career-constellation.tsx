import Link from "next/link";
import type { Sky } from "@/lib/constellation";
import type { JourneyAction } from "@/lib/journey";

// Background stars: fixed positions so the server and the browser draw the same sky.
const DUST = [[40, 40], [96, 120], [150, 60], [212, 300], [268, 30], [318, 250], [364, 340], [420, 160], [452, 320], [520, 220], [566, 300], [586, 36], [30, 210], [204, 110], [352, 182], [560, 10], [12, 350], [470, 18]];
const R = 52;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** "Your career constellation": the profile's facts as stars, with one clear next action. */
export function CareerConstellation({ sky, action }: { sky: Sky; action: JourneyAction }) {
  const { stars, checked, pending, stated, percent } = sky;
  const lit = stars.filter(star => star.state !== "empty");
  const path = lit.map((star, index) => `${index ? "L" : "M"}${star.x} ${star.y}`).join(" ");
  const tail = stars.length > lit.length && lit.length ? stars.slice(lit.length - 1).map((star, index) => `${index ? "L" : "M"}${star.x} ${star.y}`).join(" ") : "";
  const total = checked + pending + stated;
  return <section className="constellation" aria-labelledby="constellation-title">
    <div className="constellation-copy">
      <p className="constellation-eyebrow"><span className="live-dot" /> YOUR CAREER CONSTELLATION</p>
      <h2 id="constellation-title">Every proof<br />lights a <em>star.</em></h2>
      <p>{total ? `${checked} of ${total} facts in your profile ${checked === 1 ? "is" : "are"} checked${pending ? `, ${pending} waiting for a reviewer` : ""}. Prove the rest to light up your sky.` : "Add your education, work, skills and languages: each one becomes a star, and proof makes it shine."}</p>
      <div className="constellation-actions">
        <Link href={action.href} className="button primary">{action.label} <span aria-hidden="true">→</span></Link>
        <Link href="/account/verification" className="text-button">See all your proof</Link>
      </div>
      <ul className="constellation-legend" aria-label="Legend">
        <li data-state="checked"><span aria-hidden="true" />Checked <b>{checked}</b></li>
        <li data-state="pending"><span aria-hidden="true" />In review <b>{pending}</b></li>
        <li data-state="stated"><span aria-hidden="true" />Stated only <b>{stated}</b></li>
      </ul>
    </div>
    <div className="constellation-sky" role="img" aria-label={`Constellation of your profile: ${checked} checked, ${pending} in review and ${stated} stated facts. Profile strength ${percent}%.`}>
      <svg viewBox="0 0 600 380" aria-hidden="true">
        <defs>
          <radialGradient id="cs-glow"><stop offset="0" stopColor="#d9f5a8" stopOpacity=".9" /><stop offset=".35" stopColor="#9fd35d" stopOpacity=".35" /><stop offset="1" stopColor="#9fd35d" stopOpacity="0" /></radialGradient>
          <radialGradient id="cs-amber"><stop offset="0" stopColor="#f6dc94" stopOpacity=".9" /><stop offset="1" stopColor="#f0d48a" stopOpacity="0" /></radialGradient>
        </defs>
        {DUST.map(([x, y], index) => <circle key={index} className="cs-dust" cx={x} cy={y} r={index % 3 ? 1.1 : 1.7} style={{ animationDelay: `${(index * 0.37) % 4}s` }} />)}
        {path && <path className="cs-line" d={path} pathLength={1} />}
        {tail && <path className="cs-line cs-line-empty" d={tail} />}
        {stars.map((star, index) => <g key={index} className={`cs-star cs-${star.state}`} style={{ animationDelay: `${0.25 + index * 0.12}s` }}>
          <title>{star.label}</title>
          {star.state === "checked" && <circle className="cs-halo" cx={star.x} cy={star.y} r={22} fill="url(#cs-glow)" style={{ animationDelay: `${index * 0.4}s` }} />}
          {star.state === "pending" && <circle className="cs-halo" cx={star.x} cy={star.y} r={18} fill="url(#cs-amber)" style={{ animationDelay: `${index * 0.4}s` }} />}
          <circle className="cs-core" cx={star.x} cy={star.y} r={star.state === "checked" ? 6 : star.state === "pending" ? 5 : 4} />
          {star.state === "empty" && <path className="cs-plus" d={`M${star.x - 3} ${star.y}h6M${star.x} ${star.y - 3}v6`} />}
          {star.short && <text className="cs-label" x={star.x + (star.x > 470 ? -12 : 12)} y={star.y + 4} textAnchor={star.x > 470 ? "end" : "start"}>{star.short}</text>}
        </g>)}
      </svg>
      <div className="constellation-ring">
        <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r={R} className="track" /><circle cx="60" cy="60" r={R} className="value" style={{ strokeDasharray: CIRCUMFERENCE, strokeDashoffset: CIRCUMFERENCE * (1 - percent / 100) }} /></svg>
        <span><strong>{percent}%</strong><small>profile strength</small></span>
      </div>
    </div>
  </section>;
}
