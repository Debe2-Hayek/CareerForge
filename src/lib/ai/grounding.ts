/**
 * Deterministic anti-fabrication checks (report 15.5): AI output is compared
 * with the applicant's own source text. A fact the source does not contain is
 * removed and reported, never silently "fixed" by another AI call.
 */
const STOPWORDS = new Set(["a", "an", "and", "at", "for", "in", "of", "on", "the", "to", "with", "by", "from", "as", "de", "du", "la", "le", "et"]);

function normalize(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase();
}
/** Words separated by single spaces; keeps "c++", "c#" and "@" recognisable. */
function spaced(text: string): string {
  return normalize(text).replace(/[^\p{L}\p{N}+#@]+/gu, " ").trim();
}
function stem(word: string) { return word.length > 5 ? word.slice(0, 5) : word; }
const MONTHS = [["jan", "january", "janvier"], ["feb", "february", "fevrier"], ["mar", "march", "mars"], ["apr", "april", "avril"], ["may", "mai"], ["jun", "june", "juin"],
  ["jul", "july", "juillet"], ["aug", "august", "aout"], ["sep", "sept", "september", "septembre"], ["oct", "october", "octobre"], ["nov", "november", "novembre"], ["dec", "december", "decembre"]];
const numbersIn = (text: string) => normalize(text).match(/\d+(?:[.,]\d+)?/g) ?? [];

export class SourceText {
  private readonly words: string;
  private readonly compact: string;
  private readonly stems: Set<string>;
  private readonly numbers: Set<string>;
  private readonly raw: string;
  constructor(source: string) {
    this.raw = normalize(source);
    const text = spaced(source);
    this.words = ` ${text} `;
    this.compact = text.replace(/ /g, "");
    this.stems = new Set(text.split(" ").filter(Boolean).map(stem));
    this.numbers = new Set(numbersIn(source));
  }
  /**
   * Names, titles, degrees and skills must appear as the same whole words in
   * the same order: "Lebanese University" is not found in "Lebanese American
   * University", and "Java" is not found in "JavaScript".
   */
  hasPhrase(value: string): boolean {
    const phrase = spaced(value);
    return !!phrase && this.words.includes(` ${phrase} `);
  }
  /** Contact details must appear verbatim, ignoring punctuation and a URL scheme. */
  hasExact(value: string): boolean {
    const joined = spaced(value.trim().replace(/^https?:\/\/(www\.)?/i, "")).replace(/ /g, "");
    return joined.length >= 5 && this.compact.includes(joined);
  }
  /** Rewritten prose: no invented numbers, and most content words come from the source. */
  supportsProse(value: string, minShare = 0.6): boolean {
    if (numbersIn(value).some(number => !this.numbers.has(number))) return false;
    const words = spaced(value).split(" ").filter(word => word.length > 3 && !STOPWORDS.has(word));
    if (!words.length) return true;
    return words.filter(word => this.stems.has(stem(word))).length / words.length >= minShare;
  }
  hasNumber(number: string) { return this.numbers.has(number); }
  /** A month counts only when the text names it ("Sep", "September") or writes it with the year ("09/2020"). */
  hasMonth(year: number, month: number): boolean {
    if (MONTHS[month - 1]?.some(name => this.words.includes(` ${name} `))) return true;
    return new RegExp(`(^|\\D)0?${month}[/.-]${year}(\\D|$)|(^|\\D)${year}[/.-]0?${month}(\\D|$)`).test(this.raw);
  }
}

export type Removed = { field: string; value: string };

/** Applies the checks and records what was removed, for the review screen. */
export class Grounder {
  readonly removed: Removed[] = [];
  constructor(readonly source: SourceText) {}
  private keep(field: string, value: string, ok: (value: string) => boolean): string {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (ok(trimmed)) return trimmed;
    if (!this.removed.some(item => item.field === field && item.value === trimmed)) this.removed.push({ field, value: trimmed.slice(0, 200) });
    return "";
  }
  phrase(field: string, value: string) { return this.keep(field, value, v => this.source.hasPhrase(v)); }
  exact(field: string, value: string) { return this.keep(field, value, v => this.source.hasExact(v)); }
  prose(field: string, value: string, minShare?: number) { return this.keep(field, value, v => this.source.supportsProse(v, minShare)); }
  list(field: string, values: string[]) {
    const kept = values.map(value => this.phrase(field, value)).filter(Boolean);
    return [...new Map(kept.map(value => [value.toLowerCase(), value])).values()];
  }
  /** A free-text period ("2020 - 2024", "2 years") may only use numbers the source contains. */
  period(field: string, value: string) { return this.keep(field, value, v => numbersIn(v).every(n => this.source.hasNumber(n))); }
}
