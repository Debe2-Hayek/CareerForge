import type { StrengthStep } from "./profile-strength";

/**
 * "Your path" on the Overview: four steps every student goes through, worked out from what the
 * account really contains, plus the single most useful next action. Plain code, no AI.
 */
export type JourneyInput = {
  /** Profile strength steps (src/lib/profile-strength.ts); null when they could not be loaded. */
  strength: StrengthStep[] | null;
  proofSent: number;
  confirmed: number;
  /** Learning paths the student started (learning_enrollments). */
  learningPaths: number;
  /** Tracked jobs with a status beyond "Saved". */
  applied: number;
  /** Tracked jobs, any status. */
  tracked: number;
};
export type JourneyStep = { id: "profile" | "prove" | "direction" | "apply"; title: string; text: string; state: "done" | "now" | "next" };
export type JourneyAction = { eyebrow: string; title: string; text: string; href: string; label: string };
export type Journey = { steps: JourneyStep[]; done: number; current: number; action: JourneyAction };

const PROFILE_STEPS = ["intro", "skills", "education", "work"];
const anchor = (href: string) => href.startsWith("#") ? `/account${href}` : href;

export function journey(input: JourneyInput): Journey {
  const missing = (input.strength ?? []).filter(step => PROFILE_STEPS.includes(step.id) && !step.done);
  const flags = {
    profile: input.strength !== null && missing.length === 0,
    prove: input.confirmed > 0,
    direction: input.learningPaths > 0,
    apply: input.applied > 0
  };
  const base: Omit<JourneyStep, "state">[] = [
    { id: "profile", title: "Build your profile", text: "Name, headline, skills and history" },
    { id: "prove", title: "Prove it", text: "Proof, skill checks and certificates" },
    { id: "direction", title: "Choose a direction", text: "Pick a career and start its free path" },
    { id: "apply", title: "Apply", text: "Match jobs and track your applications" }
  ];
  const firstOpen = base.findIndex(step => !flags[step.id]);
  const current = firstOpen === -1 ? base.length : firstOpen;
  const steps: JourneyStep[] = base.map((step, index) => ({ ...step, state: flags[step.id] ? "done" : index === firstOpen ? "now" : "next" }));

  let action: JourneyAction;
  if (!flags.profile) {
    const step = missing[0];
    action = step
      ? { eyebrow: "NEXT STEP · ABOUT 2 MINUTES", title: step.label, text: `${step.detail} It is the base for every match and check.`, href: anchor(step.href), label: "Do it now" }
      : { eyebrow: "NEXT STEP", title: "Open your profile", text: "Your profile could not be checked just now. Open it to continue.", href: "/account", label: "Open profile" };
  } else if (!flags.prove) {
    action = input.proofSent > 0
      ? { eyebrow: "WHILE A REVIEWER CHECKS YOUR PROOF", title: "Prove a skill in a few minutes", text: "A passed timed check gives a skill a Verified badge straight away.", href: "/skill-checks", label: "Take a skill check" }
      : { eyebrow: "NEXT STEP · ABOUT 2 MINUTES", title: "Send your first proof", text: "A photo of a diploma or certificate is enough. A reviewer checks it and the fact gets a ✓ employers can trust.", href: "/account/verification", label: "Add proof" };
  } else if (!flags.direction) {
    action = { eyebrow: "NEXT STEP", title: "See which careers fit you", text: "Compare your profile with every career path, then start the free roadmap for the one you choose.", href: "/career-analysis", label: "Find my direction" };
  } else if (!flags.apply) {
    action = input.tracked > 0
      ? { eyebrow: "NEXT STEP", title: "Check your fit, then apply", text: "See how your CV matches a saved job and what to fix before you apply.", href: "/cv-analysis", label: "Analyse my CV" }
      : { eyebrow: "NEXT STEP", title: "Find jobs that match you", text: "Live openings ranked by how well your skills match.", href: "/jobs", label: "Explore jobs" };
  } else {
    action = { eyebrow: "ALL FOUR STEPS DONE", title: "Share your checked profile", text: "Turn on your checked-profile link and put it on your CV, so employers see what CareerForge verified.", href: "/account/verification", label: "Share my proof" };
  }
  return { steps, done: steps.filter(step => step.state === "done").length, current, action };
}
