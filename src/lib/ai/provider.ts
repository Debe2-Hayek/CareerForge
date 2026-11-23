import type { z } from "zod";

/**
 * Provider boundary for every AI call. Only server code may construct a
 * provider (see ./server.ts); route handlers receive it by injection so tests
 * use a fake and never spend credit.
 */
/** images: data URLs (image/png or image/jpeg) sent with the user message, for document reading. */
export type ChatTurn = { role: "user" | "assistant"; content: string };
/** json (default true) asks for a JSON object; history holds earlier turns of a conversation. */
export type AiRequest = { system: string; user: string; maxTokens: number; images?: string[]; json?: boolean; history?: ChatTurn[] };
export type AiCompletion = { content: string; model: string };
export type AiProvider = { complete(request: AiRequest): Promise<AiCompletion> };

export class AiError extends Error {
  constructor(public code: "AI_UNAVAILABLE" | "AI_INVALID_OUTPUT" | "AI_TIMEOUT", message: string) { super(message); }
}

type ChatOptions = { apiKey: string; model?: string; timeoutMs?: number; fetchImpl?: typeof fetch };
type ChatTarget = { url: string; model: string; extra: Record<string, unknown>; tokenParam?: "max_tokens" | "max_completion_tokens"; temperature?: boolean };

export const DEEPSEEK = { url: "https://api.deepseek.com/chat/completions", model: "deepseek-flash" } as const;
export const OPENROUTER = { url: "https://openrouter.ai/api/v1/chat/completions", model: "deepseek/deepseek-v4.1-flash" } as const;
/** OpenAI's lowest-cost current model (developers.openai.com, 23 November 2026); override with OPENAI_MODEL. */
export const OPENAI = { url: "https://api.openai.com/v1/chat/completions", model: "gpt-6-luna" } as const;

/** OpenAI: current models take max_completion_tokens; temperature is left at the default because support is not documented for every model. */
export function createOpenAIProvider({ model = OPENAI.model, ...options }: ChatOptions): AiProvider {
  return chatProvider(options, { url: OPENAI.url, model, extra: {}, tokenParam: "max_completion_tokens", temperature: false });
}

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

export type AiProviderInfo = { provider: AiProvider; service: "openrouter" | "deepseek" | "openai" | "fake" };

/** Picks the configured service. An OpenRouter key (sk-or-) also works in DEEPSEEK_API_KEY. */
export function providerFromEnv(env: Record<string, string | undefined>, fetchImpl?: typeof fetch): AiProviderInfo | null {
  const model = env.AI_MODEL?.trim();
  const options = { model: model && /^[A-Za-z0-9._:/~-]{1,100}$/.test(model) ? model : undefined, fetchImpl };
  // Development-only stand-in so screens can be tried without credits. Never in production or on Vercel.
  if (env.AI_FAKE === "1" && env.NODE_ENV !== "production" && !env.VERCEL) return { service: "fake", provider: createFakeProvider() };
  const openRouter = env.OPENROUTER_API_KEY?.trim();
  const deepSeek = env.DEEPSEEK_API_KEY?.trim();
  if (openRouter) return { service: "openrouter", provider: createOpenRouterProvider({ apiKey: openRouter, ...options }) };
  if (deepSeek?.startsWith("sk-or-")) return { service: "openrouter", provider: createOpenRouterProvider({ apiKey: deepSeek, ...options }) };
  if (deepSeek) return { service: "deepseek", provider: createDeepSeekProvider({ apiKey: deepSeek, ...options }) };
  return null;
}

/**
 * The chat assistant prefers OpenAI (OPENAI_API_KEY, or the local OpenAI_KEY name) and falls
 * back to the general provider, so it works with whichever key is configured.
 */
export function chatProviderFromEnv(env: Record<string, string | undefined>, fetchImpl?: typeof fetch): AiProviderInfo | null {
  if (env.AI_FAKE === "1" && env.NODE_ENV !== "production" && !env.VERCEL) return { service: "fake", provider: createFakeProvider() };
  const key = (env.OPENAI_API_KEY ?? env.OpenAI_KEY)?.trim();
  const model = env.OPENAI_MODEL?.trim();
  if (key) return { service: "openai", provider: createOpenAIProvider({ apiKey: key, model: model && /^[A-Za-z0-9._:-]{1,100}$/.test(model) ? model : undefined, fetchImpl }) };
  return providerFromEnv(env, fetchImpl);
}

/** OpenAI-compatible chat call: JSON output by default, bounded time and tokens. */
function chatProvider({ apiKey, timeoutMs = 45000, fetchImpl = fetch }: Omit<ChatOptions, "model">, { url, model, extra, tokenParam = "max_tokens", temperature = true }: ChatTarget): AiProvider {
  return {
    async complete({ system, user, maxTokens, images = [], json = true, history = [] }) {
      const userContent = images.length ? [{ type: "text", text: user }, ...images.map(url => ({ type: "image_url", image_url: { url } }))] : user;
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{ role: "system", content: system }, ...history.map(turn => ({ role: turn.role, content: turn.content })), { role: "user", content: userContent }],
            ...(json ? { response_format: { type: "json_object" } } : {}),
            ...(temperature ? { temperature: json ? 0 : 0.4 } : {}),
            [tokenParam]: maxTokens,
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

/**
 * Development "test AI": answers in the right shape without any network call, so flows
 * can be clicked through before credits exist. Its model name is "careerforge-test-ai",
 * which the screens label as a test result.
 */
export function createFakeProvider(): AiProvider {
  return {
    async complete({ system, user }) {
      const model = "careerforge-test-ai";
      if (/proof document/i.test(system)) {
        return { model, content: JSON.stringify({ readable: true, documentType: "diploma", personName: "Rana Haddad", issuer: "Lebanese American University", title: "Bachelor of Engineering in Computer Engineering", issueDate: "June 2020", startDate: "", endDate: "2020", certificateId: "LAU-2020-04417", verificationUrl: "", notes: ["Test AI: this reading is invented for development."] }) };
      }
      if (/You are CareerForge's career assistant/i.test(system)) {
        const shared = [...system.matchAll(/^## (.+)$/gm)].map(match => match[1]);
        return { model, content: `Test AI: you asked "${user.slice(0, 80)}". I can see: ${shared.join(", ") || "nothing from your profile"}. A good next step is to prove a skill at /skill-checks.` };
      }
      if (/interview a student about a software project/i.test(system)) {
        const paths = [...user.matchAll(/<file path="([^"]+)">/g)].map(match => match[1]);
        const questions = [0, 1, 2, 3].map(n => ({ file: paths[n % Math.max(1, paths.length)] ?? "", startLine: 1 + n * 2, endLine: 4 + n * 2, question: `Test AI question ${n + 1}: why does this part of the code work the way it does?` }));
        return { model, content: JSON.stringify({ questions }) };
      }
      if (/judge whether a student understands code/i.test(system)) {
        const items = [...user.matchAll(/<item id="(q\d)">[\s\S]*?Student answer: ([\s\S]*?)\n<\/item>/g)];
        return { model, content: JSON.stringify({ scores: items.map(([, id, answer]) => ({ id, score: answer.trim().length > 60 ? 2 : answer.trim().length > 15 ? 1 : 0, reason: "Test AI: scored by answer length only." })) }) };
      }
      if (/careful career coach for CareerForge/i.test(system)) {
        let facts: { career?: string; criticalGaps?: string[]; importantGaps?: string[] } = {};
        try { facts = JSON.parse(user.slice(user.indexOf("{"), user.lastIndexOf("}") + 1)); } catch { /* keep defaults */ }
        const gaps = [...(facts.criticalGaps ?? []), ...(facts.importantGaps ?? [])];
        return { model, content: JSON.stringify({
          summary: `Test AI: here is where you stand for ${facts.career ?? "this career"}.`,
          // The last priority is invented on purpose so the guard can be seen removing it.
          priorities: [...gaps.slice(0, 2).map(topic => ({ topic, why: "Test AI: this is a foundation for the role." })), { topic: "Quantum basket weaving", why: "Invented." }]
        }) };
      }
      if (/careful career adviser for CareerForge/i.test(system)) {
        let facts: { matchedSkills?: string[]; missingSkills?: string[]; job?: { title?: string } } = {};
        try { facts = JSON.parse(user.replace(/^<analysis>\n|\n<\/analysis>$/g, "")); } catch { /* keep defaults */ }
        const matched = facts.matchedSkills ?? [];
        const missing = facts.missingSkills ?? [];
        return { model, content: JSON.stringify({
          summary: `Test AI: you already bring ${matched.slice(0, 2).join(" and ") || "a starting point"} for this ${facts.job?.title ?? "role"}.`,
          strengths: matched.slice(0, 2).map(skill => `Your ${skill} skill is listed for this job.`),
          gaps: missing.slice(0, 2).map(skill => ({ item: skill, suggestion: `Test AI: build a small project that uses ${skill}.` })),
          // Deliberately unsafe tip so the guard can be seen removing it in development.
          cvTips: ["Lead with the project that is closest to this job.", ...(missing[0] ? [`List ${missing[0]} among your skills.`] : [])]
        }) };
      }
      if (/multiple-choice questions for CareerForge skill checks/i.test(system)) {
        const skill = user.match(/<skill>([^<]{1,60})<\/skill>/)?.[1] ?? "this skill";
        const questions = [0, 1, 2, 3, 4].map(n => ({
          prompt: `Test AI question ${n + 1} about ${skill}: which option is the correct one?`,
          options: ["Option A (test)", "Option B (test)", "Option C (test)"], answer: [1, 2, 0, 2, 1][n],
          explanation: "Test AI: invented for development."
        }));
        return { model, content: JSON.stringify({ questions }) };
      }
      // Autofill and builder: echo the first line of the source as a name; grounding removes the rest.
      const first = user.replace(/<\/?\w+>/g, "").trim().split(/\n|,|\./)[0]?.trim().slice(0, 60) ?? "";
      return { model, content: JSON.stringify({ name: first, headline: "", location: "", summary: "", education: [], experience: [], skills: [], projects: [], languages: [] }) };
    }
  };
}
