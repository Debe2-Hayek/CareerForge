import Link from "next/link";

export function LearningRoadmapNav({ current }: { current: "product" | "learning" }) {
  return <nav className="learning-mode-nav" aria-label="Learning roadmap views">
    <Link href="/learning-roadmap" aria-current={current === "product" ? "page" : undefined}>
      <span>01</span> Product evolution
    </Link>
    <Link href="/learning-roadmap?view=learning" aria-current={current === "learning" ? "page" : undefined}>
      <span>02</span> My learning plan
    </Link>
  </nav>;
}
