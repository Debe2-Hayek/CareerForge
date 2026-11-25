import Link from "next/link";
import { notFound } from "next/navigation";
import { PublishedPortfolio } from "@/components/PortfolioBuilder.jsx";
import { readPublicPortfolioSite } from "@/lib/portfolio-site-server";
import "./published-site.css";
import { builderFonts } from "@/lib/builder-fonts";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const result = await readPublicPortfolioSite((await params).slug).catch(() => null);
  if (!result) return { title: "Portfolio not found", robots: { index: false, follow: false } };
  const { name, role, summary } = result.site.data;
  return {
    title: [name || "Portfolio", role].filter(Boolean).join(" — "),
    description: summary.slice(0, 160) || undefined,
    // Same privacy default as /p links: shareable by URL, not listed in search engines.
    robots: { index: false, follow: false }
  };
}

export default async function PublishedSitePage({ params }: { params: Params }) {
  const result = await readPublicPortfolioSite((await params).slug);
  if (!result) notFound();
  return <main className={`published-site ${builderFonts}`}>
    <PublishedPortfolio state={result.site} />
    <footer className="published-site-credit">
      Made with <Link href="/">CareerForge</Link>
      {result.trustSlug && <> · <Link href={`/v/${result.trustSlug}`} className="published-site-trust">✓ See the facts CareerForge checked</Link></>}
    </footer>
  </main>;
}
