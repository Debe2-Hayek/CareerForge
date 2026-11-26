"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { setRingPlaying, useRingMode } from "./workshops/hooks";

/**
 * "The Forge": how CareerForge turns documents into proof, as a small working bench. The four steps on
 * the left are buttons; each plays a short, realistic scene on the right (the CV is read, the diploma is
 * reviewed, a skill check is passed, a certificate is scanned) while a sample profile card collects its
 * badges and fills its ring. It moves on by itself only while visible and untouched, and never with the
 * motion switch off or reduced motion; every scene is drawn in its finished state, so nothing is hidden
 * when animations do not run. Sample data, labelled as such.
 */
const STEPS = [
  { title: "Your CV fills your profile", text: "Upload it; the AI suggests each line and you approve it.", badge: "Profile built from CV", says: "A CV is read and its details are added to the sample profile." },
  { title: "Diplomas get reviewed", text: "Checked by a reviewer and the AI; copies from other accounts are caught.", badge: "Degree reviewed", says: "A diploma is checked against the profile and stamped reviewed." },
  { title: "Skills get verified", text: "Pass a short skill check and the skill earns a ✓.", badge: "SQL verified", says: "An SQL skill check is passed with 5 out of 5." },
  { title: "Workshops end with certificates", text: "Each one has a QR code anyone can scan to check it.", badge: "Certificate issued", says: "A workshop certificate is scanned and shows as valid." }
] as const;
const DWELL = 5600;
const QR = "M0 0h7v7H0zM2 2v3h3V2zM14 0h7v7h-7zM16 2v3h3V2zM0 14h7v7H0zM2 16v3h3v-3zM9 0h2v2H9zM9 4h3v2H9zM8 8h2v2H8zM12 8h3v2h-3zM9 11h2v3H9zM13 12h2v2h-2zM16 9h3v2h-3zM17 13h2v3h-2zM12 16h3v2h-3zM9 17h2v4H9zM14 19h3v2h-3zM19 18h2v3h-2z";
const delay = (seconds: number) => ({ "--d": `${seconds}s` }) as CSSProperties;

function SceneCV() {
  return <div className="fw-scene fw-cv">
    <div className="fw-paper fw-doc">
      <p className="fw-file">CV.pdf</p>
      <b className="fw-line name" /><i className="fw-line w70" /><i className="fw-line w85" /><i className="fw-line w60" />
      <b className="fw-line head" /><i className="fw-line w80" /><i className="fw-line w50" />
      <span className="fw-beam" />
    </div>
    <div className="fw-found">
      <p>Found in the CV · you approve each one</p>
      {["Rana Haddad", "B.E. Computer Engineering", "SQL", "Docker"].map((item, i) => <span key={item} className="fw-chip" style={delay(0.9 + i * 0.35)}><i>✓</i>{item}</span>)}
    </div>
  </div>;
}
function SceneDegree() {
  return <div className="fw-scene fw-degree">
    <div className="fw-paper fw-diploma">
      <p className="fw-diploma-kind">Diploma</p>
      <p className="fw-diploma-what">B.E. Computer Engineering</p>
      <p className="fw-diploma-who">Rana Haddad</p>
      <span className="fw-stamp" style={delay(1.9)}>Reviewed</span>
    </div>
    <ul className="fw-checks">
      {["Name matches the profile", "University and degree found", "Not copied from another account"].map((item, i) => <li key={item} style={delay(0.4 + i * 0.45)}><i>✓</i>{item}</li>)}
    </ul>
  </div>;
}
function SceneSkill() {
  return <div className="fw-scene fw-skill">
    <div className="fw-quiz">
      <p className="fw-quiz-top"><span>Skill check · SQL</span><span>No time limit</span></p>
      <p className="fw-quiz-q">Which join keeps every row from the left table?</p>
      <span className="fw-opt picked" style={delay(0.7)}><b>A</b>LEFT JOIN<i>✓</i></span>
      <span className="fw-opt"><b>B</b>INNER JOIN</span>
      <span className="fw-opt"><b>C</b>CROSS JOIN</span>
      <div className="fw-dots">{[0, 1, 2, 3, 4].map(i => <i key={i} style={delay(0.9 + i * 0.22)} />)}</div>
    </div>
    <div className="fw-score" style={delay(2)}><b className="fw-count" /><span>/ 5 · Verified ✓</span></div>
  </div>;
}
function SceneCert() {
  return <div className="fw-scene fw-cert">
    <div className="fw-paper fw-certificate">
      <p className="fw-cert-kind">Certificate of completion</p>
      <p className="fw-cert-name">Rana Haddad</p>
      <p className="fw-cert-for">Docker in a Day · 88 / 100</p>
      <svg viewBox="0 0 21 21" shapeRendering="crispEdges" className="fw-qr"><path d={QR} /></svg>
    </div>
    <div className="fw-phone" style={delay(0.5)}><span className="fw-phone-scan" /><span className="fw-phone-ok" style={delay(1.7)}>✓ Valid</span></div>
  </div>;
}
const SCENES = [SceneCV, SceneDegree, SceneSkill, SceneCert];

export function ForgeShowcase() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [held, setHeld] = useState(false);
  const [touched, setTouched] = useState(false);
  const mode = useRingMode();
  const root = useRef<HTMLElement>(null);
  const resume = useRef<ReturnType<typeof setTimeout>>(undefined);
  const playing = mode === "playing" && visible && !held && !touched;

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.4 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => setStep(current => (current + 1) % STEPS.length), DWELL);
    return () => clearTimeout(timer);
  }, [playing, step]);
  useEffect(() => () => clearTimeout(resume.current), []);

  function choose(index: number) {
    setStep(index); setTouched(true);
    clearTimeout(resume.current);
    resume.current = setTimeout(() => setTouched(false), 15000);
  }
  const Scene = SCENES[step];
  const strength = (step + 1) * 25;

  return <section ref={root} className="lp-section lp-forge" id="forge" aria-labelledby="forge-title"
    onPointerEnter={event => { if (event.pointerType === "mouse") setHeld(true); }} onPointerLeave={() => setHeld(false)}>
    <div className="lp-forge-grid">
      <div className="lp-forge-copy lp-reveal">
        <p className="eyebrow">THE FORGE</p>
        <h2 id="forge-title">Bring your documents.<br /><span className="lp-gradient">Leave with proof.</span></h2>
        <p>CareerForge turns what you have (a CV, a diploma, the skills you practised) into a profile employers can check.</p>
        <div className="fw-steps" role="tablist" aria-label="How a profile becomes proof">
          {STEPS.map((item, index) => <button key={item.title} type="button" role="tab" id={`forge-tab-${index}`} aria-selected={index === step} aria-controls="forge-bench"
            className="fw-step" data-done={index < step || undefined} onClick={() => choose(index)}>
            <span className="fw-step-n" aria-hidden="true">{index < step ? "✓" : index + 1}</span>
            <span className="fw-step-copy"><strong>{item.title}</strong><small>{item.text}</small></span>
            {index === step && mode !== "still" && <i key={`${step}-${playing}`} className="fw-step-bar" data-running={playing || undefined} style={{ animationDuration: `${DWELL}ms` }} />}
          </button>)}
        </div>
        {mode !== "still" && <button type="button" className="fw-play" onClick={() => setRingPlaying(mode !== "playing")}>{mode === "playing" ? "Pause the walkthrough" : "Play the walkthrough"}</button>}
      </div>

      <div className="fw-bench lp-reveal" id="forge-bench" role="tabpanel" aria-labelledby={`forge-tab-${step}`}>
        <p className="sr-only" aria-live="polite">{touched ? STEPS[step].says : ""}</p>
        <div className="fw-stage" aria-hidden="true">
          <div className="fw-scene-wrap"><Scene key={step} /></div>
          <div className="fw-profile">
            <p className="fw-sample">Sample profile</p>
            <div className="fw-who">
              <span className="fw-ring" style={{ "--p": strength } as CSSProperties}><b>RH</b></span>
              <span><b>Rana Haddad</b><small>Computer engineer · Beirut</small></span>
            </div>
            <div className="fw-meter"><span style={{ width: `${strength}%` }} /><small>{strength}% checked</small></div>
            <ul className="fw-badges">{STEPS.map((item, index) => <li key={item.badge} data-on={index <= step || undefined} data-new={index === step || undefined}><i>✓</i>{item.badge}</li>)}</ul>
          </div>
        </div>
      </div>
    </div>
  </section>;
}
