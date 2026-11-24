import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { verifyCertificate } from "@/lib/certified-workshops-server";
import { CERTIFICATE_LIMITS, formatDay, kindLabel, sessionText } from "@/lib/certified-workshops";
import { siteUrl } from "@/lib/site-url";
import { PrintCV } from "@/components/print-cv";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your certificate - CareerForge", robots: { index: false, follow: false } };

/**
 * The holder's printable certificate (A4 landscape; "Save as PDF" in the print dialog keeps every
 * script, including Arabic names). Only the signed-in holder can open it: it carries their name,
 * while the public check shows the name only if they agreed. The QR code opens the public check.
 */
export default async function PrintCertificate({ params }: { params: Promise<{ id: string }> }) {
  if (!(await cookies()).getAll().some(cookie => cookie.name.startsWith("sb-"))) redirect("/login");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login");
  const [own, profile, certificate] = await Promise.all([
    client.from("workshop_certificates").select("id").eq("id", id).eq("user_id", user.id).maybeSingle(),
    client.from("profiles").select("full_name").eq("id", user.id).single(),
    verifyCertificate(id)
  ]);
  // Someone else's certificate gets the same answer as one that does not exist.
  if (own.error || !own.data || !certificate) notFound();
  const name = (profile.data?.full_name as string | null)?.trim() || "Certificate holder";
  const checkUrl = siteUrl(`/certificates/${certificate.id}`);
  const qr = await QRCode.toString(checkUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#16210f", light: "#00000000" } });
  const revoked = Boolean(certificate.revokedAt);

  return <main className="certificate-print-page">
    <div className="certificate-print-tools">
      <Link href="/account/certificates" className="text-button">← Workshops &amp; certificates</Link>
      {revoked ? <p className="form-error" role="alert">This certificate was revoked on {formatDay(certificate.revokedAt!)} and can no longer be printed.</p>
        : <><p>Choose “Save as PDF” in the print window to download it. Landscape, A4.</p><PrintCV /></>}
    </div>
    {!revoked && <article className="certificate-paper" aria-label="Certificate">
      <div className="certificate-frame">
        <header>
          <span className="certificate-brand">CareerForge<span>.</span></span>
          <span className="certificate-kind">{kindLabel[certificate.kind]}</span>
        </header>
        <p className="certificate-intro">This certifies that</p>
        <h1 className="certificate-name" dir="auto">{name}</h1>
        <p className="certificate-scope">{certificate.kind === "attendance" ? "attended the full workshop" : certificate.scope.replace(/^Passed/, "passed")}</p>
        <h2 className="certificate-title" dir="auto">{certificate.workshop.title}</h2>
        <p className="certificate-when">{sessionText(certificate.workshop.startsAt, certificate.workshop.endsAt)} · {certificate.workshop.mode === "online" ? "Online" : "In person"}</p>
        <footer>
          <dl>
            {certificate.workshop.trainer && <div><dt>Trainer</dt><dd dir="auto">{certificate.workshop.trainer}</dd></div>}
            <div><dt>Issued by</dt><dd>CareerForge, {formatDay(certificate.issuedAt)}</dd></div>
            <div><dt>Certificate id</dt><dd><code>{certificate.id}</code></dd></div>
          </dl>
          <div className="certificate-qr">
            <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: qr }} />
            <small>Scan or visit<br /><b>{checkUrl.replace(/^https:\/\//, "")}</b><br />to check it is valid</small>
          </div>
        </footer>
        <p className="certificate-limits">{CERTIFICATE_LIMITS}</p>
      </div>
    </article>}
  </main>;
}
