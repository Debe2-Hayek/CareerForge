import type { FeatureIcon } from "@/lib/features";
import { cloverLeaf } from "./ai-clover";

export type IconName = FeatureIcon | "account" | "menu" | "close" | "panel" | "arrow" | "chevron" | "search" | "spark" | "return" | "features" | "grid" | "brain" | "code" | "python" | "shield" | "cloud" | "cpu" | "bookmark" | "filter" | "share" | "calendar" | "external" | "clock";

/**
 * Duotone icon set. Every glyph is a crisp 1.7px line drawing on a 24px grid, plus an optional
 * "soft" shape that is filled at low opacity so icons have a little body without getting heavy.
 * The soft layer inherits currentColor, so icons recolour with their tile (idle, hover, active).
 */
const glyphs: Record<IconName, { line: string; soft?: string }> = {
  compass: { line: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z", soft: "M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z" },
  courses: { line: "M3 5.5c3-1 6-.8 9 1.5 3-2.3 6-2.5 9-1.5V18c-3-1-6-.8-9 1.5C9 17.2 6 17 3 18z M12 7v12.5", soft: "M3 5.5c3-1 6-.8 9 1.5v12.5C9 17.2 6 17 3 18z" },
  roadmap: { line: "M8 18h5a4 4 0 0 0 0-8h-2a4 4 0 0 1 0-4h5 M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M18 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", soft: "M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M18 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" },
  workshops: { line: "M3 4.5h18 M4.5 4.5v10h15v-10 M12 14.5v2.5 M8 21l4-4 4 4 M10.2 7.4v4.2l3.8-2.1z", soft: "M4.5 4.5h15v10h-15z" },
  features: { line: "M7.5 3.5l3.7 6.5H3.8z M17 3.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z M4.3 14.2h6.2v6.2H4.3z M17 13.4l3.9 3.9-3.9 3.9-3.9-3.9z", soft: "M7.5 3.5l3.7 6.5H3.8z M17 13.4l3.9 3.9-3.9 3.9-3.9-3.9z" },
  grid: { line: "M5 5h5v5H5z M14 5h5v5h-5z M5 14h5v5H5z M14 14h5v5h-5z", soft: "M5 5h5v5H5z M14 14h5v5h-5z" },
  brain: { line: "M12 5.2A2.7 2.7 0 0 0 7 6.4a2.8 2.8 0 0 0-2.2 4.2 3 3 0 0 0 .6 4.8A2.9 2.9 0 0 0 9.2 19a2.6 2.6 0 0 0 2.8-2.4z M12 5.2a2.7 2.7 0 0 1 5 1.2 2.8 2.8 0 0 1 2.2 4.2 3 3 0 0 1-.6 4.8 2.9 2.9 0 0 1-3.8 3.6 2.6 2.6 0 0 1-2.8-2.4z M8 10.5c1.2 0 2 .7 2 1.8 M16 10.5c-1.2 0-2 .7-2 1.8", soft: "M12 5.2A2.7 2.7 0 0 0 7 6.4a2.8 2.8 0 0 0-2.2 4.2 3 3 0 0 0 .6 4.8A2.9 2.9 0 0 0 9.2 19a2.6 2.6 0 0 0 2.8-2.4z" },
  code: { line: "M8 7l-5 5 5 5 M16 7l5 5-5 5 M13.6 4.5l-3.2 15" },
  python: { line: "M12 3.5c-3 0-4 1.2-4 2.8V9h4.5 M8 9H6.3C4.7 9 3.5 10.2 3.5 12.4s1.2 3.3 2.8 3.3H8V13.6c0-1.3 1-2.1 2.2-2.1h3.6c1.3 0 2.2-.9 2.2-2.2V6.3c0-1.6-1-2.8-4-2.8z M12 20.5c3 0 4-1.2 4-2.8V15h-4.5 M16 15h1.7c1.6 0 2.8-1.2 2.8-3.4s-1.2-3.3-2.8-3.3H16 M10.2 6.3h.01 M13.8 17.7h.01 M8 15.7v2c0 1.6 1 2.8 4 2.8", soft: "M12 3.5c-3 0-4 1.2-4 2.8V9H6.3C4.7 9 3.5 10.2 3.5 12.4s1.2 3.3 2.8 3.3H8V13.6c0-1.3 1-2.1 2.2-2.1h3.6c1.3 0 2.2-.9 2.2-2.2V6.3c0-1.6-1-2.8-4-2.8z" },
  shield: { line: "M12 3l8 3v5.5c0 4.5-3.2 8-8 9.5-4.8-1.5-8-5-8-9.5V6z M12 8.5v4 M12 15.5h.01", soft: "M12 3l8 3v5.5c0 4.5-3.2 8-8 9.5z" },
  cloud: { line: "M7 18.5a4 4 0 0 1-.4-8 5.5 5.5 0 0 1 10.6-1.3A4.6 4.6 0 0 1 17 18.5z", soft: "M7 18.5a4 4 0 0 1-.4-8 5.5 5.5 0 0 1 10.6-1.3A4.6 4.6 0 0 1 17 18.5z" },
  cpu: { line: "M7 7h10v10H7z M10 10h4v4h-4z M9.5 7V3.5 M14.5 7V3.5 M9.5 20.5V17 M14.5 20.5V17 M7 9.5H3.5 M7 14.5H3.5 M20.5 9.5H17 M20.5 14.5H17", soft: "M7 7h10v10H7z" },
  bookmark: { line: "M6.5 4h11v16.5L12 16.5l-5.5 4z", soft: "M6.5 4h11v16.5L12 16.5l-5.5 4z" },
  filter: { line: "M4 7h10 M18 7h2 M4 17h2 M10 17h10 M16 4.8v4.4 M8 14.8v4.4" },
  share: { line: "M9.5 14.5l5-5 M8 12l-2 2a3.5 3.5 0 0 0 5 5l2-2 M16 12l2-2a3.5 3.5 0 0 0-5-5l-2 2" },
  calendar: { line: "M4.5 6h15v14h-15z M4.5 10.5h15 M8.5 3.5V7 M15.5 3.5V7 M12 13v4 M10 15h4", soft: "M4.5 6h15v4.5h-15z" },
  external: { line: "M13 5h6v6 M19 5l-9 9 M17 14v5H5V7h5" },
  clock: { line: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z M12 7.5V12l3 2" },
  projects: { line: "M12 3l8 4.5v9L12 21l-8-4.5v-9z M4 7.5l8 4.5 8-4.5 M12 12v9", soft: "M12 3l8 4.5-8 4.5-8-4.5z" },
  analysis: { line: "M6 3h8l4 4v14H6z M14 3v4h4 M9.5 17v-2.5 M12 17v-5 M14.5 17v-3.5", soft: "M6 3h8l4 4v14H6z" },
  portfolio: { line: "M3 5h18v14H3z M3 9.5h18 M6.5 7.25h.01 M9.5 7.25h.01 M7 13h4v3.5H7z M14 13h3 M14 16.5h3", soft: "M3 5h18v4.5H3z" },
  agent: { line: "M7 8h10a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3z M12 8V4.5 M12 3.5h.01 M9 13h.01 M15 13h.01 M9.5 16.5h5 M2 12.5v2 M22 12.5v2", soft: "M7 8h10a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3z" },
  outcomes: { line: "M4 4v16h16 M7.5 15.5l3.5-4.5 3 2.5 4.5-6", soft: "M7.5 15.5l3.5-4.5 3 2.5 4.5-6V20H7.5z" },
  // The assistant's clover (src/components/ai-clover.tsx), as an outline.
  assistant: { line: [0, 1, 2, 3].map(quarter => cloverLeaf(quarter, 12, 10.5, 1.05)).join(" ") + " M13.6 12.3 Q15.8 16.4 18.6 20.6" },
  simulator: { line: "M2.5 9L12 4l9.5 5L12 14z M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5 M21.5 9v5.5", soft: "M2.5 9L12 4l9.5 5L12 14z" },
  cv: { line: "M6 3h8l4 4v14H6z M14 3v4h4 M9 11h6 M9 14.5h6 M9 18h3.5", soft: "M6 3h8l4 4v14H6z" },
  checks: { line: "M12 3l8 3v5.5c0 4.5-3.2 8-8 9.5-4.8-1.5-8-5-8-9.5V6z M8.5 12l2.5 2.5 4.5-5", soft: "M12 3l8 3v5.5c0 4.5-3.2 8-8 9.5-4.8-1.5-8-5-8-9.5V6z" },
  overview: { line: "M4 4h6.5v6.5H4z M13.5 4H20v6.5h-6.5z M4 13.5h6.5V20H4z M13.5 13.5H20V20h-6.5z", soft: "M4 4h6.5v6.5H4z M13.5 13.5H20V20h-6.5z" },
  profile: { line: "M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4.5 20.5a7.5 5.5 0 0 1 15 0", soft: "M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
  jobs: { line: "M4 8h16v11H4z M9 8V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V8 M4 13h16 M11 12h2v2.5h-2z", soft: "M4 8h16v11H4z" },
  applications: { line: "M7 7V4.5h13V17h-3 M4 7h13v13H4z M7.5 12h6 M7.5 15.5h4", soft: "M4 7h13v13H4z" },
  account: { line: "M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3 M12 15v2", soft: "M6 11h12v9H6z" },
  panel: { line: "M4 5h16v14H4z M9.5 5v14", soft: "M4 5h5.5v14H4z" },
  menu: { line: "M4 7h16 M4 12h16 M4 17h10" },
  close: { line: "M6 6l12 12 M18 6L6 18" },
  arrow: { line: "M5 12h14 M13 6l6 6-6 6" },
  chevron: { line: "M14.5 6l-6 6 6 6" },
  search: { line: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M20 20l-4.2-4.2", soft: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z" },
  spark: { line: "M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z", soft: "M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" },
  return: { line: "M19 5v7a3 3 0 0 1-3 3H6 M10 11l-4 4 4 4" }
};

export function AppIcon({ name }: { name: IconName }) {
  const glyph = glyphs[name];
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{glyph.soft && <path d={glyph.soft} fill="currentColor" fillOpacity=".2" stroke="none" />}<path d={glyph.line} /></svg>;
}
