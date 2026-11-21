import { createHash } from "node:crypto";

const RANGE_ENDPOINT = "https://api.pwnedpasswords.com/range/";
const DEFAULT_TIMEOUT_MS = 3000;
const MAX_RESPONSE_BYTES = 256 * 1024;
const MAX_RESPONSE_LINES = 7000;

export type PasswordRangeFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export type PasswordScreen = (password: string) => Promise<boolean>;

type PasswordScreenOptions = {
  fetchImpl?: PasswordRangeFetch;
  timeoutMs?: number;
};

async function boundedText(response: Response) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error("Password range response is too large");
  }
  if (!response.body) throw new Error("Password range response is empty");

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let total = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Password range response is too large");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

function matchingCount(body: string, suffix: string) {
  const lines = body.split(/\r?\n/);
  if (lines.length > MAX_RESPONSE_LINES) throw new Error("Password range response has too many records");

  let records = 0;
  let matchedCount = 0;
  for (const line of lines) {
    if (!line) continue;
    const match = /^([0-9A-F]{35}):([0-9]{1,15})$/i.exec(line);
    if (!match) throw new Error("Password range response is malformed");
    records++;
    const count = Number(match[2]);
    if (!Number.isSafeInteger(count)) throw new Error("Password range count is invalid");
    if (match[1].toUpperCase() === suffix) matchedCount = Math.max(matchedCount, count);
  }
  if (!records) throw new Error("Password range response has no records");
  return matchedCount;
}

export async function pwnedPasswordCount(password: string, options: PasswordScreenOptions = {}) {
  // SHA-1 is required by the HIBP range protocol and is never used to store the
  // password. Only the first five hash characters leave this server.
  const hash = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await (options.fetchImpl ?? fetch)(`${RANGE_ENDPOINT}${prefix}`, {
      method: "GET",
      headers: {
        Accept: "text/plain",
        "Add-Padding": "true",
        "User-Agent": "CareerForge-Password-Guard/1.0"
      },
      cache: "no-store",
      redirect: "error",
      signal: controller.signal
    });
    if (!response.ok || response.status !== 200) throw new Error("Password range service is unavailable");
    return matchingCount(await boundedText(response), suffix);
  } finally {
    clearTimeout(timeout);
  }
}

export const isPwnedPassword: PasswordScreen = async password => (await pwnedPasswordCount(password)) > 0;
