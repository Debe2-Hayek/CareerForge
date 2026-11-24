import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TrustFacts, TrustMeaning } from "@/components/trust-facts";
import { readTrustPage } from "@/lib/trust-page-server";
import { factCount, formatMonth } from "@/lib/trust-page";

export const dynamic = "force-dynamic";
// Unlisted: shareable by link only, never indexed.
export const metadata: Metadata = { title: "Checked profile - CareerForge", robots: { index: false, follow: false } };

export default async function TrustPage({ params }: { params: Promise<{ slug: string }> }) {
  const facts = await readTrustPage((await params).slug);
  if (!facts) notFound();
  const count = factCount(facts);
  return <main className="trust-page">
    <div className="trust-sheet">
      <header className="trust-hero">
        <div className="trust-brand"><Link href="/">CareerForge<span>.</span></Link><span className="trust-seal"><span aria-hidden="true">✓</span> Checked profile</span></div>
        <h1>{facts.name}</h1>
        {facts.headline && <p className="trust-headline">{facts.headline}</p>}
        <p className="trust-lede">{count ? `${count} ${count === 1 ? "fact" : "facts"} on this page ${count === 1 ? "was" : "were"} checked by CareerForge.` : "No facts are checked yet."} Facts the person only stated are not shown here.</p>
      </header>
      <TrustFacts facts={facts} />
      <footer className="trust-footer">
        <h2>What “checked” means</h2>
        <TrustMeaning />
        <p className="trust-stamp">Live page{facts.updatedAt ? `, as of ${formatMonth(facts.updatedAt)}` : ""}. It always shows the current state and stops working if the person turns it off.</p>
      </footer>
    </div>
  </main>;
}
