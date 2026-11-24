import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { LandingNav } from "./landing-nav";
import { Spotlight } from "./spotlight";
import { ForgeShowcase } from "./forge-showcase";

const glyphs = {
  profile: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-3a8 6 0 0 1 16 0v3",
  checks: "M12 3l8 4v5c0 5-8 9-8 9s-8-4-8-9V7z M8 12l3 3 5-6",
  jobs: "M3 7h18v14H3z M8 7V3h8v4 M3 12h18 M10 12v3h4v-3",
  compass: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M15.5 8.5l-2 5-5 2 2-5z"
} as const;

function Glyph({ name }: { name: keyof typeof glyphs }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={glyphs[name]} /></svg>;
}

const vars = (values: Record<string, string>) => values as unknown as CSSProperties;

const marqueeItems = ["Verified profile", "Skill checks", "Document check", "CV vs job match", "Career paths", "Workshop certificates", "AI career assistant", "Live jobs", "Learning roadmaps"];

const steps = [
  { n: "01", icon: "profile", title: "Build your profile", text: "Education, work, skills and languages in one private account. A CV can fill it in for you." },
  { n: "02", icon: "checks", title: "Prove it", text: "Send proof, pass timed skill checks and earn workshop certificates. Each fact gets a badge." },
  { n: "03", icon: "compass", title: "Choose a direction", text: "See which careers fit you, what you already have and the free path to the rest." },
  { n: "04", icon: "jobs", title: "Apply with proof", text: "Match live jobs, fix the gaps, and share a checked-profile link employers can trust." }
] as const;

const principles = [
  { n: "01", title: "Private by default", text: "Your profile lives in an owner-only account. Nothing is shared unless you choose to share it." },
  { n: "02", title: "Evidence before claims", text: "A skill reaches your CV after you complete a supported check, and learning steps say plainly what they cannot prove." },
  { n: "03", title: "Honest about every badge", text: "Each badge says how it was checked. AI only suggests and never decides; demo roles are labelled; CareerForge never applies for you." }
];

function SkillRow({ label, state, width, delay, pending = false }: { label: string; state: string; width: string; delay: string; pending?: boolean }) {
  return <div className={`lp-skill ${pending ? "is-pending" : "is-done"}`}>
    <div className="lp-skill-top"><span>{label}</span><span>{state}</span></div>
    <div className="lp-bar"><i style={vars({ "--w": width, "--d": delay })} /></div>
  </div>;
}

function HeroMock() {
  return <div className="lp-mock" role="img" aria-label="Illustration of a sample CareerForge profile: three of four skill checks complete, a CV preview and an interview status on a demo role.">
    <div className="lp-mock-glow" aria-hidden="true" />
    <div className="lp-card lp-card-main" aria-hidden="true">
      <div className="lp-card-bar"><span className="lp-dots"><i /><i /><i /></span><span>sample profile / illustration</span></div>
      <div className="lp-card-body">
        <div className="lp-identity">
          <span className="lp-avatar">AM</span>
          <div><strong>Alex Morgan</strong><small>Junior front-end developer</small></div>
          <div className="lp-ring">
            <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" className="lp-ring-track" /><circle cx="32" cy="32" r="26" className="lp-ring-value" /></svg>
            <span>3/4</span>
          </div>
        </div>
        <div className="lp-skills">
          <SkillRow label="HTML &amp; CSS" state="Checked" width="100%" delay=".5s" />
          <SkillRow label="JavaScript" state="Checked" width="100%" delay=".7s" />
          <SkillRow label="Git basics" state="Checked" width="100%" delay=".9s" />
          <SkillRow label="SQL basics" state="Up next" width="38%" delay="1.1s" pending />
        </div>
      </div>
    </div>
    <div className="lp-float lp-float-cv" aria-hidden="true"><b>Alex Morgan</b><i /><i /><i className="short" /><i /><i className="short" /></div>
    <div className="lp-float lp-float-status" aria-hidden="true"><span className="status-dot status-interview" /><div><strong>Interview</strong><small>Demo role · Junior Web Developer</small></div></div>
  </div>;
}

function VizProfile() {
  return <div className="viz viz-profile" aria-hidden="true">
    <div className="viz-row"><span className="lp-avatar sm">CF</span><div className="viz-lines"><i /><i className="short" /></div></div>
    <div className="tag-row"><span className="tag skill-have">Education</span><span className="tag skill-have">Projects</span><span className="tag skill-have">Skills</span><span className="tag">Summary</span></div>
  </div>;
}
function VizChecks() {
  return <div className="viz viz-checks" aria-hidden="true">
    <SkillRow label="Fundamentals" state="Checked" width="100%" delay="0s" />
    <SkillRow label="Next check" state="In progress" width="55%" delay=".3s" pending />
  </div>;
}
function VizCv() {
  return <div className="viz viz-cv" aria-hidden="true"><div className="viz-paper"><b /><i /><i className="short" /><i /><i /><i className="short" /></div></div>;
}
function VizRoles() {
  return <div className="viz viz-roles" aria-hidden="true">
    <div className="viz-lines"><i /><i className="short" /></div>
    <div className="tag-row"><span className="tag skill-have">#html</span><span className="tag skill-have">#css</span><span className="tag skill-missing">#sql</span></div>
    <div className="skill-match-track"><span style={{ width: "72%" }} /></div>
  </div>;
}
function VizTracker() {
  return <div className="viz viz-tracker" aria-hidden="true">{["Saved", "Applied", "Interview", "Offer"].map((label, index) => <span key={label} style={vars({ "--i": String(index) })}>{label}</span>)}</div>;
}
function VizLearning() {
  return <div className="viz viz-learning" aria-hidden="true">
    {["Read the source", "Try the exercise", "Check what it shows"].map((label, index) => <div key={label} className="viz-step"><span>{index + 1}</span><b>{label}</b></div>)}
  </div>;
}
function VizAssistant() {
  return <div className="viz viz-assistant" aria-hidden="true">
    <div className="viz-bubble user">What should I learn next?</div>
    <div className="viz-bubble ai"><span className="viz-orb" />Docker: it is the gap in 3 of your saved jobs.</div>
  </div>;
}
function VizPortfolio() {
  return <div className="viz viz-portfolio" aria-hidden="true">
    {[{ label: "Headline", on: true }, { label: "Projects", on: true }, { label: "Contact details", on: false }].map(({ label, on }) => <div key={label} className="viz-toggle"><b>{label}</b><span className={on ? "viz-switch on" : "viz-switch"} /></div>)}
  </div>;
}

const tiles: { id: string; cls: string; title: string; text: string; viz: ReactNode }[] = [
  { id: "profile", cls: "lp-tile-wide", title: "A profile that stays yours", text: "Education, projects and skills in one private, owner-only account.", viz: <VizProfile /> },
  { id: "checks", cls: "lp-tile-narrow", title: "Skills with evidence", text: "Timed checks for any skill, prepared and approved by reviewers.", viz: <VizChecks /> },
  { id: "cv", cls: "", title: "CV preview", text: "A clean, print-ready sheet generated from your profile.", viz: <VizCv /> },
  { id: "roles", cls: "", title: "Jobs that fit", text: "Live openings in Lebanon, the region and remote, ranked by how your skills match.", viz: <VizRoles /> },
  { id: "tracker", cls: "", title: "Application tracker", text: "Follow each application from saved through to an offer.", viz: <VizTracker /> },
  { id: "learning", cls: "", title: "Free learning roadmaps", text: "Step-by-step paths with free courses and projects, and honest limits on what they prove.", viz: <VizLearning /> },
  { id: "assistant", cls: "", title: "An AI that knows your profile", text: "Ask about careers, skills or your CV. It only sees what you choose to share.", viz: <VizAssistant /> },
  { id: "portfolio", cls: "", title: "Shared only by choice", text: "Publish a snapshot of the fields you select, and only after you consent.", viz: <VizPortfolio /> }
];

export function PublicHome() {
  return <div className="public-home lp">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <LandingNav />

    <main id="main-content" tabIndex={-1}>
      <section className="lp-hero" aria-labelledby="hero-title">
        <div className="lp-hero-copy">
          <p className="lp-pill"><span className="live-dot" />Your potential. With evidence.</p>
          <h1 id="hero-title">Build a career you can <span className="lp-gradient">stand behind.</span></h1>
          <p className="lp-lede">Your profile, skill checks, CV and opportunities. One focused workspace for your next chapter.</p>
          <div className="lp-actions">
            <Link href="/register" className="button primary">Start your journey <span aria-hidden="true">&#8599;</span></Link>
            <Link href="/dashboard" className="button lp-ghost">Sign in to your workspace</Link>
          </div>
          <ul className="lp-proof"><li>Private by default</li><li>Evidence before claims</li><li>Demo roles, clearly labelled</li></ul>
        </div>
        <div className="lp-stage"><HeroMock /></div>
      </section>

      <div className="lp-marquee" aria-label="What is inside CareerForge">
        <div className="lp-marquee-track">
          <ul>{marqueeItems.map(item => <li key={item}>{item}</li>)}</ul>
          <ul aria-hidden="true">{marqueeItems.map(item => <li key={item}>{item}</li>)}</ul>
        </div>
      </div>

      <ForgeShowcase />

      <section className="lp-section" id="platform" aria-labelledby="platform-title">
        <div className="lp-section-head lp-reveal">
          <p className="eyebrow">FROM WHAT YOU KNOW TO WHAT COMES NEXT</p>
          <h2 id="platform-title">Your story, organized.</h2>
          <p>Four steps from a blank page to a profile employers can check.</p>
        </div>
        <Spotlight className="lp-steps">
          {steps.map(step => <article key={step.n} className="lp-step spot-card lp-reveal">
            <p className="lp-step-num">{step.n}</p>
            <span className="lp-step-icon"><Glyph name={step.icon} /></span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </article>)}
        </Spotlight>
      </section>

      <section className="lp-section" id="features" aria-labelledby="features-title">
        <div className="lp-section-head lp-reveal">
          <p className="eyebrow">EVERYTHING IN ONE PLACE</p>
          <h2 id="features-title">One workspace. Every next step.</h2>
          <p>Each part of CareerForge feeds the next, so your CV, your roles and your applications always agree with your profile.</p>
        </div>
        <Spotlight className="lp-bento">
          {tiles.map(tile => <article key={tile.id} className={`lp-tile spot-card lp-reveal ${tile.cls}`}>
            <div className="lp-viz">{tile.viz}</div>
            <div><h3>{tile.title}</h3><p>{tile.text}</p></div>
          </article>)}
        </Spotlight>
        <p className="lp-more lp-reveal"><Link href="/features" className="text-button">Browse every feature <span aria-hidden="true">&#8599;</span></Link></p>
      </section>

      <section className="lp-section" id="principles" aria-labelledby="principles-title">
        <div className="lp-principles">
          <div className="lp-principles-head lp-reveal">
            <p className="eyebrow">HOW WE BUILD IT</p>
            <h2 id="principles-title">Claims are easy.<br /><span className="lp-gradient">Evidence is better.</span></h2>
          </div>
          <div className="lp-principles-list">
            {principles.map(item => <div key={item.n} className="lp-principle lp-reveal"><span>{item.n}</span><div><h3>{item.title}</h3><p>{item.text}</p></div></div>)}
          </div>
        </div>
      </section>

      <section className="lp-cta" aria-labelledby="cta-title">
        <div className="lp-cta-panel lp-reveal">
          <p className="eyebrow">YOUR NEXT CHAPTER</p>
          <h2 id="cta-title">Ready to make it yours?</h2>
          <p>Create a private account and start with your profile. It takes a few minutes.</p>
          <div className="lp-actions"><Link className="button primary" href="/register">Create your account <span aria-hidden="true">&#8599;</span></Link><Link className="button lp-ghost" href="/login">Sign in</Link></div>
          <p className="lp-caption">Free for students. Demo roles are labelled, AI answers are suggestions, and CareerForge never applies for you.</p>
        </div>
      </section>
    </main>

    <footer className="lp-footer"><span>CareerForge · Built for your next chapter.</span><span className="lp-footer-links"><Link href="/features">All features</Link><Link href="/login">Sign in</Link></span></footer>
  </div>;
}
