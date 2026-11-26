// Small, true-to-life previews of each CareerForge tool for the homepage slider. They are pictures made
// of HTML (no screenshots to go stale), filled with one fictional example person, Karim Nassar, and
// labelled "Example" so nobody mistakes them for real data. Decorative: hidden from screen readers,
// because each slide's text already says what the tool does.
import type { CSSProperties, ReactNode } from "react";
import { AiGlobe } from "./ai-globe";

function Frame({ label, children, tone }: { label: string; children: ReactNode; tone?: "site" }) {
  return <div className={`demo-window${tone === "site" ? " demo-window-site" : ""}`} aria-hidden="true">
    <div className="demo-chrome"><span /><span /><span /><b>{label}</b><em>Example</em></div>
    <div className="demo-body">{children}</div>
  </div>;
}

export function DemoProfile() {
  return <Frame label="careerforge · My profile">
    <div className="d-profile">
      <div className="d-id"><span className="d-avatar">KN</span><div><strong>Karim Nassar</strong><small>Junior Full-Stack Developer · Beirut</small></div>
        <span className="d-ring" style={{ "--p": 86 } as CSSProperties}><b>86%</b></span></div>
      <ul className="d-facts">
        <li data-state="ok"><i>✓</i><span><b>BS Computer Science</b><small>Diploma checked by a reviewer</small></span></li>
        <li data-state="ok"><i>✓</i><span><b>English · C1</b><small>IELTS 7.5, report checked</small></span></li>
        <li data-state="ok"><i>✓</i><span><b>React</b><small>Passed a CareerForge skill check</small></span></li>
        <li data-state="wait"><i>…</i><span><b>Intern, Cedar Apps</b><small>Letter waiting for review</small></span></li>
      </ul>
    </div>
  </Frame>;
}

export function DemoChecks() {
  return <Frame label="careerforge · Skill check · React">
    <div className="d-quiz">
      <div className="d-quiz-top"><span>Question 3 of 5</span><span className="d-timer">0:42</span></div>
      <div className="d-progress"><i style={{ width: "60%" }} /></div>
      <p className="d-question">Which hook runs code after the component renders?</p>
      <ul className="d-options">
        <li>useMemo</li><li data-picked>useEffect<i>✓</i></li><li>useRef</li><li>useContext</li>
      </ul>
    </div>
  </Frame>;
}

export function DemoLearning() {
  const steps: [string, "done" | "now" | "next", string][] = [["HTML & CSS", "done", "Free course · 6 h"], ["JavaScript", "done", "Free course · 12 h"], ["React", "now", "Project: a job board"], ["Testing", "next", "Free course · 4 h"], ["Deploy", "next", "Project: ship it"]];
  return <Frame label="careerforge · Roadmap · Frontend Developer">
    <ol className="d-road">{steps.map(([name, state, hint]) => <li key={name} data-state={state}><i>{state === "done" ? "✓" : ""}</i><span><b>{name}</b><small>{hint}</small></span>{state === "now" && <em>In progress</em>}</li>)}</ol>
  </Frame>;
}

export function DemoWorkshops() {
  return <Frame label="careerforge · Certificate">
    <div className="d-cert">
      <p className="d-cert-kind">Certificate of completion</p>
      <p className="d-cert-name">Karim Nassar</p>
      <p className="d-cert-for">completed <b>Containers in practice</b> with a score of <b>88 / 100</b></p>
      <div className="d-cert-foot"><span className="d-qr" /><span><b>Anyone can check it</b><small>Scan the code or open the link</small></span><span className="d-seal">✓ Valid</span></div>
    </div>
  </Frame>;
}

export function DemoCv() {
  return <Frame label="careerforge · CV · A4">
    <div className="d-cv">
      <div className="d-cv-head"><b>Karim Nassar</b><small>Junior Full-Stack Developer · Beirut · karim@example.com</small></div>
      <p className="d-cv-h">Experience</p>
      <div className="d-cv-row"><b>Frontend Intern, Cedar Apps</b><small>2024 – 2025</small></div>
      <ul><li>Built React screens used by 3,000 shoppers</li><li>Wrote Node.js APIs with PostgreSQL</li></ul>
      <p className="d-cv-h">Skills</p>
      <p className="d-cv-skills">React ✓ · TypeScript · Node.js · SQL · Git · Docker</p>
    </div>
  </Frame>;
}

export function DemoJobs() {
  const jobs: [string, string, number, string][] = [["Junior React Developer", "Beirut · on site", 86, "Docker"], ["Frontend Engineer", "Remote · MENA", 74, "Testing"], ["Full-Stack Intern", "Beirut · hybrid", 68, "AWS"]];
  return <Frame label="careerforge · Jobs that fit">
    <ul className="d-jobs">{jobs.map(([title, where, fit, gap]) => <li key={title}>
      <span className="d-job-main"><b>{title}</b><small>{where}</small></span>
      <span className="d-fit"><b>{fit}%</b><span className="d-bar"><i style={{ width: `${fit}%` }} /></span><small>Missing: {gap}</small></span>
    </li>)}</ul>
  </Frame>;
}

export function DemoTracker() {
  const columns: [string, string[]][] = [["Saved", ["Frontend Engineer"]], ["Applied", ["Junior React Dev", "UI Developer"]], ["Interview", ["Full-Stack Intern"]], ["Offer", []]];
  return <Frame label="careerforge · Applications">
    <div className="d-board">{columns.map(([name, cards], index) => <div key={name} className="d-col" style={{ "--i": index } as CSSProperties}>
      <p>{name}<span>{cards.length}</span></p>
      {cards.map(card => <span key={card} className="d-card">{card}</span>)}
      {!cards.length && <span className="d-card d-card-empty">Next one</span>}
    </div>)}</div>
  </Frame>;
}

export function DemoAssistant() {
  return <Frame label="careerforge · AI assistant">
    <div className="d-chat">
      <p className="d-msg d-msg-user">What should I learn next?</p>
      <div className="d-msg d-msg-ai"><span className="d-globe"><AiGlobe size={26} /></span>
        <div><p>Docker. It is missing in <b>3 of your saved jobs</b>.</p><ol><li>Take the free Docker course</li><li>Containerise Souk Finder</li><li>Prove it with a skill check</li></ol></div>
      </div>
    </div>
  </Frame>;
}

export function DemoPortfolio() {
  return <Frame label="careerforge.app/u/karim-nassar" tone="site">
    <div className="d-site">
      <nav><span className="on">About</span><span>Experience</span><span>Projects</span><span>Contact</span></nav>
      <p className="d-site-kicker">CS Graduate</p>
      <p className="d-site-name">Karim<br />Nassar</p>
      <p className="d-site-lede">I build web apps with React and Node.js, and I like clean APIs.</p>
      <div className="d-site-actions"><span>Get in touch</span><span>Download CV</span></div>
      <span className="d-site-photo">KN</span>
    </div>
  </Frame>;
}
