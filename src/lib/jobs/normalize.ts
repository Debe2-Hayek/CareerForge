import { createHash } from "node:crypto";
import { levelLabels, type LevelKey } from "./display";
import { detectSkills, requiredYears } from "./text-signals";

// Moved to ./text-signals so the browser can use them; kept exported here for existing callers.
export { detectSkills, requiredYears };

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
  /** Display label, e.g. "Senior · 5+ years asked". */
  seniority: string | null;
  experienceLevel: ExperienceLevel | null;
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


export const experienceLevels = Object.keys(levelLabels) as LevelKey[];
export type ExperienceLevel = LevelKey;
const experienceLabels: Record<ExperienceLevel, string> = levelLabels;
const rank = (level: ExperienceLevel) => experienceLevels.indexOf(level);


/** Level stated by the job title itself; titles are the employer's own words and override source tags. */
function titleLevel(title: string): ExperienceLevel | null {
  if (/\bintern(ship)?\b|\btrainee\b|\bapprentice(ship)?\b/i.test(title)) return "internship";
  if (/\b(head of|chief|vice president|vp|director|cto|ceo|coo|cfo|cmo|principal|engineering manager)\b|^head\b/i.test(title)) return "lead";
  if (/\b(senior|sr\.?|staff|architect|leader)\b|\blead\b(?!\s*gen)/i.test(title)) return "senior";
  if (/\b(intermediate|mid[- ]level)\b/i.test(title)) return "mid";
  if (/\b(junior|jr\.?|entry[- ]level|graduate|new grad)\b/i.test(title)) return "entry";
  return null;
}

/** Maps a source's own seniority vocabulary (Himalayas tags, Workable experience). */
function sourceLevel(label: string): ExperienceLevel | null {
  const text = label.toLowerCase();
  if (/intern/.test(text)) return "internship";
  if (/entry|junior/.test(text)) return "entry";
  if (/associate|mid/.test(text)) return "mid";
  if (/senior/.test(text)) return "senior";
  if (/director|executive|manager|lead/.test(text)) return "lead";
  return null;
}

/**
 * Deterministic experience level that errs towards the more experienced
 * reading, so a senior role is never presented as junior:
 * - the title's own words decide when present (an "Intern" title is always an
 *   internship), raised further if the text asks for more years;
 * - otherwise the source tag's lowest level, raised (never lowered) by the
 *   years the text explicitly asks for, because a small number is usually a
 *   sub-requirement ("1+ years with Adobe");
 * - null when nothing states a level.
 * Returns the level used for filtering plus a short display label.
 */
export function inferExperience(title: string, text: string, sourceLabels: readonly string[] = []):
  { level: ExperienceLevel | null; label: string | null } {
  const fromTitle = titleLevel(title);
  const years = requiredYears(`${title} . ${text}`);
  const fromYears: ExperienceLevel | null = years === null ? null : years >= 5 ? "senior" : years >= 3 ? "mid" : "entry";
  const tagged = [...new Set(sourceLabels.flatMap(label => (/mid[- ]?senior/i.test(label) ? ["mid", "senior"] : [label])).map(sourceLevel).filter((level): level is ExperienceLevel => !!level))].sort((a, b) => rank(a) - rank(b));
  // The years are shown only when they are what set the level, so a label never reads "Senior · 1+ years asked".
  const yearsNote = (level: ExperienceLevel) => (years && level === fromYears ? ` · ${years}+ years asked` : "");
  if (fromTitle === "internship") return { level: "internship", label: experienceLabels.internship };
  const higher = (a: ExperienceLevel, b: ExperienceLevel | null) => (b && rank(b) > rank(a) ? b : a);
  if (fromTitle) { const level = higher(fromTitle, fromYears); return { level, label: `${experienceLabels[level]}${yearsNote(level)}` }; }
  if (!tagged.length) return fromYears ? { level: fromYears, label: `${experienceLabels[fromYears]}${yearsNote(fromYears)}` } : { level: null, label: null };
  const low = tagged[0], high = tagged[tagged.length - 1];
  const level = higher(low, fromYears);
  const range = level === low && low !== high ? `${experienceLabels[low]} to ${experienceLabels[high].toLowerCase()}` : experienceLabels[level];
  return { level, label: `${range}${yearsNote(level)}` };
}

/** Places that, when a listing restricts applicants to them, exclude someone living in Lebanon. */
const elsewhere = String.raw`(?:the\s+)?(?:U\.S\.A\.?|U\.S\.?|USA|US|United States(?: of America)?|North America|Americas|America|Canada|Mexico|LATAM|LatAm|Latin America|South America|Central America|Caribbean|U\.K\.?|UK|United Kingdom|Great Britain|England|Ireland|E\.U\.|EU|EEA|European Union|Europe|Germany|France|Spain|Portugal|Italy|Netherlands|Poland|Romania|Brazil|Argentina|Colombia|Chile|Peru|India|Pakistan|Philippines|Indonesia|Vietnam|Southeast Asia|South Asia|East Asia|APAC|Australia|New Zealand|Singapore|Japan|South Africa|Nigeria|Kenya|Africa)\b`;
const either = (word: string) => `[${word[0].toUpperCase()}${word[0]}]${word.slice(1)}`;
const people = String.raw`(?:candidates?|applicants?|professionals?|attorneys?|lawyers?|practitioners?|experts?|talent|individuals?|freelancers?|contractors?|engineers?|developers?|specialists?|residents?|writers?|editors?|tutors?|people|workers?|hires?|team members?|employees?|roles?|positions?|only|remote)`;
// Case-sensitive on purpose: "US"/"UK"/"EU" must not match the words "us" or "eu".
const restrictionPatterns = [
  new RegExp(String.raw`\b${elsewhere}[- ]based,?\s+${people}`),
  new RegExp(String.raw`\b(?:${["seeks", "seeking", "for", "ideal for", "tailored for", "open to", "hiring", "looking for", "only", "must be", "you are", "be"].map(either).join("|")})\s+(?:an?\s+)?${elsewhere}[- ]based`),
  new RegExp(String.raw`\b(?:${["must", "should", "need to", "needs to", "required to", "have to"].map(either).join("|")})\s+(?:be\s+)?(?:currently\s+|physically\s+|legally\s+)?(?:based|located|living|residing|reside|live)\s+(?:in|within)\s+${elsewhere}`),
  new RegExp(String.raw`\b(?:${["candidates?", "applicants?", "experts?", "contractors?", "professionals?", "freelancers?", "you", "talent", "individuals?"].map(either).join("|")})\s+(?:must be\s+|are\s+|who are\s+|currently\s+)?(?:based|located|residing|living)\s+(?:in|within)\s+${elsewhere}`),
  new RegExp(String.raw`\b(?:authori[sz]ed|eligible|eligibility|legally (?:able|permitted|allowed)|right|permission)\s+to\s+work\s+(?:in|for|within)\s+${elsewhere}`, "i"),
  /\b(?:U\.?S\.?|American|Canadian|UK|British|EU) (?:citizens?|citizenship|persons?|work authori[sz]ation|residency|nationals?|work permit|(?:military )?veterans?)\b|\bsecurity clearance\b/,
  new RegExp(String.raw`\b${elsewhere}\s*[-(]?\s*(?:[Oo]nly|ONLY)\b`),
  // Residency as a requirement ("open only to residents of", "must be a citizen of"), not privacy notices ("applying as a resident of the EU").
  new RegExp(String.raw`\b(?:open|available|limited|restricted)\s+(?:only\s+)?to\s+(?:candidates\s+|applicants\s+)?(?:who are\s+)?(?:residents?|citizens?|nationals?)\s+of\s+${elsewhere}`, "i"),
  new RegExp(String.raw`\b(?:must|need to|should)\s+be\s+(?:a\s+)?(?:legal\s+|permanent\s+)?(?:residents?|citizens?)\s+of\s+${elsewhere}`, "i"),
  new RegExp(String.raw`\b${either("looking for")}[:\s•·-]+(?:someone\s+|candidates?\s+)?(?:who is\s+|who are\s+)?[Bb]ased in ${elsewhere}`),
  // "Location: Remote — Europe", "Location: Remote within Europe", "Location Remote. US, Europe or Latin America"
  new RegExp(String.raw`\bLocation\s*:?\s*(?:Remote\s*(?:within|in|only)?\s*[-–—,(/:.]?\s*)?${elsewhere}`),
  new RegExp(String.raw`\b(?:[Yy]ou(?:'|’)re|[Yy]ou are|[Yy]ou(?:'|’)ll be)\s+(?:currently\s+)?(?:based|located|living)\s+in\s+${elsewhere}`),
  new RegExp(String.raw`\b(?:remotely|working|operating)\s+(?:from\s+|with)?in\s+${elsewhere}`),
  new RegExp(String.raw`\b(?:ideally|preferably)\s+(?:be\s+)?(?:based|located)\s+in\s+${elsewhere}`)
];
/** Title segments such as "(U.S. Based, …)", "(LATAM)", "(Calw, BW, DE, 64625)", "Remote - USA" or "… - Europe". */
const titleRestriction = new RegExp(String.raw`\([^)]*(?:\b${elsewhere}|,\s*(?:DE|FR|ES|IT|NL|PL|BR|PH|AU|CA|IN)\b)[^)]*\)|\b[Rr]emote\s*[-–—,/(]\s*${elsewhere}|\s[-–—|]\s*${elsewhere}(?:\s+\w+)?\s*$`);
const lebanonStillOpen = /\b(EMEA|Middle East|MENA|Lebanon|worldwide|world-wide|globally)\b|\banywhere\b(?!\s+(?:in|within)\s+(?!the world))/i;

const nationals = String.raw`(?:Emirati|Saudi|Qatari|Kuwaiti|Omani|Bahraini|UAE|GCC|KSA)\s+(?:nationals?|citizens?)`;
const nationalityPatterns = [
  new RegExp(String.raw`\b(?:only|exclusively)\s+(?:open\s+to\s+|available\s+to\s+|to\s+|for\s+)?${nationals}`, "i"),
  new RegExp(String.raw`\b${nationals}\s+only\b`, "i"),
  /\b(?:Saudization|Emiratization|Emiratisation)\s+(?:role|position|program(?:me)?)\b/i
];
/**
 * Roles reserved for nationals of another country (common for Gulf
 * localization programmes, e.g. "(Emirati National)"), which applicants from
 * Lebanon cannot take. Titles decide; text only when it says "only".
 */
export function nationalityRestriction(title: string, text: string): string | null {
  const inTitle = new RegExp(String.raw`\b${nationals}\b|\b(?:Emirati|Saudi|Qatari|Kuwaiti|Omani|Bahraini)\s+National\b`, "i").exec(title);
  if (inTitle) return clip(`title: ${inTitle[0]}`, 120);
  const sample = text.slice(0, 30_000);
  for (const pattern of nationalityPatterns) { const match = pattern.exec(sample); if (match) return clip(match[0], 120); }
  return null;
}

/**
 * Detects remote listings that, despite a source's country tag, restrict
 * applicants to places that exclude Lebanon. Returns the matched phrase (for
 * the ingestion log) or null when nothing restrictive was found. Conservative:
 * a listing that also names EMEA/the Middle East/Lebanon/worldwide nearby is kept.
 */
export function lebanonRestriction(title: string, text: string, timezones: readonly number[] = []): string | null {
  if (timezones.length && !timezones.some(offset => offset >= 2 && offset <= 3)) return "time zones exclude Lebanon (UTC+2/+3)";
  const nationality = nationalityRestriction(title, text);
  if (nationality) return nationality;
  const titleMatch = titleRestriction.exec(title);
  if (titleMatch && !lebanonStillOpen.test(titleMatch[0])) return clip(`title: ${titleMatch[0]}`, 120);
  const sample = text.slice(0, 30_000);
  for (const pattern of restrictionPatterns) {
    const match = pattern.exec(sample);
    if (!match) continue;
    const nearby = sample.slice(Math.max(0, match.index - 40), match.index + match[0].length + 80);
    if (!lebanonStillOpen.test(nearby)) return clip(match[0], 120);
  }
  return null;
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
