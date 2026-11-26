// What CareerForge actually gives you, as floating documents for the homepage slider: a checked profile
// page, a Verified skill, a roadmap in progress, a certificate, an A4 CV, matched jobs, an application
// board, a saved AI answer, and a published portfolio website (in the builder's own design). Each scene
// is one main document and a few small pieces floating around it. One fictional person (Karim Nassar),
// labelled "Example". Decorative: hidden from screen readers, since each slide's text says what it is.
import type { CSSProperties, ReactNode } from "react";
import { AiClover } from "./ai-clover";

const at = (seconds: number) => ({ "--d": `${seconds}s` }) as CSSProperties;
const QR = "M0 0h7v7H0zM2 2v3h3V2zM14 0h7v7h-7zM16 2v3h3V2zM0 14h7v7H0zM2 16v3h3v-3zM9 0h2v2H9zM9 4h3v2H9zM8 8h2v2H8zM12 8h3v2h-3zM9 11h2v3H9zM13 12h2v2h-2zM16 9h3v2h-3zM17 13h2v3h-2zM12 16h3v2h-3zM9 17h2v4H9zM14 19h3v2h-3zM19 18h2v3h-2z";

function Scene({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <div className={`r-scene${wide ? " r-wide" : ""}`} aria-hidden="true">{children}</div>;
}
function Chrome({ address, site = false }: { address: string; site?: boolean }) {
  return <div className={`r-chrome${site ? " r-chrome-site" : ""}`}><span /><span /><span /><b>{address}</b><em>Example</em></div>;
}

export function DemoProfile() {
  return <Scene>
    <div className="r-main r-sheet">
      <Chrome address="careerforge.app/v/karim-nassar" />
      <div className="r-pad">
        <div className="r-person"><span className="r-avatar">KN</span><div><b>Karim Nassar</b><small>Junior Full-Stack Developer · Beirut</small></div></div>
        <p className="r-kicker">Facts CareerForge checked</p>
        <ul className="r-facts">
          {[["BS Computer Science", "Diploma reviewed · Jun 2025"], ["English · C1", "IELTS 7.5 report checked"], ["React", "Passed a skill check"], ["Containers in practice", "Certificate · 88 / 100"]].map(([what, how], i) =>
            <li key={what} style={at(0.25 + i * 0.12)}><i>✓</i><span><b>{what}</b><small>{how}</small></span></li>)}
        </ul>
      </div>
    </div>
    <span className="r-sat r-pill r-sat-a" style={at(0.8)}><i className="r-live" />4 facts checked</span>
  </Scene>;
}

export function DemoChecks() {
  return <Scene>
    <div className="r-back r-quiz-ghost"><p>Which join keeps every row from the left table?</p><span>LEFT JOIN</span><span>INNER JOIN</span><span>CROSS JOIN</span></div>
    <div className="r-main r-card r-verified">
      <svg className="r-medal" viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg>
      <b>SQL is now Verified</b>
      <small>5 of 5 correct · no time limit</small>
      <div className="r-dots">{[0, 1, 2, 3, 4].map(i => <i key={i} style={at(0.5 + i * 0.1)} />)}</div>
    </div>
    <span className="r-sat r-chip r-sat-a" style={at(0.9)}><i>✓</i>SQL</span>
    <span className="r-sat r-pill r-sat-b" style={at(1.1)}>Shows on your CV and portfolio</span>
  </Scene>;
}

export function DemoLearning() {
  const steps: [string, "done" | "now" | "next"][] = [["HTML & CSS", "done"], ["JavaScript", "done"], ["React", "now"], ["Testing", "next"], ["Deploy", "next"]];
  return <Scene>
    <div className="r-main r-card r-road">
      <p className="r-kicker">Roadmap · Frontend Developer</p>
      <div className="r-meter"><span style={{ width: "48%" }} /></div>
      <ol>{steps.map(([name, state], i) => <li key={name} data-state={state} style={at(0.2 + i * 0.1)}><i>{state === "done" ? "✓" : ""}</i><b>{name}</b>{state === "now" && <em>In progress</em>}</li>)}</ol>
    </div>
    <div className="r-sat r-note r-sat-a" style={at(0.9)}><small>Up next</small><b>React · free course, 6 h</b><span>Then build: a job board</span></div>
  </Scene>;
}

export function DemoWorkshops() {
  return <Scene>
    <div className="r-main r-paper r-cert">
      <p className="r-cert-kind">Certificate of completion</p>
      <p className="r-cert-name">Karim Nassar</p>
      <p className="r-cert-for">completed <b>Containers in practice</b> with a score of <b>88 / 100</b></p>
      <div className="r-cert-foot"><svg viewBox="0 0 21 21" shapeRendering="crispEdges"><path d={QR} /></svg><span><b>Anyone can check it</b><small>Scan the code or open the link</small></span></div>
    </div>
    <div className="r-sat r-phone r-sat-a" style={at(0.8)}><span className="r-phone-box" /><span className="r-phone-ok">✓ Valid</span></div>
  </Scene>;
}

export function DemoCv() {
  return <Scene>
    <div className="r-main r-paper r-cv">
      <div className="r-cv-head"><b>Karim Nassar</b><small>Junior Full-Stack Developer · Beirut · karim@example.com</small></div>
      <p className="r-cv-h">Experience</p>
      <div className="r-cv-row"><b>Frontend Intern, Cedar Apps</b><small>2024 – 2025</small></div>
      <ul><li>Built React screens used by 3,000 shoppers</li><li>Wrote Node.js APIs with PostgreSQL</li></ul>
      <p className="r-cv-h">Education</p>
      <div className="r-cv-row"><b>BS Computer Science</b><small>2025</small></div>
      <p className="r-cv-h">Skills</p>
      <p className="r-cv-skills">React ✓ · SQL ✓ · TypeScript · Node.js · Git · Docker</p>
    </div>
    <span className="r-sat r-pill r-sat-a" style={at(0.8)}>⤓ PDF ready</span>
    <span className="r-sat r-chip r-sat-b" style={at(1)}>ATS-safe style</span>
  </Scene>;
}

export function DemoJobs() {
  const jobs: [string, string, number, string][] = [["Junior React Developer", "Beirut · on site", 86, "Docker"], ["Frontend Engineer", "Remote · MENA", 74, "Testing"], ["Full-Stack Intern", "Beirut · hybrid", 68, "AWS"]];
  return <Scene>
    <div className="r-main r-stack">{jobs.map(([title, where, fit, gap], i) => <div key={title} className="r-job" style={at(0.2 + i * 0.14)}>
      <span className="r-fit" style={{ "--p": fit } as CSSProperties}><b>{fit}%</b></span>
      <span className="r-job-main"><b>{title}</b><small>{where}</small><em>Missing: {gap}</em></span>
    </div>)}</div>
    <span className="r-sat r-pill r-sat-a" style={at(0.9)}>Ranked by how you fit</span>
  </Scene>;
}

export function DemoTracker() {
  const columns: [string, string[]][] = [["Saved", ["Frontend Engineer"]], ["Applied", ["Junior React Dev", "UI Developer"]], ["Interview", ["Full-Stack Intern"]], ["Offer", []]];
  return <Scene>
    <div className="r-main r-card r-board">{columns.map(([name, cards], i) => <div key={name} className="r-col" style={at(0.15 + i * 0.1)}>
      <p>{name}<span>{cards.length}</span></p>
      {cards.map(card => <span key={card} className="r-task">{card}</span>)}
      {!cards.length && <span className="r-task r-task-empty">Next one</span>}
    </div>)}</div>
    <div className="r-sat r-toast r-sat-a" style={at(0.9)}><i>●</i><span><b>Interview booked</b><small>Full-Stack Intern · Thu 10:00</small></span></div>
  </Scene>;
}

export function DemoAssistant() {
  return <Scene>
    <div className="r-main r-card r-chat">
      <p className="r-msg-user" style={at(0.2)}>What should I learn next?</p>
      <div className="r-msg-ai" style={at(0.55)}><span className="r-globe"><AiClover size={20} live /></span>
        <div><p>Docker. It is missing in <b>3 of your saved jobs</b>.</p><ol><li>Take the free Docker course</li><li>Containerise Souk Finder</li><li>Prove it with a skill check</li></ol></div>
      </div>
    </div>
    <span className="r-sat r-pill r-sat-a" style={at(1)}>Saved to your account</span>
  </Scene>;
}

/** A published portfolio website in the builder's own design (dark indigo, the same in both themes). */
export function PortfolioSite({ first, last, initials, kicker, lede, skills, slug, className = "" }: { first: string; last: string; initials: string; kicker: string; lede: string; skills: string[]; slug: string; className?: string }) {
  return <div className={`r-site ${className}`}>
    <Chrome address={`careerforge.app/u/${slug}`} site />
    <div className="r-site-body">
      <nav><span className="on">About</span><span>Experience</span><span>Skills</span><span>Projects</span><span>Contact</span></nav>
      <div className="r-site-hero">
        <div>
          <p className="r-site-kicker">{kicker}</p>
          <p className="r-site-name">{first}<br />{last}</p>
          <p className="r-site-lede">{lede}</p>
          <div className="r-site-actions"><span>Get in touch</span><span>Download CV</span></div>
        </div>
        <span className="r-site-photo">{initials}</span>
      </div>
      <div className="r-site-skills">{skills.map(skill => <span key={skill}>{skill}</span>)}</div>
    </div>
  </div>;
}

export function DemoPortfolio() {
  return <Scene wide>
    <PortfolioSite className="r-main" first="Karim" last="Nassar" initials="KN" kicker="CS Graduate" slug="karim-nassar"
      lede="I build web apps with React and Node.js, and I like clean APIs and fast pages." skills={["React", "Node", "TypeScript", "Postgres"]} />
    <div className="r-sat r-site-phone r-sat-b" style={at(0.7)}>
      <span className="r-site-phone-notch" />
      <p className="r-site-kicker">CS Graduate</p><p className="r-site-name small">Karim<br />Nassar</p><span className="r-site-phone-btn">Get in touch</span>
    </div>
    <span className="r-sat r-pill r-sat-a" style={at(1)}><i className="r-live" />Live at /u/karim-nassar</span>
  </Scene>;
}
