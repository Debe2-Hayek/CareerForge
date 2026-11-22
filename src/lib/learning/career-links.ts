import type { GuidedLink } from "@/components/learning-roadmap";
import type { LearningTrackId } from "@/lib/learning-path";

// Career-roadmap steps that a guided path teaches in depth. Links open the
// matching topic; the roadmap page shows a goal that includes it.
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
// Which guided path suits each career track. Shared steps such as Git or SQL
// follow the track's path; web-only steps always use the web path.
type GuidedCourse = "python" | "web-development";
const trackPaths: Record<LearningTrackId, GuidedCourse> = {
  frontend: "web-development",
  "full-stack": "web-development",
  "ux-design": "web-development",
  backend: "python",
  "data-analyst": "python",
  devops: "python"
};
const courseNames = { python: "Python", "web-development": "JavaScript & Web" } as const;
const webOnly = new Set(["html", "css", "javascript", "typescript", "react", "accessibility", "frontend-performance", "web-security", "nodejs"]);

export function guidedLinksFor(trackId: LearningTrackId | undefined): Record<string, GuidedLink> {
  const path = trackId ? trackPaths[trackId] : "web-development";
  const steps = new Set([...Object.keys(pythonTopics), ...Object.keys(webTopics)]);
  const links: Record<string, GuidedLink> = {};
  for (const step of steps) {
    const course: GuidedCourse = webOnly.has(step) || (path === "web-development" && webTopics[step]) ? "web-development" : pythonTopics[step] ? "python" : "web-development";
    const topic = course === "python" ? pythonTopics[step] : webTopics[step];
    if (!topic) continue;
    links[step] = { href: `/learning-roadmap/${course}?topic=${topic}`, label: `Learn this step in the ${courseNames[course]} roadmap` };
  }
  return links;
}
