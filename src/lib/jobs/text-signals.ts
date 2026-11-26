// Pure text signals from job postings: safe to import in the browser and on the server.

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

/** The skills job listings ask for, in a stable order (used for suggestions while typing skills). */
export const JOB_SKILLS: readonly string[] = vocabulary.map(([name]) => name);

export function detectSkills(...texts: string[]): string[] {
  const text = texts.join(" \n ").slice(0, 50_000);
  return vocabulary.filter(([, pattern]) => pattern.test(text)).map(([name]) => name).slice(0, 25);
}

/**
 * Minimum years of experience a listing explicitly asks for, or null. Values
 * above 15 are ignored because they almost always describe the company
 * ("18 years of experience delivering…"), not the candidate.
 */
export function requiredYears(text: string): number | null {
  const found: number[] = [];
  const keep = (value: string) => { const years = Number(value); if (years <= 15) found.push(years); return " "; };
  // Ranges ("4-6 years") count by their lower bound and are removed so "6 years of experience" is not re-read.
  const sample = text.slice(0, 30_000).replace(/\b(\d{1,2})\s*(?:-|–|to)\s*\d{1,2}\s*(?:years?|yrs?)\b/gi, (_, low: string) => keep(low));
  const patterns = [
    /\b(?:at least|minimum(?: of)?|min\.?|over|more than)\s+(\d{1,2})\+?\s*(?:years?|yrs?)\b/gi,
    /\b(\d{1,2})\s*(?:\+|plus)\s*(?:years?|yrs?)\b/gi,
    /\b(\d{1,2})\s*(?:years?|yrs?)\s+(?:of\s+)?(?:[\w-]+\s+){0,4}?experience\b/gi
  ];
  for (const pattern of patterns) for (const match of sample.matchAll(pattern)) keep(match[1]);
  return found.length ? Math.max(...found) : null;
}
