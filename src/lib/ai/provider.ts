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

type ChatOptions = { apiKey: string; model?: string; timeoutMs?: number; fetchImpl?: typeof fetch };
type ChatTarget = { url: string; model: string; extra: Record<string, unknown> };

export const DEEPSEEK = { url: "https://api.deepseek.com/chat/completions", model: "deepseek-flash" } as const;
export const OPENROUTER = { url: "https://openrouter.ai/api/v1/chat/completions", model: "deepseek/deepseek-v4.1-flash" } as const;

/** DeepSeek's own API: thinking is turned off with its `thinking` switch. */
export function createDeepSeekProvider({ model = DEEPSEEK.model, ...options }: ChatOptions): AiProvider {
  return chatProvider(options, { url: DEEPSEEK.url, model, extra: { thinking: { type: "disabled" } } });
}

/**
 * DeepSeek models through OpenRouter. Thinking off, only hosts that do not store
 * request data (`data_collection: "deny"`) and that support every parameter sent,
 * cheapest first.
 */
export function createOpenRouterProvider({ model = OPENROUTER.model, ...options }: ChatOptions): AiProvider {
  return chatProvider(options, { url: OPENROUTER.url, model, extra: { reasoning: { effort: "none" }, provider: { data_collection: "deny", require_parameters: true, sort: "price" } } });
}

export type AiProviderInfo = { provider: AiProvider; service: "openrouter" | "deepseek" };

/** Picks the configured service. An OpenRouter key (sk-or-) also works in DEEPSEEK_API_KEY. */
export function providerFromEnv(env: Record<string, string | undefined>, fetchImpl?: typeof fetch): AiProviderInfo | null {
  const model = env.AI_MODEL?.trim();
  const options = { model: model && /^[A-Za-z0-9._:/~-]{1,100}$/.test(model) ? model : undefined, fetchImpl };
  const openRouter = env.OPENROUTER_API_KEY?.trim();
  const deepSeek = env.DEEPSEEK_API_KEY?.trim();
  if (openRouter) return { service: "openrouter", provider: createOpenRouterProvider({ apiKey: openRouter, ...options }) };
  if (deepSeek?.startsWith("sk-or-")) return { service: "openrouter", provider: createOpenRouterProvider({ apiKey: deepSeek, ...options }) };
  if (deepSeek) return { service: "deepseek", provider: createDeepSeekProvider({ apiKey: deepSeek, ...options }) };
  return null;
}

/** OpenAI-compatible chat call: JSON output, bounded time and tokens. */
function chatProvider({ apiKey, timeoutMs = 45000, fetchImpl = fetch }: Omit<ChatOptions, "model">, { url, model, extra }: ChatTarget): AiProvider {
  return {
    async complete({ system, user, maxTokens }) {
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{ role: "system", content: system }, { role: "user", content: user }],
            response_format: { type: "json_object" },
            temperature: 0,
            max_tokens: maxTokens,
            stream: false,
            ...extra
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
      const body = await response.json().catch(() => null) as { model?: unknown; error?: unknown; choices?: { message?: { content?: unknown }; finish_reason?: unknown }[] } | null;
      // OpenRouter can report an upstream failure inside a 200 body.
      if (body?.error) throw new AiError("AI_UNAVAILABLE", "The AI service reported an error.");
      const choice = body?.choices?.[0];
      const content = typeof choice?.message?.content === "string" ? choice.message.content : "";
      if (choice?.finish_reason === "length") throw new AiError("AI_INVALID_OUTPUT", "The AI answer was cut off.");
      return { content, model: typeof body?.model === "string" ? body.model.slice(0, 100) : model };
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
