import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ProductRoadmap } from "@/components/product-roadmap";
import { loadLearningAccount } from "@/lib/learning/page-data";
import { productRoadmap, toProductRoadmapView } from "@/lib/product-roadmap";

export const metadata = { title: "Product roadmap - CareerForge", robots: { index: false, follow: false } };

// The living product-evolution map (src/data/roadmap.json) stays inside the
// authenticated Learning roadmap tab, as a secondary view behind the learner journey.
export default async function ProductRoadmapPage() {
  const account = await loadLearningAccount();
  if (account.status !== "ready") {
    return <AppShell pageTitle="Learning roadmap" privateAccount><div className="empty-state"><h1>The product roadmap is temporarily unavailable.</h1><Link href="/learning-roadmap/product" className="button primary">Try again</Link></div></AppShell>;
  }
  return <AppShell pageTitle="Learning roadmap" privateAccount displayName={account.profile.name}>
    <nav aria-label="Breadcrumb" className="learning-breadcrumb"><Link href="/learning-roadmap">Learning roadmap</Link> <span aria-hidden="true">/</span> How CareerForge evolves</nav>
    <ProductRoadmap roadmap={toProductRoadmapView(productRoadmap)} />
  </AppShell>;
}
