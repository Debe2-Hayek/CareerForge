import type { RoadmapArea } from "@/lib/roadmaps/schema";

const paths: Record<RoadmapArea, string> = {
  web: "M3 5h18v14H3zM3 9.5h18M6 7.3h.01M8.5 7.3h.01M9.5 13l-2 1.8 2 1.7M14.5 13l2 1.8-2 1.7",
  programming: "M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4.5l-3 15",
  data: "M4 20V10M10 20V4M16 20v-7M21 20H3",
  ai: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z",
  cloud: "M7 18.5a4 4 0 01-.4-8 5.5 5.5 0 0110.6-1.3A4.6 4.6 0 0117 18.5z",
  security: "M12 3l7.5 3v5.5c0 4.6-3.1 8-7.5 9.5-4.4-1.5-7.5-4.9-7.5-9.5V6zM9 12l2.2 2.2L15.2 10",
  mobile: "M8 3h8a1.5 1.5 0 011.5 1.5v15A1.5 1.5 0 0116 21H8a1.5 1.5 0 01-1.5-1.5v-15A1.5 1.5 0 018 3zM10.8 18h2.4",
  design: "M4 20l1-4.5L15.8 4.7a1.7 1.7 0 012.4 0l1.1 1.1a1.7 1.7 0 010 2.4L8.5 19zM14 6.5l3.5 3.5",
  product: "M12 21a9 9 0 100-18 9 9 0 000 18zM15.5 8.5l-2 5-5 2 2-5z",
  cs: "M7 7h10v10H7zM10 10h4v4h-4zM9.5 7V3.5M14.5 7V3.5M9.5 20.5V17M14.5 20.5V17M7 9.5H3.5M7 14.5H3.5M20.5 9.5H17M20.5 14.5H17",
  games: "M8 8h8a5 5 0 014.9 6l-.5 2.4a2.3 2.3 0 01-4.1.9L14.5 15h-5l-1.8 2.3a2.3 2.3 0 01-4.1-.9L3.1 14A5 5 0 018 8zM8 10.5v3M6.5 12h3M15.5 11h.01M17.5 13h.01"
};

export function AreaIcon({ area }: { area: RoadmapArea }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[area]} /></svg>;
}
