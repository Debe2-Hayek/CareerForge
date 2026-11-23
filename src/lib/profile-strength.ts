import type { AccountProfile } from "./account/schemas";

export type StrengthCounts = {
  education: number; experience: number;
  /** null when verification data could not be loaded: those steps show as not done. */
  claims: { proofSent: number; confirmed: number } | null;
};
export type StrengthStep = { id: string; label: string; detail: string; href: string; points: number; done: boolean };

/**
 * Profile strength: a motivating, transparent score from what the profile actually
 * contains. Proof and confirmed facts weigh most, because they are what makes a
 * profile trustworthy.
 */
export function profileStrength(profile: AccountProfile, counts: StrengthCounts) {
  const steps: StrengthStep[] = [
    { id: "intro", label: "Introduce yourself", detail: "Your name and a clear headline.", href: "#account-name", points: 15, done: !!profile.name.trim() && !!profile.headline.trim() },
    { id: "story", label: "Tell your story", detail: "A few sentences about you.", href: "#account-bio", points: 10, done: profile.bio.trim().length >= 40 },
    { id: "skills", label: "List 3 or more skills", detail: "Tools you have really used.", href: "#account-skills", points: 15, done: profile.skills.length >= 3 },
    { id: "education", label: "Add your education", detail: "Degree, school and dates.", href: "/account/history", points: 15, done: counts.education > 0 },
    { id: "work", label: "Show your work", detail: "A job, internship or project.", href: counts.experience > 0 || profile.project.trim() ? "/account/history" : "#account-project", points: 15, done: counts.experience > 0 || !!profile.project.trim() },
    { id: "proof", label: "Send your first proof", detail: "A diploma, certificate or letter.", href: "/account/verification", points: 10, done: (counts.claims?.proofSent ?? 0) > 0 || (counts.claims?.confirmed ?? 0) > 0 },
    { id: "trust", label: "Get a fact confirmed", detail: "Reviewed proof or a passed skill check.", href: "/account/verification", points: 20, done: (counts.claims?.confirmed ?? 0) > 0 }
  ];
  const percent = steps.reduce((sum, step) => sum + (step.done ? step.points : 0), 0);
  const next = steps.find(step => !step.done) ?? null;
  const level =
    percent >= 100 ? { title: "Standout profile", message: "Everything is in place. Keep your proof up to date." } :
    percent >= 80 ? { title: "Almost there", message: "One or two steps from a standout profile." } :
    percent >= 50 ? { title: "You're getting noticed", message: "Proof turns a good profile into a trusted one." } :
    percent >= 25 ? { title: "Good start", message: "Keep going: each step makes you easier to trust." } :
    { title: "Let's get you started", message: "A name and a headline are all it takes to begin." };
  return { percent, steps, next, level, done: steps.filter(step => step.done).length };
}
