export class SourceError extends Error {
  constructor(public code: "HOST_NOT_ALLOWED" | "TIMEOUT" | "RATE_LIMITED" | "HTTP_ERROR" | "TOO_LARGE" | "NOT_JSON" | "UNEXPECTED_TYPE" | "NETWORK", message: string, public retryAfterSeconds?: number) {
    super(message);
  }
}

export type FetchJson = (url: string, headers?: Record<string, string>) => Promise<unknown>;
export type FetchText = (url: string, headers?: Record<string, string>) => Promise<string>;
type TextOptions = { timeoutMs?: number; maxBytes?: number; fetchImpl?: typeof fetch; accept?: RegExp; userAgent?: string };

/**
 * Fetches text from a configured host only: HTTPS, no redirects (a redirect to
 * another host could reach private networks), bounded time and body size.
 */
export function boundedFetchText(allowedHosts: readonly string[], { timeoutMs = 15_000, maxBytes = 6_000_000, fetchImpl = fetch, accept = /json/i, userAgent = "CareerForge-JobIngest/1.0 (student career platform)" }: TextOptions = {}): FetchText {
  const unexpected = accept.source === "json" ? "NOT_JSON" as const : "UNEXPECTED_TYPE" as const;
  return async (target, headers = {}) => {
    const url = new URL(target);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || !allowedHosts.some(allowed => host === allowed || host.endsWith(`.${allowed}`))) {
      throw new SourceError("HOST_NOT_ALLOWED", `Refusing to fetch unconfigured host ${host}`);
    }
    let response: Response;
    try {
      response = await fetchImpl(url, {
        redirect: "error", signal: AbortSignal.timeout(timeoutMs),
        headers: { Accept: unexpected === "NOT_JSON" ? "application/json" : "text/calendar, text/plain;q=0.5", "User-Agent": userAgent, ...headers }
      });
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) throw new SourceError("TIMEOUT", `Timed out after ${timeoutMs}ms`);
      throw new SourceError("NETWORK", "Network request failed or was redirected");
    }
    if (response.status === 429) {
      const wait = Number(response.headers.get("retry-after"));
      await response.body?.cancel().catch(() => {});
      throw new SourceError("RATE_LIMITED", "Source rate limit reached", Number.isFinite(wait) && wait > 0 ? wait : undefined);
    }
    if (!response.ok) { await response.body?.cancel().catch(() => {}); throw new SourceError("HTTP_ERROR", `Source responded ${response.status}`); }
    if (!accept.test(response.headers.get("content-type") ?? "")) { await response.body?.cancel().catch(() => {}); throw new SourceError(unexpected, unexpected === "NOT_JSON" ? "Source did not return JSON" : "Source returned an unexpected content type"); }
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) { await response.body?.cancel().catch(() => {}); throw new SourceError("TOO_LARGE", "Source response exceeds the size limit"); }
    const reader = response.body?.getReader();
    if (!reader) throw new SourceError(unexpected, "Source returned an empty body");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel().catch(() => {}); throw new SourceError("TOO_LARGE", "Source response exceeds the size limit"); }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  };
}

/** The same limits for sources that must return JSON. */
export function boundedFetchJson(allowedHosts: readonly string[], options: Omit<TextOptions, "accept" | "userAgent"> = {}): FetchJson {
  const fetchText = boundedFetchText(allowedHosts, options);
  return async (target, headers) => {
    const body = await fetchText(target, headers);
    try { return JSON.parse(body); }
    catch { throw new SourceError("NOT_JSON", "Source returned malformed JSON"); }
  };
}
