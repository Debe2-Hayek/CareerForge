import { z } from "zod";
import { compareText, years, type ClaimContext, type FindingResult } from "./evidence-check";

/**
 * Free text check: looks for the claim's facts in the text read from the proof file (PDF text
 * layer or OCR, see document-reader.ts). Plain code, no AI and no credits. Words that are not
 * found are reported as "not found in the text", never as a mismatch: OCR can miss words.
 */
export type TextFinding = { field: "name" | "issuer" | "title" | "dates"; label: string; claim: string; result: Exclude<FindingResult, "mismatch"> };
export type TextCheck = { status: "consistent" | "attention" | "unreadable"; findings: TextFinding[]; numbers: string[] };

export const storedTextSchema = z.object({
  method: z.enum(["pdf_text", "ocr"]), text: z.string(), confidence: z.number().nullable(), readAt: z.string()
});
export type StoredText = z.infer<typeof storedTextSchema>;

const found = (result: FindingResult): TextFinding["result"] => result === "mismatch" ? "missing" : result;

/** Registration or certificate numbers printed on the document, for the reviewer to compare. */
export function certificateNumbers(text: string): string[] {
  const labelled = [...text.matchAll(/\b(?:no|nº|n°|number|num|ref|reference|registration|certificate|serial|id)\.?\s*(?:no\.?|number)?\s*[:#]?\s*([A-Z0-9][A-Z0-9/-]{3,24}[0-9])\b/gi)].map(match => match[1]);
  const coded = [...text.matchAll(/\b[A-Z]{2,6}[-/]\d{2,6}(?:[-/][A-Z0-9]{2,10})+\b/g)].map(match => match[0]);
  return [...new Set([...labelled, ...coded].map(value => value.toUpperCase()).filter(value => /\d/.test(value) && !/^(19|20)\d{2}$/.test(value)))].slice(0, 5);
}

export function checkText(claim: ClaimContext, text: string): TextCheck {
  if (text.replace(/\s/g, "").length < 30) return { status: "unreadable", findings: [], numbers: [] };
  const findings: TextFinding[] = [{ field: "name", label: "Name", claim: claim.ownerName, result: found(compareText(claim.ownerName, text, 1, 0.5)) }];
  if (claim.institution) findings.push({ field: "issuer", label: claim.kind === "employment" ? "Company" : "Institution", claim: claim.institution, result: found(compareText(claim.institution, text, 0.75, 0.4)) });
  findings.push({ field: "title", label: claim.kind === "degree" ? "Degree" : claim.kind === "employment" ? "Job title" : claim.kind === "language" ? "Language" : "Skill or course", claim: claim.title, result: found(compareText(claim.title, text, 0.6, 0.3)) });
  if (claim.kind !== "skill") {
    const key = claim.isCurrent ? years(claim.startDate)[0] : years(claim.endDate)[0];
    const any = [...years(claim.startDate), ...years(claim.endDate)];
    const shown = years(text);
    const label = claim.kind === "language" ? (key ? `Test taken ${key}` : "No test date") : any.length ? `${years(claim.startDate)[0] ?? "?"} – ${claim.isCurrent ? "present" : years(claim.endDate)[0] ?? "?"}` : "No dates";
    findings.push({ field: "dates", label: "Year", claim: label, result: !any.length ? "check" : key && shown.includes(key) ? "match" : any.some(year => shown.includes(year)) ? "check" : "missing" });
  }
  const name = findings[0].result;
  const matches = findings.filter(finding => finding.result === "match").length;
  return { status: name === "match" && matches >= 2 ? "consistent" : "attention", findings, numbers: certificateNumbers(text) };
}
