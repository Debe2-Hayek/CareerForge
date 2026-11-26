import { z } from "zod";
import { failure, isSameOrigin, json } from "../account/http";
import { readBoundedJson } from "../account/request-body";
import { AiError, type AiProviderInfo } from "../ai/provider";
import { AiLimitError, runAiText, type AiRunStore } from "../ai/runner";
import { ASSISTANT_PROMPT, contextBlock, systemPrompt, type AssistantData } from "./context";
import { titleFor } from "./chat-store";
import type { ChatStore } from "./chats";

const turn = z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }).strict();
export const assistantRequestSchema = z.object({
  messages: z.array(turn).min(1).max(12).refine(list => list.length > 0 && list[list.length - 1].role === "user", { message: "The last message must be the user's." }),
  context: z.object({ profile: z.boolean(), history: z.boolean(), careers: z.boolean() }).strict(),
  chatId: z.string().uuid().optional()
}).strict();
export type AssistantAccess = { data(): Promise<AssistantData>; runs: AiRunStore; chats?: ChatStore };
export const serviceLabel: Record<AiProviderInfo["service"], string> = { openai: "OpenAI", openrouter: "a DeepSeek model through OpenRouter", deepseek: "DeepSeek", fake: "the development test AI" };

/** POST /api/v1/assistant: one reply, using only the context the user chose to share. */
export function assistantHandlers(authorize: () => Promise<AssistantAccess | null>, provider: () => AiProviderInfo | null) {
  async function POST(request: Request) {
    if (!isSameOrigin(request)) return failure("FORBIDDEN", "This request must come from CareerForge.", 403);
    let access: AssistantAccess | null;
    try { access = await authorize(); }
    catch { return failure("AUTH_UNAVAILABLE", "Your session could not be verified. Please try again.", 503); }
    if (!access) return failure("UNAUTHORIZED", "Sign in to use the assistant.", 401);
    const input = assistantRequestSchema.safeParse(await readBoundedJson(request, 40000));
    if (!input.success) return failure("INVALID_INPUT", "Write a message of up to 2,000 characters. Conversations keep the last 12 messages.", 400);
    const info = provider();
    if (!info) return failure("AI_NOT_CONFIGURED", "The assistant is not available right now.", 501);
    try {
      // Context is read on the server from the user's own records, never taken from the browser.
      const context = contextBlock(await access.data(), input.data.context);
      const system = systemPrompt(context);
      const messages = input.data.messages;
      const run = await runAiText(access.runs, info.provider, {
        feature: "assistant_chat", promptVersion: ASSISTANT_PROMPT,
        request: { system, user: messages[messages.length - 1].content, history: messages.slice(-11, -1), maxTokens: 600 },
        cacheKey: [system, JSON.stringify(messages)]
      });
      // The question and its answer are saved to the person's chat on the server, so the answer is kept
      // even if the page closed while it was being written. A failed save never loses the answer itself.
      let saved = false;
      if (input.data.chatId && access.chats) {
        const reply = { role: "assistant" as const, content: run.text, ...(info.service === "fake" ? { test: true as const } : {}) };
        try { await access.chats.append(input.data.chatId, titleFor(messages), [messages[messages.length - 1], reply]); saved = true; } catch { saved = false; }
      }
      return json({ reply: run.text, cached: run.cached, remaining: run.remaining, service: info.service, saved });
    } catch (error) {
      if (error instanceof AiLimitError) {
        const response = failure(error.code, error.message, 429);
        if (error.retryAfter) response.headers.set("Retry-After", String(error.retryAfter));
        return response;
      }
      if (error instanceof AiError) return error.code === "AI_TIMEOUT" ? failure("AI_TIMEOUT", "The assistant took too long. Please try again.", 504) : failure("AI_UNAVAILABLE", "The assistant could not answer right now. Please try again later.", 503);
      return failure("ASSISTANT_UNAVAILABLE", "The assistant could not answer right now. Please try again.", 503);
    }
  }
  return { POST };
}
