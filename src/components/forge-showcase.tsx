/**
 * "The Forge": the homepage showcase. A CV, a diploma, a skill check and a certificate fly one by
 * one into a profile card; each arrival throws sparks, stamps a checked badge and fills the
 * strength ring. CSS only (no script); with reduced motion or the motion switch off it shows the
 * finished card. Sample data, labelled as such.
 */
const QR = "M0 0h7v7H0zM2 2v3h3V2zM14 0h7v7h-7zM16 2v3h3V2zM0 14h7v7H0zM2 16v3h3v-3zM9 0h2v2H9zM9 4h3v2H9zM8 8h2v2H8zM12 8h3v2h-3zM9 11h2v3H9zM13 12h2v2h-2zM16 9h3v2h-3zM17 13h2v3h-2zM12 16h3v2h-3zM9 17h2v4H9zM14 19h3v2h-3zM19 18h2v3h-2z";
const badges = ["Profile built from CV", "Degree reviewed", "SQL verified", "Certificate issued"];
const points = [
  { title: "Your CV fills your profile", text: "Upload it and review every line before it is saved." },
  { title: "Diplomas get reviewed", text: "Copied or edited proof from another account is caught." },
  { title: "Skills get verified", text: "Short timed checks turn a claim into a badge." },
  { title: "Workshops end with certificates", text: "Each one has a QR code anyone can check." }
];

export function ForgeShowcase() {
  return <section className="lp-section lp-forge" id="forge" aria-labelledby="forge-title">
    <div className="lp-forge-grid">
      <div className="lp-forge-copy lp-reveal">
        <p className="eyebrow">THE FORGE</p>
        <h2 id="forge-title">Bring your documents.<br /><span className="lp-gradient">Leave with proof.</span></h2>
        <p>CareerForge turns what you have (a CV, a diploma, the skills you practised) into a profile employers can check.</p>
        <ol className="lp-forge-points">
          {points.map((point, index) => <li key={point.title}><span aria-hidden="true">{index + 1}</span><div><strong>{point.title}</strong><small>{point.text}</small></div></li>)}
        </ol>
      </div>
      <div className="lp-forge-stage-wrap lp-reveal" role="img" aria-label="Animation: a CV, a diploma, a skill check and a certificate fly into a sample profile card, which receives four checked badges.">
        <div className="lp-forge-stage" aria-hidden="true">
          <svg className="lp-forge-lines" viewBox="0 0 560 520"><path d="M20 420 C 160 300, 260 470, 400 330 S 520 160, 560 220" /><path d="M0 120 C 140 190, 240 40, 380 130 S 520 330, 560 280" /></svg>
          <div className="lp-forge-card">
            <div className="lp-forge-who">
              <svg viewBox="0 0 70 70" className="lp-forge-ring"><circle cx="35" cy="35" r="29" className="track" /><circle cx="35" cy="35" r="29" className="value" /><text x="35" y="40" textAnchor="middle">RH</text></svg>
              <span><b>Rana Haddad</b><small>Checked profile · sample</small></span>
            </div>
            {badges.map((badge, index) => <span key={badge} className={`lp-forge-badge b${index + 1}`}>✓ {badge}</span>)}
          </div>
          <div className="lp-forge-sparks">{Array.from({ length: 10 }, (_, index) => <span key={index} style={{ transform: `rotate(${index * 36}deg)` }}><i className={index % 3 ? "" : "gold"} /></span>)}</div>
          <div className="lp-forge-piece p1"><div className="lp-forge-paper"><em>CV.PDF</em><i /><i className="short" /><i /></div></div>
          <div className="lp-forge-piece p2"><div className="lp-forge-paper diploma"><b>Diploma</b><small>B.E. Computer Engineering</small><em>Rana Haddad</em></div></div>
          <div className="lp-forge-piece p3"><div className="lp-forge-paper check"><em>SKILL CHECK · SQL</em><b>5 / 5</b><small>Passed in time</small></div></div>
          <div className="lp-forge-piece p4"><div className="lp-forge-paper cert"><svg viewBox="0 0 21 21" shapeRendering="crispEdges"><path d={QR} /></svg><span><em>CERTIFICATE</em><b>Docker in a Day</b></span></div></div>
        </div>
      </div>
    </div>
  </section>;
}
