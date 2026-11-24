import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { differenceHash, fingerprintProof, hashDistance, normalizedProofText } from "./fingerprint";
import { checkCourseraCertificate, issuerForLink, readCourseraPage, sameHolder } from "./issuers";
import { claimLinkHandlers, linkCheckHandlers, type ClaimsAccess, type LinkInput } from "./handlers";

// A fictional page with the same structure as a real Coursera course certificate page
// (checked against a real one on 23 November 2026; no real person's data is stored here).
const COURSERA_PAGE = `<html><head><title>Coursera</title>
<meta data-rh="true" name="description" content="This certificate verifies my successful completion of Example University&#x27;s &quot;Intro to Databases&quot; on Coursera"/>
<meta data-rh="true" property="og:title" content="Completion Certificate for Intro to Databases"/>
<style>.x{color:red}</style><script>window.__DATA__ = {"Completed by": "Someone Else"}</script></head>
<body><div><span>Intro to Databases</span></div><div><p>Completed by</p><h2>Rana  M. Haddad </h2><p>Mar 3, 2025</p><p>12 hours (approximately)</p>
<p>Rana M. Haddad&#x27;s account is verified. Coursera certifies their successful completion of <span>Intro to Databases</span></p></div></body></html>`;
const EMPTY_PAGE = `<html><head><meta name="description" content="Join for free"/></head><body><div>Explore courses</div></body></html>`;

test("verification links: only public addresses on known issuer sites are accepted", () => {
  assert.equal(issuerForLink("https://coursera.org/verify/ABC123XYZ")?.courseraCode, "ABC123XYZ");
  assert.equal(issuerForLink("https://www.coursera.org/account/accomplishments/verify/abc123xyz#top")?.url, "https://www.coursera.org/account/accomplishments/verify/abc123xyz");
  assert.equal(issuerForLink("https://www.coursera.org/account/accomplishments/specialization/ABC123XYZ")?.courseraCode, null, "accepted, but opened by the reviewer");
  assert.equal(issuerForLink("https://www.credly.com/badges/89fa1f4e-ff19-420c-94fe-d5e2f864073e")?.issuer.id, "credly");
  assert.equal(issuerForLink("https://www.udemy.com/certificate/UC-1234-abcd/")?.issuer.id, "udemy");
  for (const bad of ["http://www.coursera.org/verify/ABC123XYZ", "https://www.coursera.org.evil.example/verify/ABC123XYZ", "https://evil.example/www.coursera.org/verify/ABC123XYZ",
    "https://user@www.coursera.org/verify/ABC123XYZ", "https://www.coursera.org:8443/verify/ABC123XYZ", "https://www.coursera.org/learn/sql", "https://www.udemy.com/course/sql",
    "https://www.linkedin.com/in/someone", "javascript:alert(1)", "https://www.coursera.org/verify/ABC 123", "", `https://www.coursera.org/verify/${"A".repeat(600)}`]) {
    assert.equal(issuerForLink(bad), null, bad);
  }
});

test("Coursera page: holder, course, issuer and date are read from the page; a page without a certificate is not found", () => {
  assert.deepEqual(readCourseraPage(COURSERA_PAGE), { found: true, holderName: "Rana M. Haddad", title: "Intro to Databases", issuer: "Example University", issuedOn: "Mar 3, 2025" });
  assert.equal(readCourseraPage(EMPTY_PAGE).found, false);
  assert.equal(readCourseraPage("<p>Completed by</p><p>Mar 3, 2025</p>").found, false, "a date is never taken as a name");
});

test("holder names: every part of the shorter name must appear, ignoring accents and case", () => {
  assert.equal(sameHolder("Rana Haddad", "Rana M. Haddad"), true);
  assert.equal(sameHolder("José Núñez", "JOSE NUNEZ"), true);
  assert.equal(sameHolder("Rana Haddad", "Karim Haddad"), false);
  assert.equal(sameHolder("Rana", "Rana Haddad"), false, "one name is never enough");
  assert.equal(sameHolder("", "Rana Haddad"), false);
});

test("Coursera check: fixed Coursera address only, redirects stay on Coursera, and every outcome is reported", async () => {
  const asked: string[] = [];
  const respond = (body: string, status = 200, headers: Record<string, string> = {}) => (async (url: string) => { asked.push(String(url)); return new Response(body, { status, headers }); }) as unknown as typeof fetch;
  assert.equal((await checkCourseraCertificate("ABC123XYZ", "Rana Haddad", respond(COURSERA_PAGE))).status, "confirmed");
  assert.equal(asked[0], "https://www.coursera.org/account/accomplishments/verify/ABC123XYZ");
  const other = await checkCourseraCertificate("ABC123XYZ", "Karim Nassar", respond(COURSERA_PAGE));
  assert.equal(other.status, "name_mismatch");
  assert.equal(other.holderName, "Rana M. Haddad");
  assert.equal((await checkCourseraCertificate("ABC123XYZ", "Rana Haddad", respond(EMPTY_PAGE))).status, "not_found");
  assert.equal((await checkCourseraCertificate("ABC123XYZ", "Rana Haddad", respond("", 404))).status, "not_found");
  assert.equal((await checkCourseraCertificate("ABC123XYZ", "Rana Haddad", respond("", 503))).status, "failed");
  asked.length = 0;
  const away = await checkCourseraCertificate("ABC123XYZ", "Rana Haddad", respond("", 302, { location: "https://evil.example/fake" }));
  assert.equal(away.status, "failed");
  assert.deepEqual(asked, ["https://www.coursera.org/account/accomplishments/verify/ABC123XYZ"], "an off-site redirect is never followed");
  const broken = (async () => { throw new TypeError("network"); }) as unknown as typeof fetch;
  assert.equal((await checkCourseraCertificate("ABC123XYZ", "Rana Haddad", broken)).status, "failed");
});

const certificate = (name: string, layout = "classic") => Buffer.from(layout === "classic"
  ? `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="850"><rect width="1200" height="850" fill="#fbf7ec"/><rect x="36" y="36" width="1128" height="778" fill="none" stroke="#1d3b6a" stroke-width="12"/>
<circle cx="600" cy="170" r="70" fill="#1d3b6a"/><text x="600" y="300" font-size="52" text-anchor="middle" font-family="Georgia" fill="#1d3b6a">Example University</text>
<text x="600" y="450" font-size="58" text-anchor="middle" font-family="Georgia" font-style="italic">${name}</text><line x1="760" y1="730" x2="1020" y2="730" stroke="#000" stroke-width="3"/></svg>`
  : `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="850"><rect width="1200" height="850" fill="#fff"/><rect width="1200" height="180" fill="#8a1c1c"/><text x="90" y="430" font-size="64" font-family="Arial">Certificate of Completion</text><text x="90" y="540" font-size="46" font-family="Arial">${name}</text></svg>`);

test("image fingerprints: re-saved and edited copies stay close, another design is far, blank images are skipped", async () => {
  const original = await sharp(certificate("Rana Haddad")).png().toBuffer();
  const base = await fingerprintProof(original, "image/png");
  assert.ok(base.imageHash);
  const resaved = await fingerprintProof(await sharp(original).resize(700).jpeg({ quality: 55 }).toBuffer(), "image/jpeg");
  const edited = await fingerprintProof(await sharp(certificate("Karim Nassar")).png().toBuffer(), "image/png");
  const other = await fingerprintProof(await sharp(certificate("Rana Haddad", "modern")).png().toBuffer(), "image/png");
  assert.notEqual(resaved.sha256, base.sha256);
  assert.ok(hashDistance(base.imageHash!, resaved.imageHash!) <= 10, "re-saved copy");
  assert.ok(hashDistance(base.imageHash!, edited.imageHash!) <= 10, "same design, edited name");
  assert.ok(hashDistance(base.imageHash!, other.imageHash!) > 10, "different design");
  const blank = await fingerprintProof(await sharp({ create: { width: 400, height: 300, channels: 3, background: "#ffffff" } }).png().toBuffer(), "image/png");
  assert.equal(blank.imageHash, null);
  assert.equal(differenceHash(new Uint8Array(72).fill(128)), null);
  assert.equal((await fingerprintProof(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]), "image/png")).imageHash, null, "a broken image does not fail the fingerprint");
});

/** A minimal one-page PDF with the given text and producer (to make the bytes differ). */
function pdf(text: string, producer: string): Uint8Array {
  const stream = `BT /F1 18 Tf 72 720 Td (${text}) Tj ET`;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Producer (${producer}) >>`];
  let body = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => { const at = body.length; body += `${index + 1} 0 obj\n${object}\nendobj\n`; return at; });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(at => `${String(at).padStart(10, "0")} 00000 n \n`).join("")}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

test("PDF fingerprints: the same words in a re-saved file match; different words do not", async () => {
  const words = "Example University certifies that Rana Haddad completed Computer Engineering";
  const a = await fingerprintProof(pdf(words, "Writer A"), "application/pdf");
  const b = await fingerprintProof(pdf(words, "Printer B"), "application/pdf");
  const c = await fingerprintProof(pdf(words.replace("Rana Haddad", "Karim Nassar"), "Writer A"), "application/pdf");
  assert.notEqual(a.sha256, b.sha256);
  assert.ok(a.textHash);
  assert.equal(a.textHash, b.textHash);
  assert.notEqual(a.textHash, c.textHash);
  assert.equal((await fingerprintProof(pdf("short", "x"), "application/pdf")).textHash, null, "too little text to compare");
  assert.equal(normalizedProofText("  Rana   HADDAD,\nB.E. "), "rana haddad b e");
});

const ORIGIN = "http://localhost:3000";
const post = (path: string, body: unknown, origin = ORIGIN) => new Request(`${ORIGIN}${path}`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const noLimit = () => 0;
const RECORD = "8b0c1f4e-7d55-4c55-9a51-0b9a1d1f2c3e";

test("link endpoint: origin, session, target and issuer are checked; the stored address is the cleaned one", async () => {
  const seen: LinkInput[] = [];
  const access: ClaimsAccess = { userId: "u1", async submitEvidence() { throw new Error("unused"); }, async addLink(input) { seen.push(input); return { claimId: RECORD, status: "evidence_submitted" }; } };
  const { POST } = claimLinkHandlers(async () => access, noLimit);
  const good = { kind: "skill", skill: "SQL", url: " https://www.coursera.org/verify/ABC123XYZ#share " };
  assert.equal((await POST(post("/api/v1/claims/links", good, "https://evil.example"))).status, 403);
  assert.equal((await claimLinkHandlers(async () => null, noLimit).POST(post("/api/v1/claims/links", good))).status, 401);
  assert.equal((await POST(post("/api/v1/claims/links", { ...good, url: "https://evil.example/verify/ABC123XYZ" }))).status, 400);
  assert.equal((await POST(post("/api/v1/claims/links", { kind: "degree", url: good.url }))).status, 400, "a degree link needs its record");
  assert.equal((await POST(post("/api/v1/claims/links", { ...good, extra: 1 }))).status, 400);
  assert.equal(seen.length, 0);
  const ok = await POST(post("/api/v1/claims/links", good));
  assert.equal(ok.status, 201);
  assert.equal(((await ok.json()) as { issuer: string }).issuer, "Coursera");
  assert.deepEqual(seen[0], { kind: "skill", recordId: null, skill: "SQL", url: "https://www.coursera.org/verify/ABC123XYZ" });
  assert.equal((await POST(post("/api/v1/claims/links", { kind: "degree", recordId: RECORD, skill: "ignored", url: good.url }))).status, 201);
  assert.deepEqual(seen[1], { kind: "degree", recordId: RECORD, skill: null, url: "https://www.coursera.org/verify/ABC123XYZ" });
});

test("link check endpoint: reviewers only, one link id", async () => {
  let checks = 0;
  const { POST } = linkCheckHandlers(async () => ({ userId: "a1", async check() { checks++; return { status: "confirmed" }; } }), noLimit);
  assert.equal((await linkCheckHandlers(async () => null, noLimit).POST(post("/api/v1/admin/claims/link-check", { linkId: RECORD }))).status, 403);
  assert.equal((await POST(post("/api/v1/admin/claims/link-check", { linkId: RECORD }, "https://evil.example"))).status, 403);
  assert.equal((await POST(post("/api/v1/admin/claims/link-check", { linkId: "x" }))).status, 400);
  assert.equal((await POST(post("/api/v1/admin/claims/link-check", { linkId: RECORD }))).status, 200);
  assert.equal(checks, 1);
});
