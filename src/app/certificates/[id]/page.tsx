import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyCertificate } from "@/lib/certified-workshops-server";
import { CERTIFICATE_LIMITS, formatDay, kindHelp, kindLabel, sessionText } from "@/lib/certified-workshops";

export const dynamic = "force-dynamic";
// Unlisted: shareable by link only, never indexed.
export const metadata: Metadata = { title: "Certificate check - CareerForge", robots: { index: false, follow: false } };

/** Public certificate check: minimal fields and whether the certificate is still valid. */
export default async function CertificateCheck({ params }: { params: Promise<{ id: string }> }) {
  const certificate = await verifyCertificate((await params).id);
  if (!certificate) notFound();
  const revoked = Boolean(certificate.revokedAt);
  return <main className="trust-page">
    <div className="trust-sheet certificate-check" data-revoked={revoked ? "yes" : "no"}>
      <header className="trust-hero">
        <div className="trust-brand"><Link href="/">CareerForge<span>.</span></Link>
          <span className="trust-seal" data-revoked={revoked ? "yes" : "no"}><span aria-hidden="true">{revoked ? "✗" : "✓"}</span> {revoked ? "Revoked" : "Valid certificate"}</span></div>
        <p className="eyebrow">{kindLabel[certificate.kind].toUpperCase()}</p>
        <h1>{certificate.workshop.title}</h1>
        <p className="trust-headline">{certificate.holderName ? <>Issued to <strong>{certificate.holderName}</strong></> : "The holder chose not to show their name on this check."}</p>
        {revoked && <p className="certificate-revoked" role="alert">This certificate was revoked by CareerForge on {formatDay(certificate.revokedAt!)} and is no longer valid.</p>}
      </header>
      <dl className="trust-meaning certificate-fields">
        <div><dt>Result</dt><dd>{certificate.scope}</dd></div>
        <div><dt>Workshop</dt><dd>{sessionText(certificate.workshop.startsAt, certificate.workshop.endsAt)} · {certificate.workshop.mode === "online" ? "Online" : "In person"}</dd></div>
        {certificate.workshop.trainer && <div><dt>Trainer</dt><dd>{certificate.workshop.trainer}</dd></div>}
        <div><dt>Issued by</dt><dd>CareerForge, on {formatDay(certificate.issuedAt)}</dd></div>
        <div><dt>Certificate id</dt><dd><code>{certificate.id}</code></dd></div>
      </dl>
      <footer className="trust-footer">
        <p className="trust-stamp">{kindHelp[certificate.kind]} {CERTIFICATE_LIMITS}</p>
      </footer>
    </div>
  </main>;
}
