import { createHash } from "node:crypto";

export const liveSources = ["himalayas", "greenhouse", "workable"] as const;
export type LiveSource = (typeof liveSources)[number];
export const regions = ["lebanon", "mena", "worldwide", "international"] as const;
export type Region = (typeof regions)[number];
export const employmentTypes = ["Full-time", "Part-time", "Internship", "Contract", "Temporary", "Not specified"] as const;
export type EmploymentType = (typeof employmentTypes)[number];
export const workModes = ["Remote", "Hybrid", "On-site", "Not specified"] as const;
export type WorkMode = (typeof workModes)[number];

/** One validated, display-safe listing ready to upsert. All text is plain text. */
export type LiveJob = {
  id: string;
  source: LiveSource;
  sourceBoard: string | null;
  externalId: string;
  title: string;
  company: string;
  initials: string;
  location: string;
  workMode: WorkMode;
  employmentType: EmploymentType;
  region: Region;
  skills: string[];
  description: string;
  color: string;
  sourceUrl: string;
  applyUrl: string;
  seniority: string | null;
  salaryText: string | null;
  publishedAt: Date | null;
  expiresAt: Date | null;
};

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", bull: "•" };
function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const value = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(value) && value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : " ";
    }
    return entities[code.toLowerCase()] ?? match;
  });
}

/**
 * Converts untrusted source HTML (possibly entity-encoded twice, as Greenhouse
 * sends it) into bounded plain text. Nothing from a source is rendered as HTML.
 */
export function htmlToText(html: string, max = 900): string {
  let text = html.length > 200_000 ? html.slice(0, 200_000) : html;
  if (/&lt;\/?[a-z]/i.test(text)) text = decodeEntities(text);
  text = text
    .replace(/<(script|style|noscript|template)[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|ul|ol|br|tr)\s*>|<br\s*\/?>/gi, " ")
    .replace(/<li[^>]*>/gi, " • ")
    .replace(/<[^>]*>/g, " ");
  text = decodeEntities(text).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return clip(text, max);
}

export function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Stable catalog ID that fits the existing tracker ID contract. */
export function liveJobId(source: LiveSource, externalId: string): string {
  const prefix = { himalayas: "hm", greenhouse: "gh", workable: "wk" }[source];
  return `${prefix}-${createHash("sha256").update(`${source}:${externalId}`).digest("hex").slice(0, 24)}`;
}

const palette = ["peach", "lilac", "mint", "sand", "blue", "pink"] as const;
export function companyStyle(company: string) {
  const words = company.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? words.slice(0, 2).map(word => word[0]).join("") : (words[0] ?? "?").slice(0, 2)).toUpperCase();
  const hash = createHash("sha256").update(company.toLowerCase()).digest()[0];
  return { initials: initials || "?", color: palette[hash % palette.length] };
}

/** Accepts only absolute HTTPS URLs on the expected host family; returns null otherwise. */
export function safeHttpsUrl(value: unknown, hostSuffixes: readonly string[]): string | null {
  if (typeof value !== "string" || value.length > 2000) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    return hostSuffixes.some(suffix => host === suffix || host.endsWith(`.${suffix}`)) ? url.toString() : null;
  } catch { return null; }
}

export function employmentType(value: unknown): EmploymentType {
  const text = typeof value === "string" ? value.toLowerCase() : "";
  if (/intern/.test(text)) return "Internship";
  if (/part/.test(text)) return "Part-time";
  if (/full/.test(text)) return "Full-time";
  if (/contract|freelance/.test(text)) return "Contract";
  if (/temp/.test(text)) return "Temporary";
  return "Not specified";
}

export function workModeFrom(text: string, remote?: boolean): WorkMode {
  if (/hybrid/i.test(text)) return "Hybrid";
  if (remote || /remote/i.test(text)) return "Remote";
  if (/on-?site|in office/i.test(text)) return "On-site";
  return "Not specified";
}

/** Middle East & North Africa countries used for regional (not Lebanon) roles. */
const menaCountries = [
  "united arab emirates", "uae", "saudi arabia", "ksa", "qatar", "kuwait", "bahrain", "oman", "jordan", "egypt", "iraq",
  "syria", "syrian arab republic", "palestine", "morocco", "algeria", "tunisia", "libya", "turkey", "türkiye", "cyprus"
];
const menaCities = ["dubai", "abu dhabi", "sharjah", "riyadh", "jeddah", "dammam", "khobar", "doha", "kuwait city", "manama", "muscat", "amman", "cairo", "alexandria", "baghdad", "erbil", "casablanca", "rabat", "tunis", "istanbul", "nicosia", "limassol"];
const lebanonPattern = /\b(lebanon|beirut|jounieh|tripoli,? lebanon|byblos|jbeil|zahle|sidon|saida|baabda|metn|dbayeh|kaslik)\b/i;

/** Region of a physical location string (local/regional boards). */
export function regionOfPlace(place: string): Region | null {
  const text = place.toLowerCase();
  if (lebanonPattern.test(text)) return "lebanon";
  if ([...menaCountries, ...menaCities].some(name => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text))) return "mena";
  return null;
}

/** Region for a remote listing from its list of permitted applicant countries. */
export function regionOfRestrictions(countries: string[]): Region {
  if (!countries.length) return "worldwide";
  if (countries.every(country => regionOfPlace(country) !== null)) {
    return countries.length === 1 && regionOfPlace(countries[0]) === "lebanon" ? "lebanon" : "mena";
  }
  return "international";
}

export function remoteLocationLabel(countries: string[]): string {
  if (!countries.length) return "Remote · Worldwide";
  if (countries.length <= 3) return clip(`Remote · ${countries.join(", ")}`, 160);
  return `Remote · ${countries.length} countries incl. Lebanon`;
}

/**
 * Deterministic skill detection. Only names that appear as whole words in the
 * listing are returned, so detected skills are evidence from the text itself,
 * never an inference. Order follows this vocabulary for stable output.
 */
const vocabulary: [string, RegExp][] = ([
  ["JavaScript", /\bjavascript\b|\bjs\b/i], ["TypeScript", /\btypescript\b/i], ["React", /\bReact(\.js|JS)?\b(?! Native)|\breact(\.js|js)\b/],
  ["React Native", /\breact native\b/i], ["Next.js", /\bnext\.?js\b/i], ["Vue", /\bvue(\.js|js)?\b/i], ["Angular", /\bangular\b/i],
  ["Node.js", /\bnode(\.js|js)?\b/i], ["HTML", /\bhtml5?\b/i], ["CSS", /\bcss3?\b/i], ["Tailwind CSS", /\btailwind\b/i],
  ["Python", /\bpython\b/i], ["Django", /\bdjango\b/i], ["Flask", /\bflask\b/i], ["FastAPI", /\bfastapi\b/i],
  ["Java", /\bjava\b(?!script)/i], ["Spring", /\bspring (boot|framework)\b/i], ["Kotlin", /\bkotlin\b/i], ["Swift", /\bSwiftUI\b|\bSwift\b(?=[^.]{0,80}\b(iOS|Xcode|Kotlin|Objective-C)\b)|\b(iOS|Xcode)\b[^.]{0,80}\bSwift\b/],
  ["C#", /(^|[^a-z])c#|\bc sharp\b/i], [".NET", /(^|\s)\.net\b|\basp\.net\b|\bdotnet\b/i], ["C++", /\bc\+\+/i], ["Go", /\bgolang\b|\bgo developer\b|\bgo engineer\b/i],
  ["Rust", /\brust\b/i], ["PHP", /\bphp\b/i], ["Laravel", /\blaravel\b/i], ["Ruby", /\bruby\b/i], ["Flutter", /\bflutter\b/i],
  ["SQL", /\bsql\b/i], ["PostgreSQL", /\bpostgres(ql)?\b/i], ["MySQL", /\bmysql\b/i], ["MongoDB", /\bmongo(db)?\b/i], ["Redis", /\bredis\b/i],
  ["GraphQL", /\bgraphql\b/i], ["REST APIs", /\brest(ful)? apis?\b/i], ["Docker", /\bdocker\b/i], ["Kubernetes", /\bkubernetes\b|\bk8s\b/i],
  ["AWS", /\baws\b|\bamazon web services\b/i], ["Azure", /\bazure\b/i], ["GCP", /\bgcp\b|\bgoogle cloud\b/i], ["Terraform", /\bterraform\b/i],
  ["CI/CD", /\bci\s?\/\s?cd\b/i], ["Linux", /\blinux\b/i], ["Git", /\bgit\b|\bgithub\b|\bgitlab\b/i],
  ["Machine Learning", /\bmachine learning\b|\bml engineer\b/i], ["TensorFlow", /\btensorflow\b/i], ["PyTorch", /\bpytorch\b/i],
  ["Data Analysis", /\bdata analy(sis|st|tics)\b/i], ["Power BI", /\bpower ?bi\b/i], ["Tableau", /\btableau\b/i], ["Excel", /\b(MS|Microsoft) Excel\b|\bExcel\b(?!\s+(at|in|as|with)\b)/],
  ["Figma", /\bfigma\b/i], ["UI/UX", /\bui\s?\/\s?ux\b|\bux design\b|\bui design\b/i], ["SEO", /\bseo\b/i],
  ["Salesforce", /\bsalesforce\b/i], ["HubSpot", /\bhubspot\b/i], ["Accounting", /\baccounting\b|\baccountant\b/i],
  ["Project Management", /\bproject management\b|\bproject manager\b/i], ["Agile", /\bagile\b|\bscrum\b/i],
  ["Cybersecurity", /\bcyber ?security\b|\binformation security\b/i], ["Arabic", /\barabic\b/i], ["French", /\bfrench\b/i]
] as [string, RegExp][]);

export function detectSkills(...texts: string[]): string[] {
  const text = texts.join(" \n ").slice(0, 50_000);
  return vocabulary.filter(([, pattern]) => pattern.test(text)).map(([name]) => name).slice(0, 25);
}

export function dateOrNull(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = typeof value === "number" ? new Date(value * 1000) : typeof value === "string" ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) && date.getFullYear() >= 2000 && date.getFullYear() <= 2100 ? date : null;
}

export function salaryText(min: unknown, max: unknown, currency: unknown, period: unknown): string | null {
  const low = typeof min === "number" && min > 0 ? min : null;
  const high = typeof max === "number" && max > 0 ? max : null;
  if (!low && !high) return null;
  const unit = typeof currency === "string" && /^[A-Z]{3}$/.test(currency) ? currency : "";
  const per = typeof period === "string" && /^[a-z]{3,12}$/i.test(period) ? ` / ${period.toLowerCase().replace(/ly$/, "").replace(/^annual$/, "year").replace(/^dai$/, "day")}` : "";
  const format = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const range = low && high && low !== high ? `${format(low)}–${format(high)}` : format((low ?? high)!);
  return clip(`${unit} ${range}${per}`.trim(), 120);
}
