import Link from "next/link";
import { formatPeriod, languageLine, methodText, type ConfirmedFacts } from "@/lib/trust-page";
import { kindLabel } from "@/lib/certified-workshops";

function Fact({ title, detail, method, href }: { title: string; detail?: string; method: string; href?: string }) {
  return <li className="trust-fact">
    <span className="trust-tick" aria-hidden="true">✓</span>
    <div>
      <strong>{title}</strong>
      {detail && <span>{detail}</span>}
      <small>{method}{href && <> · <Link href={href}>Check certificate</Link></>}</small>
    </div>
  </li>;
}

/** The confirmed facts, grouped; used by the public page and the owner's preview. */
export function TrustFacts({ facts, headingLevel = 2 }: { facts: ConfirmedFacts; headingLevel?: 2 | 3 }) {
  const H = `h${headingLevel}` as "h2" | "h3";
  const groups = [
    facts.education.length > 0 && <section key="education" aria-label="Education"><H>Education</H><ul>
      {facts.education.map((item, index) => <Fact key={index} title={item.title} detail={[item.organisation, formatPeriod(item)].filter(Boolean).join(" · ")} method={methodText("reviewed", item.checkedAt, "diploma or certificate")} />)}
    </ul></section>,
    facts.experience.length > 0 && <section key="experience" aria-label="Work experience"><H>Work experience</H><ul>
      {facts.experience.map((item, index) => <Fact key={index} title={item.title} detail={[item.organisation, formatPeriod(item)].filter(Boolean).join(" · ")} method={methodText("reviewed", item.checkedAt, "work letter or contract")} />)}
    </ul></section>,
    facts.languages.length > 0 && <section key="languages" aria-label="Languages"><H>Languages</H><ul>
      {facts.languages.map((item, index) => <Fact key={index} title={item.language} detail={languageLine(item)} method={methodText("reviewed", item.checkedAt, item.test ? "score report" : "certificate")} />)}
    </ul></section>,
    facts.skills.length > 0 && <section key="skills" aria-label="Skills"><H>Skills</H><ul>
      {facts.skills.map((item, index) => <Fact key={index} title={item.skill} method={methodText(item.method, item.checkedAt, "course certificate")} />)}
    </ul></section>,
    facts.certificates.length > 0 && <section key="certificates" aria-label="CareerForge certificates"><H>CareerForge certificates</H><ul>
      {facts.certificates.map(item => <Fact key={item.id} title={item.title} detail={`${kindLabel[item.kind]} · ${item.scope}`} method={methodText("issued", item.checkedAt)} href={`/certificates/${item.id}`} />)}
    </ul></section>,
    facts.projects.length > 0 && <section key="projects" aria-label="Projects"><H>Projects</H><ul>
      {facts.projects.map((item, index) => <Fact key={index} title={item.repository} detail="GitHub repository" method={methodText("interview", item.checkedAt)} />)}
    </ul></section>
  ].filter(Boolean);
  return groups.length ? <div className="trust-facts">{groups}</div>
    : <p className="trust-empty">Nothing has been checked yet. Facts appear here once CareerForge reviews their proof or they pass a CareerForge check.</p>;
}

export function TrustMeaning() {
  return <dl className="trust-meaning">
    <div><dt>Proof reviewed</dt><dd>A CareerForge reviewer checked the person&apos;s document (diploma, work letter, score report or certificate) against the fact and compared it with proof sent from other accounts. It is not a confirmation from the issuer.</dd></div>
    <div><dt>Timed skill check</dt><dd>The person passed a timed CareerForge test on this skill. It shows working knowledge, not mastery.</dd></div>
    <div><dt>CareerForge certificate</dt><dd>Issued by CareerForge after a workshop run by an approved trainer, from the recorded attendance (and assessment, when stated). Not an accredited qualification.</dd></div>
    <div><dt>Project interview</dt><dd>The person answered timed questions about the code in their own repository, reviewed by CareerForge.</dd></div>
    <div><dt>Not shown</dt><dd>Anything the person only stated, and anything edited after it was checked.</dd></div>
  </dl>;
}
