"use client";

import Link from "next/link";
import { AppShell } from "./app-shell";
import { ProfileCVStart } from "./profile-cv-start";
import { ProfileOverview } from "./profile-overview";
import { ClaimBadge } from "./claim-badge";
import { useUnsavedProfileGuard } from "./unsaved-profile-guard";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { profileSchema, type AccountProfile } from "@/lib/account/schemas";
import { profileStrength, type StrengthCounts } from "@/lib/profile-strength";
import type { ClaimStatus } from "@/lib/claims/model";
import { FieldCounter, SkillChips } from "./field-helpers";

const subscribeReady = () => () => {};
function readDraft(form: HTMLFormElement) {
  const fields = new FormData(form);
  const text = (name: string) => String(fields.get(name) ?? "").trim();
  return { name: text("name"), headline: text("headline"), location: text("location"), bio: text("bio"), education: text("education"), project: text("project"), skills: text("skills").split(",").map(s => s.trim()).filter(Boolean) };
}

export type ProfileTrust = { counts: StrengthCounts; skillStatus: Record<string, ClaimStatus>; total: number; confirmed: number; pending: number } | null;

export function AccountProfileEditor({ profile: initialProfile, email, trust = null }: { profile: AccountProfile; email: string; trust?: ProfileTrust }) {
  const router = useRouter();
  const ready = useSyncExternalStore(subscribeReady, () => true, () => false);
  const [dirty, setDirty] = useState(false);
  useUnsavedProfileGuard(dirty);
  const [profile, setProfile] = useState(initialProfile);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const counts: StrengthCounts = trust?.counts ?? { education: 0, experience: 0, claims: null };
  // Once the profile is well filled, AI autofill folds away so the page stays calm.
  const established = profileStrength(profile, counts).percent >= 50;

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
      <div className="page-heading"><div><p className="eyebrow">YOUR PRIVATE ACCOUNT</p><h1>Your story starts here<span>.</span></h1><p>Signed in as {email}. Only you can see this profile.</p></div><span className="outline-label">Owner-only access</span></div>
      {message && <div className="notice" role="status"><span>{message}</span><Link className="text-button" href="/jobs">See updated matches</Link></div>}
      {error && <p className="form-error account-error" role="alert">{error}</p>}

      <ProfileOverview profile={profile} counts={counts} />

      {established
        ? <details className="panel profile-ai-compact"><summary><span className="profile-ai-compact-icon" aria-hidden="true">✦</span><span><strong>Update your profile with AI</strong><small>Upload a newer CV or describe what changed; you review every suggestion.</small></span></summary>{autofill}</details>
        : autofill}

      <div className="profile-layout">
        <form className="panel profile-form" method="post" onInput={event => setDirty(JSON.stringify(readDraft(event.currentTarget)) !== JSON.stringify(profile))} onSubmit={save} key={JSON.stringify(profile)}>
          <div className="section-heading"><div><h2>Your profile details</h2><p>Edit anything here, then save. Only include experience and skills you can speak to.</p></div></div>
          <fieldset className="form-grid profile-fields" disabled={!ready || pending}>
            <label>Full name<input id="account-name" name="name" required maxLength={100} autoComplete="name" defaultValue={profile.name} /></label>
            <label>Location<input name="location" maxLength={120} defaultValue={profile.location} /></label>
            <label className="full-field"><span className="field-label-row">Your headline<FieldCounter htmlFor="account-headline" max={160} /></span><input id="account-headline" placeholder="For example: Computer science student building web apps" name="headline" maxLength={160} defaultValue={profile.headline} /></label>
            <label className="full-field"><span className="field-label-row">A little about you<FieldCounter htmlFor="account-bio" max={1000} /></span><textarea id="account-bio" name="bio" rows={3} maxLength={1000} defaultValue={profile.bio} placeholder="What drives you, what you are good at, what you want to do next." /></label>
            <label className="full-field">Education summary<input name="education" maxLength={240} defaultValue={profile.education} /></label>
            <label className="full-field"><span className="field-label-row">Featured project<FieldCounter htmlFor="account-project" max={1000} /></span><textarea id="account-project" placeholder="What did you build, what was your contribution, and which tools did you use?" name="project" rows={3} maxLength={1000} defaultValue={profile.project} /></label>
            <label className="full-field">Your skills<input id="account-skills" placeholder="Tools you have used, separated by commas" name="skills" aria-label="Your skills" aria-describedby="account-skills-help" maxLength={2500} defaultValue={profile.skills.join(", ")} /><SkillChips htmlFor="account-skills" /><small id="account-skills-help">Separate with commas. Up to 40 skills.</small></label>
          </fieldset>
          <p className="muted-note">Save before leaving. Unsaved drafts stay only on this page; browser Back may discard them.</p>
          <div className="form-footer profile-save-bar" data-dirty={dirty || undefined}><span className="profile-save-state">{dirty ? <><i aria-hidden="true" />Unsaved changes</> : "All changes saved"}</span><button className="button primary" type="submit" disabled={!ready || pending || !dirty}>{pending ? "Please wait…" : "Save profile"}</button></div>
        </form>

        <aside className="profile-aside">
          <section className="panel profile-trust" aria-labelledby="profile-trust-title">
            <p className="eyebrow">TRUST LEVEL</p>
            <h2 id="profile-trust-title">{trust ? (trust.total ? `${trust.confirmed} of ${trust.total} facts confirmed` : "Add facts to verify") : "Verification"}</h2>
            {trust && trust.total > 0 && <div className="trust-meter" aria-hidden="true"><span style={{ width: `${percentConfirmed}%` }} /></div>}
            <p className="muted-note">{trust?.pending ? `${trust.pending} waiting for a reviewer. ` : ""}Proof turns what you say into what employers can trust.</p>
            <Link href="/account/verification" className="button primary">Verify your profile <span aria-hidden="true">→</span></Link>
          </section>
          <section className="panel">
            <p className="eyebrow">YOUR SKILL TOOLKIT</p>
            <h2>{profile.skills.length ? `${profile.skills.length} ${profile.skills.length === 1 ? "skill" : "skills"}` : "No skills yet"}</h2>
            {profile.skills.length ? <ul className="toolkit-list">{profile.skills.map(skill => <li key={skill}><span>{skill}</span><ClaimBadge status={trust?.skillStatus[skill.toLowerCase()] ?? "self_declared"} compact /></li>)}</ul>
              : <p className="muted-note">Add skills you have used. Your job matches update after saving.</p>}
            <Link href="/skill-checks" className="text-button">Prove a skill with a check <span aria-hidden="true">→</span></Link>
          </section>
          <nav className="panel profile-links" aria-label="Profile shortcuts">
            <Link href="/account/history">Education &amp; experience <span aria-hidden="true">→</span></Link>
            <Link href="/cv/saved">Your saved-profile CV <span aria-hidden="true">→</span></Link>
            <Link href="/jobs">Explore your matches <span aria-hidden="true">↗</span></Link>
          </nav>
        </aside>
      </div>
    </div>
  </AppShell>;
}
