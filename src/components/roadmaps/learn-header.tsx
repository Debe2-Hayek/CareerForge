import Link from "next/link";
import { roadmaps } from "@/lib/roadmaps/catalog";
import { openCourses, openTutorials } from "@/lib/roadmaps/open-catalog";
import styles from "./roadmaps.module.css";

export type LearnTab = "roadmaps" | "projects" | "courses";

export const projectIdeaCount = roadmaps.reduce((sum, roadmap) => sum + roadmap.projects.length, 0);
const format = (value: number) => value.toLocaleString("en-US");

const tabs: { id: LearnTab; label: string; href: string; count: number }[] = [
  { id: "roadmaps", label: "Roadmaps", href: "/learning-roadmap", count: roadmaps.length },
  { id: "projects", label: "Projects", href: "/learning-roadmap/projects", count: projectIdeaCount + openTutorials.length },
  { id: "courses", label: "Free courses", href: "/learning-roadmap/courses", count: openCourses.length }
];

export function LearnHeader({ active, title, text }: { active: LearnTab; title: string; text: string }) {
  return <header className={styles.hero}>
    <h1>{title}</h1>
    <p>{text}</p>
    <nav className={styles.tabs} aria-label="Learning sections">
      {tabs.map(tab => <Link key={tab.id} href={tab.href} aria-current={tab.id === active ? "page" : undefined}>
        {tab.label} <span className={styles.tabCount}>{format(tab.count)}</span>
      </Link>)}
    </nav>
  </header>;
}

export function LearnFooter({ children }: { children?: React.ReactNode }) {
  return <footer className={styles.footer}>
    <p>{children ?? "Roadmaps, summaries and project briefs are original CareerForge content. Resources are free and open on their publishers’ own sites. CareerForge is not affiliated with them."}</p>
    <nav aria-label="More in learning">
      <Link href="/learning-roadmap/careers">Compare my profile with a role or job</Link>
      <Link href="/learning-roadmap/product">How CareerForge evolves</Link>
    </nav>
  </footer>;
}
