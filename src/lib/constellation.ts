import type { ClaimItem } from "./claims/model";

/**
 * "Your career constellation" on the Overview: every fact in the profile is a star. Checked facts
 * (reviewed or verified) shine, facts waiting for review shimmer, facts only stated are dim, and
 * a few empty places invite the next one. Plain data from the claims overview, no AI.
 */
export type StarState = "checked" | "pending" | "stated" | "empty";
export type Star = { x: number; y: number; state: StarState; label: string; short: string };
export type Sky = { stars: Star[]; checked: number; pending: number; stated: number; percent: number };

/** Sixteen places on a 600 × 380 sky, rising from bottom left to top right. */
export const SLOTS: [number, number][] = [
  [70, 318], [128, 276], [104, 212], [172, 180], [238, 214], [290, 158], [258, 94], [330, 66],
  [392, 112], [434, 58], [488, 104], [532, 56], [548, 150], [474, 190], [412, 238], [500, 284]
];
const ORDER: Record<Exclude<StarState, "empty">, number> = { checked: 0, pending: 1, stated: 2 };
const kindLabel: Record<ClaimItem["kind"], string> = { degree: "Degree", employment: "Work", skill: "Skill", language: "Language" };

/** "Skill: TypeScript and React" becomes "TypeScript and…" so labels never crowd the sky. */
export function shortLabel(label: string) {
  const title = label.split(": ").slice(1).join(": ").trim() || label;
  return title.length > 16 ? `${title.slice(0, 15).trimEnd()}…` : title;
}

export function sky(items: Pick<ClaimItem, "kind" | "title" | "status">[], percent: number): Sky {
  const facts = items.map(item => ({
    label: `${kindLabel[item.kind]}: ${item.title}`,
    state: (item.status === "reviewed" || item.status === "verified" ? "checked" : item.status === "evidence_submitted" ? "pending" : "stated") as Exclude<StarState, "empty">
  })).sort((a, b) => ORDER[a.state] - ORDER[b.state]);
  // The brightest stars come first, so the lit part of the constellation grows from its start.
  const shown = facts.slice(0, SLOTS.length - 2);
  const empties = Math.min(3, SLOTS.length - shown.length);
  // Spread the stars over the whole sky, whatever their number.
  const count = shown.length + empties;
  const slot = (index: number) => SLOTS[count <= 1 ? 0 : Math.round(index * (SLOTS.length - 1) / (count - 1))];
  const stars: Star[] = [
    ...shown.map((fact, index) => ({ x: slot(index)[0], y: slot(index)[1], ...fact, short: shortLabel(fact.label) })),
    ...Array.from({ length: empties }, (_, index) => ({ x: slot(shown.length + index)[0], y: slot(shown.length + index)[1], state: "empty" as const, label: "Add a fact to your profile", short: "" }))
  ];
  return {
    stars,
    checked: facts.filter(fact => fact.state === "checked").length,
    pending: facts.filter(fact => fact.state === "pending").length,
    stated: facts.filter(fact => fact.state === "stated").length,
    percent: Math.max(0, Math.min(100, Math.round(percent)))
  };
}
