import type { GuidedLink } from "@/components/learning-roadmap";
import type { LearningTrackId } from "@/lib/learning-path";

// Career-roadmap steps that a guided path teaches in depth. Links open the
// matching topic; enrolled learners keep their own settings, others get a preview.
export const pythonTopics: Record<string, string> = {
  python: "how-programs-work", sql: "databases", git: "git-github", testing: "testing", http: "web-apis",
  "api-design": "rest-design", "api-security": "auth", docker: "deployment", "data-cleaning": "pandas",
  statistics: "statistics", "data-visualization": "visualization"
};
export const webTopics: Record<string, string> = {
  html: "html-basics", css: "css-basics", javascript: "js-basics", typescript: "typescript", react: "react-components",
  accessibility: "accessibility", testing: "js-testing", "frontend-performance": "web-performance", "web-security": "web-security",
  git: "git-github", http: "how-the-web-works", nodejs: "node-basics", "api-design": "express-api", sql: "sql-node", "api-security": "node-auth"
};
// Which guided path (and preview goal) suits each career track. Shared steps such as Git
// or SQL follow the track's path; web-only steps always use the web path.
const trackPaths: Record<LearningTrackId, { course: "python" | "web-development"; goal: string }> = {
  frontend: { course: "web-development", goal: "frontend" },
  "full-stack": { course: "web-development", goal: "full-stack" },
  "ux-design": { course: "web-development", goal: "frontend" },
  backend: { course: "python", goal: "backend" },
  "data-analyst": { course: "python", goal: "data" },
  devops: { course: "python", goal: "automation" }
};
const courseNames = { python: "Python", "web-development": "JavaScript & Web" } as const;
const webOnly = new Set(["html", "css", "javascript", "typescript", "react", "accessibility", "frontend-performance", "web-security", "nodejs"]);

export function guidedLinksFor(trackId: LearningTrackId | undefined): Record<string, GuidedLink> {
  const path = trackId ? trackPaths[trackId] : { course: "web-development" as const, goal: "foundations" };
  const steps = new Set([...Object.keys(pythonTopics), ...Object.keys(webTopics)]);
  const links: Record<string, GuidedLink> = {};
  for (const step of steps) {
    const course = webOnly.has(step) || (path.course === "web-development" && webTopics[step]) ? "web-development" : pythonTopics[step] ? "python" : "web-development";
    const topic = course === "python" ? pythonTopics[step] : webTopics[step];
    if (!topic) continue;
    const goal = course === path.course ? path.goal : "foundations";
    links[step] = {
      href: `/learning-roadmap/${course}?goal=${goal}&level=new&hours=6&format=mixed&topic=${topic}`,
      label: `Learn this step in the guided ${courseNames[course]} path`
    };
  }
  return links;
}
