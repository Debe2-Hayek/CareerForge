import "server-only";
import { tmpdir } from "node:os";
import { pdfText, tidyText } from "../ai/document-text";

/**
 * Reads the text of a proof file on CareerForge's own server, for free and without sending
 * the file anywhere: a PDF's text layer when it has one, otherwise OCR with Tesseract
 * (tesseract.js, Apache-2.0) in English, French and Arabic. Only Tesseract's language data
 * is downloaded (once per server instance, cached in the temp folder).
 *
 * Chosen on 24 November 2026 over Hugging Face options for this task: in-process
 * transformers.js OCR models are line-only (TrOCR) or too heavy for a serverless function
 * (Florence-2), and the hosted Inference API would send private diplomas to a third party.
 * Measured: clean scans, a blurred and tilted photo, and an Arabic/French certificate were read
 * word for word in about 0.3 s each after a 1–2 s first load.
 */
export type ReadMethod = "pdf_text" | "ocr";
export type ReadResult = { method: ReadMethod; text: string; confidence: number | null };

const LANGUAGES = "eng+fra+ara";
const MAX_TEXT = 20000;
const MAX_PAGES = 3;

async function ocr(images: Buffer[]): Promise<{ text: string; confidence: number | null }> {
  if (!images.length) return { text: "", confidence: null };
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(LANGUAGES, 1, { cachePath: tmpdir() });
  try {
    const texts: string[] = [];
    const confidences: number[] = [];
    for (const image of images) {
      const { data } = await worker.recognize(image);
      texts.push(data.text);
      confidences.push(data.confidence);
    }
    return { text: texts.join("\n"), confidence: Math.round(confidences.reduce((sum, value) => sum + value, 0) / confidences.length) };
  } finally { await worker.terminate().catch(() => {}); }
}

/** Upright, greyscale, about 2,000 px wide: what Tesseract reads best. */
async function prepare(input: Buffer | { data: Uint8ClampedArray | Uint8Array; width: number; height: number; channels: 1 | 3 | 4 }): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  const source = Buffer.isBuffer(input) ? sharp(input, { limitInputPixels: 40_000_000, failOn: "none" })
    : sharp(Buffer.from(input.data), { raw: { width: input.width, height: input.height, channels: input.channels } });
  const meta = await source.metadata();
  const width = meta.autoOrient?.width ?? meta.width ?? 2000;
  return source.rotate().flatten({ background: "#ffffff" }).greyscale()
    .resize({ width: Math.min(2400, Math.max(1600, width)), withoutEnlargement: width >= 1600 }).normalise().png().toBuffer();
}

/** Images embedded in a scanned PDF (one per page, usually), first pages only. */
async function scannedPages(bytes: Uint8Array): Promise<Buffer[]> {
  const { getDocumentProxy, extractImages } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes.slice());
  try {
    const pages: Buffer[] = [];
    for (let page = 1; page <= Math.min(pdf.numPages, MAX_PAGES); page++) {
      const images = await extractImages(pdf, page).catch(() => []);
      // The largest image on the page is the scan.
      const scan = [...images].sort((a, b) => b.width * b.height - a.width * a.height)[0];
      if (scan && scan.width >= 300 && scan.height >= 200) pages.push(await prepare({ data: scan.data, width: scan.width, height: scan.height, channels: 4 }));
    }
    return pages;
  } finally { await (pdf as unknown as { destroy?: () => Promise<void> }).destroy?.().catch(() => {}); }
}

export async function readProof(bytes: Uint8Array, mime: string): Promise<ReadResult> {
  if (mime === "application/pdf") {
    const layer = tidyText(await pdfText(bytes.slice()).catch(() => ""));
    if (layer.replace(/\s/g, "").length >= 30) return { method: "pdf_text", text: layer.slice(0, MAX_TEXT), confidence: null };
    const read = await ocr(await scannedPages(bytes).catch(() => []));
    return { method: "ocr", text: tidyText(read.text).slice(0, MAX_TEXT), confidence: read.confidence };
  }
  const read = await ocr([await prepare(Buffer.from(bytes))]);
  return { method: "ocr", text: tidyText(read.text).slice(0, MAX_TEXT), confidence: read.confidence };
}
