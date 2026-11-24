/**
 * Public certificate verification links on known issuer sites. Owners may add only these
 * (the database applies the same list), so a reviewer never sees a look-alike or phishing
 * address. Coursera course certificates are checked automatically: their public page
 * names the holder, the course and the date in the page itself (confirmed 23 November 2026
 * with a real certificate and a made-up code). The other issuers build their pages in the
 * browser, so the reviewer opens them.
 */
export type Issuer = { id: string; name: string; hosts: string[]; auto: boolean; paths?: RegExp };

export const ISSUERS: Issuer[] = [
  { id: "coursera", name: "Coursera", hosts: ["coursera.org", "www.coursera.org"], auto: true },
  { id: "credly", name: "Credly", hosts: ["credly.com", "www.credly.com", "www.youracclaim.com", "youracclaim.com"], auto: false, paths: /^\/(badges|earner\/earned\/badge)\// },
  { id: "linkedin", name: "LinkedIn Learning", hosts: ["www.linkedin.com", "linkedin.com"], auto: false, paths: /^\/learning\/certificates\// },
  { id: "microsoft", name: "Microsoft Learn", hosts: ["learn.microsoft.com"], auto: false, paths: /^\/[a-z-]+\/users\/[^/]+\/(credentials|transcript)\// },
  { id: "freecodecamp", name: "freeCodeCamp", hosts: ["www.freecodecamp.org", "freecodecamp.org"], auto: false, paths: /^\/certification\// },
  { id: "udemy", name: "Udemy", hosts: ["www.udemy.com", "udemy.com", "ude.my"], auto: false, paths: /^\/(certificate\/)?UC-/i },
  { id: "accredible", name: "Accredible", hosts: ["www.credential.net", "credential.net"], auto: false },
  { id: "hackerrank", name: "HackerRank", hosts: ["www.hackerrank.com", "hackerrank.com"], auto: false, paths: /^\/certificates\// },
  { id: "datacamp", name: "DataCamp", hosts: ["www.datacamp.com", "datacamp.com"], auto: false, paths: /^\/(certificate|statement-of-accomplishment|completed\/statement-of-accomplishment)\// }
];
export const ISSUER_NAMES = ISSUERS.map(issuer => issuer.name);

const COURSERA_COURSE = /^\/(?:verify|account\/accomplishments\/verify|account\/accomplishments\/certificate)\/([A-Z0-9]{6,20})\/?$/i;

/** The issuer of a verification link, or null when the link is not a public verification address we accept. */
export function issuerForLink(raw: string): { issuer: Issuer; url: string; courseraCode: string | null } | null {
  const text = raw.trim();
  if (!text || text.length > 500 || /\s/.test(text)) return null;
  let url: URL;
  try { url = new URL(text); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  const issuer = ISSUERS.find(item => item.hosts.includes(host));
  if (!issuer) return null;
  url.hash = "";
  if (issuer.id === "coursera") {
    const course = COURSERA_COURSE.exec(url.pathname);
    // Specialisation and professional certificates are accepted but opened by the reviewer.
    if (!course && !/^\/(verify|account\/accomplishments)\//i.test(url.pathname)) return null;
    return { issuer, url: url.toString(), courseraCode: course ? course[1].toUpperCase() : null };
  }
  if (issuer.paths && !issuer.paths.test(url.pathname)) return null;
  return { issuer, url: url.toString(), courseraCode: null };
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const point = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(point) && point > 0 && point < 0x110000 ? String.fromCodePoint(point) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** Visible text of a page, one line per text block (scripts, styles and tags removed). */
export function pageLines(html: string): string[] {
  return decodeEntities(html.replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, "\n").replace(/<[^>]+>/g, "\n"))
    .split("\n").map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean);
}

export type IssuerPage = { found: boolean; holderName: string | null; title: string | null; issuer: string | null; issuedOn: string | null };
const DATE = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.? \d{1,2}, \d{4}$/;

/** Reads a Coursera course certificate page. Not found when the page shows no certificate. */
export function readCourseraPage(html: string): IssuerPage {
  const lines = pageLines(html.slice(0, 2_000_000));
  const at = lines.findIndex(line => /^Completed by$/i.test(line));
  const holderName = at >= 0 && lines[at + 1] && lines[at + 1].length <= 120 && !DATE.test(lines[at + 1]) ? lines[at + 1] : null;
  const issuedOn = at >= 0 ? lines.slice(at + 1, at + 4).find(line => DATE.test(line)) ?? null : null;
  const description = /<meta[^>]+(?:property="og:description"|name="description")[^>]+content="([^"]{0,600})"/i.exec(html);
  const about = description ? /completion of (.{2,200}?)'s "(.{2,200}?)" on Coursera/.exec(decodeEntities(description[1])) : null;
  const og = /<meta[^>]+property="og:title"[^>]+content="Completion Certificate for ([^"]{2,200})"/i.exec(html);
  const title = about?.[2] ?? (og ? decodeEntities(og[1]) : null);
  const certifies = lines.some(line => /certifies their successful completion of/i.test(line));
  return { found: Boolean(holderName && (certifies || title)), holderName, title, issuer: about?.[1] ?? null, issuedOn };
}

const nameTokens = (name: string) => name.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().split(/[^\p{L}]+/u).filter(token => token.length > 1);

/**
 * Same person when every part of the shorter name appears in the longer one ("Rana Haddad"
 * matches "Rana M. Haddad"), ignoring accents and case. Needs two parts on both sides: a
 * single first name is never enough.
 */
export function sameHolder(profileName: string, pageName: string): boolean {
  const a = nameTokens(profileName);
  const b = nameTokens(pageName);
  if (a.length < 2 || b.length < 2) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.every(token => long.includes(token));
}

export type LinkCheckStatus = "confirmed" | "name_mismatch" | "not_found" | "failed";
export type LinkCheck = { status: LinkCheckStatus; holderName: string | null; title: string | null; issuer: string | null; issuedOn: string | null };

const USER_AGENT = "CareerForge-Verifier/1.0 (+https://careerforge-phi.vercel.app)";
const MAX_PAGE_BYTES = 2_000_000;

async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    chunks.push(value);
    if (size >= MAX_PAGE_BYTES) { await reader.cancel().catch(() => {}); break; }
  }
  const page = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { page.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(page);
}

/**
 * Fetches a Coursera certificate page (fixed address built from the code, so nothing else
 * can be requested) and compares the holder with the profile name. Redirects are followed
 * only within Coursera.
 */
export async function checkCourseraCertificate(code: string, profileName: string, fetchImpl: typeof fetch = fetch): Promise<LinkCheck> {
  let target = `https://www.coursera.org/account/accomplishments/verify/${encodeURIComponent(code)}`;
  try {
    for (let hop = 0; hop < 3; hop++) {
      const response = await fetchImpl(target, { redirect: "manual", headers: { "User-Agent": USER_AGENT, Accept: "text/html" }, signal: AbortSignal.timeout(12000) });
      if (response.status >= 300 && response.status < 400) {
        const next = new URL(response.headers.get("location") ?? "", target);
        if (next.protocol !== "https:" || !["www.coursera.org", "coursera.org"].includes(next.hostname)) break;
        target = next.toString();
        continue;
      }
      if (response.status === 404) return { status: "not_found", holderName: null, title: null, issuer: null, issuedOn: null };
      if (!response.ok) break;
      const page = readCourseraPage(await readCapped(response));
      if (!page.found) return { status: "not_found", ...page };
      const { holderName, title, issuer, issuedOn } = page;
      return { status: sameHolder(profileName, holderName ?? "") ? "confirmed" : "name_mismatch", holderName, title, issuer, issuedOn };
    }
  } catch { /* network error or timeout */ }
  return { status: "failed", holderName: null, title: null, issuer: null, issuedOn: null };
}
