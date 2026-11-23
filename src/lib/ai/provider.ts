import type { z } from "zod";

/**
 * Provider boundary for every AI call. Only server code may construct a
 * provider (see ./server.ts); route handlers receive it by injection so tests
 * use a fake and never spend credit.
 */
export type AiRequest = { system: string; user: string; maxTokens: number };
export type AiCompletion = { content: string; model: string };
export type AiProvider = { complete(request: AiRequest): Promise<AiCompletion> };

export class AiError extends Error {
  constructor(public code: "AI_UNAVAILABLE" | "AI_INVALID_OUTPUT" | "AI_TIMEOUT", message: string) { super(message); }
}

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-flash";

type DeepSeekOptions = { apiKey: string; model?: string; timeoutMs?: number; fetchImpl?: typeof fetch };

/** OpenAI-compatible DeepSeek chat client: JSON output, thinking off, bounded time and tokens. */
export function createDeepSeekProvider({ apiKey, model = DEFAULT_MODEL, timeoutMs = 45000, fetchImpl = fetch }: DeepSeekOptions): AiProvider {
  return {
    async complete({ system, user, maxTokens }) {
      let response: Response;
      try {
        response = await fetchImpl(DEEPSEEK_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{ role: "system", content: system }, { role: "user", content: user }],
            response_format: { type: "json_object" },
            thinking: { type: "disabled" },
            temperature: 0,
            max_tokens: maxTokens,
            stream: false
          }),
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store"
        });
      } catch (error) {
        if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) throw new AiError("AI_TIMEOUT", "The AI service took too long to answer.");
        throw new AiError("AI_UNAVAILABLE", "The AI service could not be reached.");
      }
      // Never surface provider bodies: they can echo the prompt or account details.
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        throw new AiError("AI_UNAVAILABLE", `The AI service returned ${response.status}.`);
      }
      const body = await response.json().catch(() => null) as { model?: unknown; choices?: { message?: { content?: unknown }; finish_reason?: unknown }[] } | null;
      const choice = body?.choices?.[0];
      const content = typeof choice?.message?.content === "string" ? choice.message.content : "";
      if (choice?.finish_reason === "length") throw new AiError("AI_INVALID_OUTPUT", "The AI answer was cut off.");
      return { content, model: typeof body?.model === "string" ? body.model.slice(0, 80) : model };
    }
  };
}

/**
 * Ask for JSON that must pass `schema`. DeepSeek may return blank content in
 * JSON mode, so one retry is allowed (report 15.1); a second failure is an error.
 */
export async function completeJson<T>(provider: AiProvider, schema: z.ZodType<T>, request: AiRequest): Promise<{ value: T; model: string }> {
  let last: AiError = new AiError("AI_INVALID_OUTPUT", "The AI answer was not valid.");
  for (let attempt = 0; attempt < 2; attempt++) {
    const user = attempt === 0 ? request.user : `${request.user}\n\nReturn valid JSON only, exactly matching the required shape.`;
    let completion: AiCompletion;
    try { completion = await provider.complete({ ...request, user }); }
    catch (error) {
      if (error instanceof AiError && error.code === "AI_INVALID_OUTPUT") { last = error; continue; }
      throw error;
    }
    let parsed: unknown;
    try { parsed = JSON.parse(completion.content); } catch { continue; }
    const result = schema.safeParse(parsed);
    if (result.success) return { value: result.data, model: completion.model };
  }
  throw last;
}
