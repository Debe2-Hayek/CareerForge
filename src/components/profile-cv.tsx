import type { AccountProfile } from "@/lib/account/schemas";
import type { ProfileHistory } from "@/lib/profile-history";
import type { ClaimItem } from "@/lib/claims/model";
import { formatHistoryGpa, formatHistoryPeriod } from "@/lib/profile-history-format";

const emptyHistory: ProfileHistory = { education: [], experience: [] };
const reviewedNote = "Entries marked ✓ had their proof reviewed by CareerForge; the others are self-reported.";

/**
 * The printable CV from the saved profile. Trust is shown honestly: an entry is marked ✓ only
 * while CareerForge's review of its proof still applies (claims); everything else is labelled
 * self-reported. When the owner shares a checked-profile link, it is printed at the end so an
 * employer can confirm the ✓ entries.
 */
export function ProfileCV({ profile, passedSkills = [], history = emptyHistory, claims = [], trustUrl = null }: {
  profile: AccountProfile; passedSkills?: string[]; history?: ProfileHistory; claims?: ClaimItem[]; trustUrl?: string | null;
}) {
  const skills = profile.skills.filter(skill => passedSkills.includes(skill));
  const summaries = [["Education summary", profile.education], ["Featured project summary", profile.project]];
  const reviewed = new Set(claims.filter(item => item.status === "reviewed").map(item => item.key));
  const languages = claims.filter(item => item.kind === "language");
  const check = (key: string) => reviewed.has(key) ? <p className="cv-check"><span aria-hidden="true">✓ </span>Proof reviewed by CareerForge</p> : null;
  const note = (keys: string[]) => keys.some(key => reviewed.has(key)) ? reviewedNote : "Self-reported; not independently verified.";
  return <article className="cv-sheet" aria-label="CV preview">
    <header><h2>{profile.name}</h2>{profile.headline && <p className="cv-headline">{profile.headline}</p>}{profile.location && <p className="cv-location">{profile.location}</p>}</header>
    {profile.bio.trim() && <section><h3>Profile</h3><p>{profile.bio}</p></section>}
    {history.experience.length > 0 && <section className="cv-history-section">
      <h3>Work experience</h3><p className="cv-history-note">{note(history.experience.map(record => `employment:${record.id}`))}</p>
      {history.experience.map(record => <div className="cv-history-entry" key={record.id}>
        <h4>{record.role}</h4><p>{record.company}</p><p className="cv-history-period">{formatHistoryPeriod(record)}</p>
        {record.description.trim() && <p className="cv-history-description">{record.description}</p>}
        {check(`employment:${record.id}`)}
      </div>)}
    </section>}
    {history.education.length > 0 && <section className="cv-history-section">
      <h3>Education history</h3><p className="cv-history-note">{note(history.education.map(record => `degree:${record.id}`))}</p>
      {history.education.map(record => {
        const gpa = formatHistoryGpa(record);
        return <div className="cv-history-entry" key={record.id}>
          <h4>{record.institution}</h4><p>{record.degree}</p><p className="cv-history-period">{formatHistoryPeriod(record)}</p>
          {gpa && <p>{gpa}</p>}
          {check(`degree:${record.id}`)}
        </div>;
      })}
    </section>}
    {summaries.filter(([, value]) => value.trim()).map(([title, value]) => <section key={title}><h3>{title}</h3><p>{value}</p></section>)}
    {languages.length > 0 && <section className="cv-history-section">
      <h3>Languages</h3><p className="cv-history-note">{note(languages.map(item => item.key))}</p>
      <ul className="cv-languages">{languages.map(item => <li key={item.key}>
        <strong>{item.title}</strong> — {item.detail}{reviewed.has(item.key) && <span className="cv-check-inline"> ✓ reviewed</span>}
      </li>)}</ul>
    </section>}
    {skills.length > 0 && <section><h3>Skills</h3><p className="cv-history-note">Each skill passed a timed CareerForge check.</p><ul className="cv-skills">{skills.map(skill => <li key={skill}>{skill}</li>)}</ul></section>}
    {trustUrl && <footer className="cv-trust"><span aria-hidden="true">✓</span> Checked facts can be confirmed at <a href={trustUrl}>{trustUrl.replace(/^https:\/\//, "")}</a></footer>}
  </article>;
}
