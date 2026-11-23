import { inflateRawSync } from "node:zlib";

// Vercel functions refuse request bodies over 4.5 MB, so the multipart upload must stay below it.
export const CV_FILE_MAX_BYTES = 4 * 1024 * 1024;
export const CV_TEXT_MAX_CHARS = 12000;
const MAX_PDF_PAGES = 8;
const MAX_DOCX_XML_BYTES = 4 * 1024 * 1024;

export class DocumentTextError extends Error {
  constructor(public code: "UNSUPPORTED_FILE" | "UNREADABLE_FILE" | "NO_TEXT", message: string) { super(message); }
}

/** Collapse layout whitespace and cap the text sent to the AI (cost and prompt size). */
export function tidyText(text: string): string {
  return text.replace(/\u0000/g, "").replace(/[ \t\f\v ]+/g, " ").replace(/ *\n[ \n]*/g, "\n").trim().slice(0, CV_TEXT_MAX_CHARS);
}

const isPdf = (bytes: Uint8Array) => bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
const isZip = (bytes: Uint8Array) => bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

export async function pdfText(bytes: Uint8Array): Promise<string> {
  const { getDocumentProxy, extractText } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes, { maxImageSize: 1 });
  try {
    // A CV longer than this is unusual; the limit bounds parsing time.
    if (pdf.numPages > MAX_PDF_PAGES) throw new DocumentTextError("UNREADABLE_FILE", `Use a CV of at most ${MAX_PDF_PAGES} pages.`);
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } finally { await (pdf as unknown as { destroy?: () => Promise<void> }).destroy?.().catch(() => {}); }
}

/** Reads word/document.xml from a .docx (a ZIP) via its central directory, with size limits. */
export function docxText(buffer: Buffer): string {
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new DocumentTextError("UNREADABLE_FILE", "This Word file could not be read.");
  const entries = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  for (let n = 0; n < entries && offset + 46 <= buffer.length; n++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressed = buffer.readUInt32LE(offset + 20);
    const size = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extra = buffer.readUInt16LE(offset + 30);
    const comment = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extra + comment;
    if (name !== "word/document.xml") continue;
    if (size > MAX_DOCX_XML_BYTES || local + 30 > buffer.length || buffer.readUInt32LE(local) !== 0x04034b50) break;
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const data = buffer.subarray(start, start + compressed);
    let xml: string;
    try {
      xml = (method === 0 ? data : method === 8 ? inflateRawSync(data, { maxOutputLength: MAX_DOCX_XML_BYTES }) : Buffer.alloc(0)).toString("utf8");
    } catch { break; }
    return xml
      .replace(/<w:tab\/>/g, " ").replace(/<\/w:p>|<w:br\/>|<w:cr\/>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  }
  throw new DocumentTextError("UNREADABLE_FILE", "This Word file could not be read.");
}

/** Text of an uploaded CV. The file is read in memory only and never stored. */
export async function cvText(file: File): Promise<string> {
  if (!file.size) throw new DocumentTextError("UNSUPPORTED_FILE", "This file is empty. Choose a CV with content.");
  if (file.size > CV_FILE_MAX_BYTES) throw new DocumentTextError("UNSUPPORTED_FILE", "Choose a CV smaller than 4 MB.");
  const buffer = Buffer.from(await file.arrayBuffer());
  let raw: string;
  try {
    if (isPdf(buffer)) raw = await pdfText(new Uint8Array(buffer));
    else if (isZip(buffer) && /\.docx$/i.test(file.name)) raw = docxText(buffer);
    else throw new DocumentTextError("UNSUPPORTED_FILE", "Choose a PDF or Word (.docx) CV.");
  } catch (error) {
    if (error instanceof DocumentTextError) throw error;
    throw new DocumentTextError("UNREADABLE_FILE", "This CV could not be read. Try another PDF or Word file.");
  }
  const text = tidyText(raw);
  // Scanned (image-only) CVs have no text layer; reading images is a later step.
  if (text.length < 80) throw new DocumentTextError("NO_TEXT", "No text was found in this CV. It may be a scanned image. Describe yourself in the box instead.");
  return text;
}
