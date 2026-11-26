"use client";

import Link from "next/link";
import { AppShell } from "./app-shell";
import { ProfileCVStart } from "./profile-cv-start";
import { ProfileOverview } from "./profile-overview";
import { useUnsavedProfileGuard } from "./unsaved-profile-guard";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { profileSchema, type AccountProfile } from "@/lib/account/schemas";
import { profileStrength, type StrengthCounts } from "@/lib/profile-strength";
import type { ClaimStatus } from "@/lib/claims/model";
import { JOB_SKILLS } from "@/lib/jobs/text-signals";
import { FieldCounter, SkillTags } from "./field-helpers";

const subscribeReady = () => () => {};
const list = (value: string) => value.split(",").map(item => item.trim()).filter(Boolean);
function readDraft(form: HTMLFormElement) {
  const fields = new FormData(form);
  const text = (name: string) => String(fields.get(name) ?? "").trim();
  // Skills are the tags, plus anything still typed in the skill box (so nothing typed is lost on save).
  const skills = [...new Map([...list(text("skills")), ...list(text("skillsPending"))].map(skill => [skill.toLowerCase(), skill])).values()];
  return { name: text("name"), headline: text("headline"), location: text("location"), bio: text("bio"), education: text("education"), project: text("project"), skills };
}

/** Field by field, so the order of keys never makes a saved profile look changed. */
const sameDraft = (draft: ReturnType<typeof readDraft>, saved: AccountProfile) =>
  draft.name === saved.name && draft.headline === saved.headline && draft.location === saved.location && draft.bio === saved.bio
  && draft.education === saved.education && draft.project === saved.project && draft.skills.join("|") === saved.skills.join("|");

export type ProfileTrust = { counts: StrengthCounts; skillStatus: Record<string, ClaimStatus>; total: number; confirmed: number; pending: number } | null;
/** The CV & Portfolio builder's state, or null when it could not be read. */
export type DocumentsStatus = { hasDraft: boolean; isPublic: boolean; slug: string | null; hasUnpublishedChanges: boolean } | null;

function Section({ id, title, intro, children }: { id: string; title: string; intro: ReactNode; children: ReactNode }) {
  return <section className="profile-section" aria-labelledby={`${id}-title`}>
    <div className="profile-section-intro"><h3 id={`${id}-title`}>{title}</h3><p>{intro}</p></div>
    <div className="profile-section-fields form-grid">{children}</div>
  </section>;
}

/** Shown until a CV or portfolio exists: one clear way to make them, with a picture of the result. */
function DocumentsNudge() {
  return <section className="panel docs-nudge" aria-labelledby="docs-nudge-title">
    <div className="docs-nudge-copy">
      <p className="eyebrow">YOUR NEXT BIG STEP</p>
      <h2 id="docs-nudge-title">You don&apos;t have a CV or portfolio yet</h2>
      <p>Write a few rough notes about yourself. The AI turns them into a clean CV you can download and a one-page portfolio website at your own link. It takes about two minutes, and you can edit every word.</p>
      <Link href="/documents" className="button primary">Create my CV &amp; portfolio <span aria-hidden="true">→</span></Link>
    </div>
    <div className="docs-nudge-art" aria-hidden="true">
      <div className="art-cv"><i className="art-name" /><i className="art-line w70" /><i className="art-rule" /><i className="art-line" /><i className="art-line w80" /><i className="art-line w60" /><i className="art-rule" /><i className="art-line w75" /><i className="art-line w50" /></div>
      <div className="art-site"><div className="art-bar"><b /><b /><b /></div><div className="art-hero"><i className="art-kicker" /><i className="art-title" /><i className="art-title w60" /><span className="art-btn" /></div><div className="art-cards"><i /><i /><i /></div></div>
    </div>
  </section>;
}

function DocumentsCard({ status }: { status: NonNullable<DocumentsStatus> }) {
  const live = status.isPublic && status.slug;
  return <section className="panel docs-card" aria-labelledby="docs-card-title">
    <p className="eyebrow">CV &amp; PORTFOLIO</p>
    <h2 id="docs-card-title">{live ? "Your portfolio is live" : "Your draft is saved"}</h2>
    {live
      ? <a className="docs-card-link" href={`/u/${status.slug}`} target="_blank" rel="noopener noreferrer"><span className="docs-live-dot" aria-hidden="true" />/u/{status.slug}<span className="sr-only"> (opens in a new tab)</span></a>
      : <p className="muted-note">It isn&apos;t published yet. Publish it to get your own link to share with employers.</p>}
    {live && status.hasUnpublishedChanges && <p className="muted-note">You have edits that aren&apos;t on the live site yet.</p>}
    <Link href="/documents" className="button secondary">{live ? "Edit CV & portfolio" : "Finish and publish"} <span aria-hidden="true">→</span></Link>
  </section>;
}

export function AccountProfileEditor({ profile: initialProfile, email, trust = null, documents = null }: { profile: AccountProfile; email: string; trust?: ProfileTrust; documents?: DocumentsStatus }) {
  const router = useRouter();
  const ready = useSyncExternalStore(subscribeReady, () => true, () => false);
  const [dirty, setDirty] = useState(false);
  useUnsavedProfileGuard(dirty);
  const [profile, setProfile] = useState(initialProfile);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const counts: StrengthCounts = trust?.counts ?? { education: 0, experience: 0, claims: null };
  // Once the profile is well filled, AI autofill folds away so the page stays calm. Decided when the page
  // opens, not on every save: folding it mid-save would close the AI review before "Saved" can show.
  const [established] = useState(() => profileStrength(profile, counts).percent >= 50);
  const needsDocuments = documents !== null && !documents.hasDraft;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = profileSchema.safeParse(readDraft(event.currentTarget));
    setError(""); setMessage("");
    if (!parsed.success) { setError("Enter your name and check field lengths. Use at most 40 skills of 60 characters each."); return; }
    setPending(true);
    try {
      const response = await fetch("/api/v1/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data), signal: AbortSignal.timeout(15000) });
      const result = await response.json();
      if (!response.ok) { setError(result.error?.message ?? "Your profile could not be saved."); return; }
      const validated = profileSchema.safeParse(result.profile);
      if (!validated.success) { setError("The saved profile response could not be verified. Please refresh."); return; }
      setProfile(validated.data);
      setDirty(false);
      setMessage("Your private profile is saved to your account.");
      router.refresh();
    } catch { setError("Unable to save. Check your connection and try again. Your form has not been cleared."); }
    finally { setPending(false); }
  }
  async function logout() {
    if (pending) return;
    if (dirty && !window.confirm("Discard your unsaved profile changes and sign out?")) return;
    setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/v1/auth/logout", { method: "POST" });
      if (!response.ok) { setError("Sign out failed. Please try again."); return; }
      setDirty(false);
      router.replace("/login");
      router.refresh();
    } catch { setError("Unable to sign out. Check your connection and try again."); }
    finally { setPending(false); }
  }

  const autofill = <ProfileCVStart disabled={!ready || pending} profile={profile} dirty={dirty} onSaved={saved => { setProfile(saved); setDirty(false); router.refresh(); }} />;
  const percentConfirmed = trust?.total ? Math.round((trust.confirmed / trust.total) * 100) : 0;

  return <AppShell pageTitle="My profile" displayName={profile.name || "Your account"} privateAccount accountActions={<button className="button primary" onClick={logout} disabled={!ready || pending}>Sign out</button>}>
    <div className="account-content profile-page">
      <div className="page-heading profile-heading">
        <div><p className="eyebrow">MY PROFILE</p><h1>Your story starts here<span>.</span></h1><p>Only you can see this page. Signed in as <strong>{email}</strong>.</p></div>
      </div>
      {message && <div className="notice" role="status"><span>{message}</span>{needsDocuments
        ? <Link className="text-button" href="/documents">Next: make your CV &amp; portfolio <span aria-hidden="true">→</span></Link>
        : <Link className="text-button" href="/jobs">See updated matches</Link>}</div>}
      {error && <p className="form-error account-error" role="alert">{error}</p>}

      <ProfileOverview profile={profile} counts={counts} />
      {/* A filled profile goes straight to "make your CV"; a new one fills the profile first, then the CV. */}
      {needsDocuments && established && <DocumentsNudge />}

      {established
        ? <details className="panel profile-ai-compact"><summary><span className="profile-ai-compact-icon" aria-hidden="true">✦</span><span><strong>Update your profile with AI</strong><small>Upload a newer CV or describe what changed; you review every suggestion.</small></span></summary>{autofill}</details>
        : autofill}
      {needsDocuments && !established && <DocumentsNudge />}

      <div className="profile-layout">
        <form className="panel profile-form" method="post" onInput={event => setDirty(!sameDraft(readDraft(event.currentTarget), profile))}
          onReset={() => { setDirty(false); setError(""); }} onSubmit={save} key={JSON.stringify(profile)} aria-busy={pending || undefined}>
          <div className="profile-form-head"><h2>Your profile details</h2><p>Everything here can appear on your CV and portfolio. Only include what you can talk about in an interview.</p></div>
          <fieldset className="profile-fields" disabled={!ready || pending}>
            <Section id="basics" title="The basics" intro="How you appear to employers, on your CV and in job matches.">
              <label>Full name<input id="account-name" name="name" required maxLength={100} autoComplete="name" defaultValue={profile.name} placeholder="e.g. Karim Nassar" /></label>
              <label>Location<input name="location" maxLength={120} autoComplete="address-level2" defaultValue={profile.location} placeholder="e.g. Beirut" /></label>
              <label className="full-field"><span className="field-label-row">Your headline<FieldCounter htmlFor="account-headline" max={160} /></span><input id="account-headline" placeholder="e.g. Junior web developer" name="headline" maxLength={160} defaultValue={profile.headline} /><small>The role you are working toward, in one line.</small></label>
            </Section>
            <Section id="story" title="Your story" intro="A few honest sentences beat a long list. Write the way you would introduce yourself.">
              <label className="full-field"><span className="field-label-row">A little about you<FieldCounter htmlFor="account-bio" max={1000} /></span><textarea id="account-bio" name="bio" rows={4} maxLength={1000} defaultValue={profile.bio} placeholder="What drives you, what you are good at, what you want to do next." /></label>
              <label className="full-field"><span className="field-label-row">Featured project<FieldCounter htmlFor="account-project" max={1000} /></span><textarea id="account-project" placeholder="What did you build, what was your part, and which tools did you use?" name="project" rows={4} maxLength={1000} defaultValue={profile.project} /></label>
            </Section>
            <Section id="education" title="Education" intro={<>A one-line summary for your CV. Add each degree with dates in <Link href="/account/history">Education &amp; experience</Link>.</>}>
              <label className="full-field">Education summary<input name="education" maxLength={240} defaultValue={profile.education} placeholder="e.g. BS Computer Science, 2025" /></label>
            </Section>
            <Section id="skills" title="Skills" intro={<>Tools you have really used. A <span className="tag-proof-inline" aria-hidden="true">✓</span> means it is proven; <Link href="/skill-checks">take a skill check</Link> to earn one.</>}>
              <div className="full-field tag-field-wrap">
                <span className="field-label-row"><label htmlFor="account-skills">Your skills</label><small className="field-counter">{profile.skills.length} saved · up to 40</small></span>
                <SkillTags id="account-skills" name="skills" initial={profile.skills} statusOf={trust?.skillStatus} suggestions={JOB_SKILLS} describedBy="account-skills-help" />
                <small id="account-skills-help">Press Enter or a comma after each skill. Paste a list to add many at once. Suggestions are skills employers ask for.</small>
              </div>
            </Section>
          </fieldset>
          <div className="form-footer profile-save-bar" data-dirty={dirty || undefined}>
            <span className="profile-save-state" aria-live="polite">{dirty ? <><i aria-hidden="true" />Unsaved changes</> : "All changes saved"}</span>
            <div className="profile-save-actions">
              {dirty && <button className="button ghost" type="reset" disabled={pending}>Discard</button>}
              <button className="button primary" type="submit" disabled={!ready || pending || !dirty}>{pending ? "Saving…" : "Save profile"}</button>
            </div>
          </div>
        </form>

        <aside className="profile-aside">
          {documents?.hasDraft && <DocumentsCard status={documents} />}
          <section className="panel profile-trust" aria-labelledby="profile-trust-title">
            <p className="eyebrow">TRUST LEVEL</p>
            <h2 id="profile-trust-title">{trust ? (trust.total ? `${trust.confirmed} of ${trust.total} facts confirmed` : "Add facts to verify") : "Verification"}</h2>
            {trust && trust.total > 0 && <div className="trust-meter" aria-hidden="true"><span style={{ width: `${percentConfirmed}%` }} /></div>}
            <p className="muted-note">{trust?.pending ? `${trust.pending} waiting for a reviewer. ` : ""}Proof turns what you say into what employers can trust.</p>
            <Link href="/account/verification" className="button primary">Verify your profile <span aria-hidden="true">→</span></Link>
          </section>
          <nav className="panel profile-links" aria-label="Profile shortcuts">
            <Link href="/account/history"><span>Education &amp; experience<small>Degrees and jobs with dates</small></span><span aria-hidden="true">→</span></Link>
            <Link href="/cv/saved"><span>Your saved-profile CV<small>Built from this page</small></span><span aria-hidden="true">→</span></Link>
            <Link href="/jobs"><span>Explore your matches<small>Jobs that fit your skills</small></span><span aria-hidden="true">→</span></Link>
          </nav>
        </aside>
      </div>
    </div>
  </AppShell>;
}
