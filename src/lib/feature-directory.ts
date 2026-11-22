import { features, type Feature, type FeatureIcon } from "./features";

// How the All features page presents the product: what works today, ordered by
// what a learner needs, then what is still planned. Copy is written for the
// reader; module codes stay in the code.

export type DirectoryItem = { id: string; label: string; href: string; icon: FeatureIcon; text: string; pilot: boolean; search: string };
export type DirectorySection = { id: string; title: string; text: string; items: DirectoryItem[] };

const copy: Record<string, string> = {
  overview: "See your progress and next steps at a glance.",
  profile: "Keep your details, skills and history in one place.",
  "learning-roadmap": "Follow a free roadmap, one step at a time.",
  workshops: "Join a live session or practise any time.",
  projects: "Choose something to build for your portfolio.",
  "skill-checks": "Show what you know in React and SQL.",
  documents: "Create your CV and portfolio.",
  jobs: "Browse real openings and see how you match.",
  applications: "Keep track of every role you apply for.",
  "career-analysis": "Find a direction and the skills it needs.",
  "academic-planner": "Connect your courses to your goal.",
  "cv-analysis": "See how your CV fits a specific job.",
  "application-agent": "Prepare applications that you approve.",
  "application-insights": "Learn from your application results.",
  "career-assistant": "Ask questions about your own profile.",
  "graduation-simulator": "See how a delay would change your plan."
};

const layout = [
  { id: "learn", title: "Learn", text: "Build the skills", ids: ["learning-roadmap", "workshops", "projects"] },
  { id: "show", title: "Show it", text: "Turn skills into evidence", ids: ["skill-checks", "documents"] },
  { id: "work", title: "Find work", text: "Match and apply", ids: ["jobs", "applications"] },
  { id: "you", title: "Your space", text: "Everything about you", ids: ["overview", "profile"] }
] as const;

const isReady = (feature: Feature) => feature.status === "Available" || feature.status === "Pilot";
const toItem = (feature: Feature): DirectoryItem => ({
  id: feature.id, label: feature.label, href: feature.href, icon: feature.icon, text: copy[feature.id] ?? feature.description, pilot: feature.status === "Pilot",
  search: `${feature.label} ${feature.group} ${copy[feature.id] ?? ""} ${feature.description}`.toLowerCase()
});

/** Ready features by purpose. One that nobody placed still appears, so nothing can go missing. */
export function readySections(): DirectorySection[] {
  const placed = new Set<string>(layout.flatMap(section => [...section.ids]));
  const sections = layout.map(section => ({ id: section.id, title: section.title, text: section.text, items: section.ids.flatMap(id => features.filter(feature => feature.id === id && isReady(feature)).map(toItem)) }));
  const rest = features.filter(feature => isReady(feature) && !placed.has(feature.id)).map(toItem);
  return [...sections, ...(rest.length ? [{ id: "more", title: "More", text: "Also available", items: rest }] : [])].filter(section => section.items.length > 0);
}

export const plannedItems = (): DirectoryItem[] => features.filter(feature => !isReady(feature)).map(toItem);
