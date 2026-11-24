import { createHash } from "node:crypto";
import { pdfText, tidyText } from "../ai/document-text";

/**
 * Fingerprints of one proof file, computed from the stored bytes on the admin side (the
 * fingerprint a user's upload sends can be forged, so it is only compared, never trusted).
 * - sha256: the exact file.
 * - textHash: the words of a PDF, so a re-saved or re-exported copy still matches.
 * - imageHash: a 64-bit difference hash of an image. Calibrated on 23 November 2026: the
 *   same certificate re-saved as JPEG, resized, blurred or cropped 3% is 2 to 7 bits away;
 *   the same design with only the name, date or number edited is 0 to 1 bits away; another
 *   design is about 32 bits away. The review queue flags 10 bits or fewer. Two genuine
 *   diplomas printed on one template also match, which is why the reviewer sees both files.
 */
export type Fingerprint = { sha256: string; textHash: string | null; imageHash: string | null };

export const sha256Hex = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** Lower-case letters and digits only, so layout, fonts and spacing do not matter. */
export function normalizedProofText(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

const ZERO = BigInt(0);
const ONE = BigInt(1);

/** Difference hash from a (width + 1) x height greyscale image, as a signed 64-bit integer string. */
export function differenceHash(pixels: Uint8Array, width = 8, height = 8): string | null {
  let value = ZERO;
  let ones = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const bit = pixels[y * (width + 1) + x] > pixels[y * (width + 1) + x + 1];
      value = (value << ONE) | (bit ? ONE : ZERO);
      if (bit) ones++;
    }
  }
  // A nearly uniform picture (blank page, solid colour) would match every other one.
  if (ones < 4 || ones > width * height - 4) return null;
  return BigInt.asIntN(64, value).toString();
}

export function hashDistance(a: string, b: string): number {
  let x = BigInt.asUintN(64, BigInt(a) ^ BigInt(b));
  let count = 0;
  while (x) { count += Number(x & ONE); x >>= ONE; }
  return count;
}

async function imageHash(bytes: Uint8Array): Promise<string | null> {
  const { default: sharp } = await import("sharp");
  const { data } = await sharp(bytes, { limitInputPixels: 40_000_000, failOn: "none" })
    .rotate().flatten({ background: "#ffffff" }).greyscale()
    .resize(9, 8, { fit: "fill", kernel: "lanczos3" }).raw().toBuffer({ resolveWithObject: true });
  return differenceHash(new Uint8Array(data));
}

export async function fingerprintProof(bytes: Uint8Array, mime: string): Promise<Fingerprint> {
  const sha256 = sha256Hex(bytes);
  if (mime === "application/pdf") {
    // PDF.js may take over the buffer it is given, so it reads a copy.
    const words = normalizedProofText(tidyText(await pdfText(bytes.slice()).catch(() => "")));
    return { sha256, textHash: words.length >= 30 ? sha256Hex(new TextEncoder().encode(words)) : null, imageHash: null };
  }
  return { sha256, textHash: null, imageHash: await imageHash(bytes).catch(() => null) };
}
