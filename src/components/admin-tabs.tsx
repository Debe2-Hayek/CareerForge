import Link from "next/link";

const tabs = [
  { id: "claims", href: "/admin/claims", label: "Review claims" },
  { id: "skill-checks", href: "/admin/skill-checks", label: "Skill checks studio" }
] as const;

/** Switches between the admin pages. Shown only on admin pages, which check the role on the server. */
export function AdminTabs({ current }: { current: (typeof tabs)[number]["id"] }) {
  return <nav className="admin-tabs" aria-label="Admin pages">
    {tabs.map(tab => <Link key={tab.id} href={tab.href} aria-current={tab.id === current ? "page" : undefined}>{tab.label}</Link>)}
  </nav>;
}
