// Assistant chats saved to the account (table public.assistant_chats, owner-only; see migration
// 202611260001). Reads go through row-level security; writes through the owner-checked functions.
import { z } from "zod";
import { failure, isSameOrigin, json } from "../account/http";
import { readBoundedJson } from "../account/request-body";
import type { ChatMessage } from "./chat-store";

export type ChatSummary = { id: string; title: string; updatedAt: number };
export type ChatDetail = ChatSummary & { messages: ChatMessage[] };

/** The few database calls the chat features need, so the handlers can be tested without a database. */
export type ChatStore = {
  list(): Promise<ChatSummary[]>;
  get(id: string): Promise<ChatDetail | null>;
  append(id: string, title: string, messages: ChatMessage[]): Promise<void>;
  rename(id: string, title: string): Promise<boolean>;
  remove(id: string | null): Promise<number>;
};

type Rpc = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string } | null }> };
type Rows = { from(table: string): { select(columns: string): any } };

const message = z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(8000), test: z.literal(true).optional() }).strip();
const time = (value: unknown) => { const t = Date.parse(String(value)); return Number.isFinite(t) ? t : 0; };

export function chatStore(client: Rpc & Rows): ChatStore {
  return {
    async list() {
      const { data, error } = await client.from("assistant_chats").select("id,title,updated_at").order("updated_at", { ascending: false }).limit(200);
      if (error) throw new Error("Chats unavailable");
      return (data ?? []).map((row: { id: string; title: string; updated_at: string }) => ({ id: row.id, title: row.title, updatedAt: time(row.updated_at) }));
    },
    async get(id) {
      const { data, error } = await client.from("assistant_chats").select("id,title,updated_at,messages").eq("id", id).maybeSingle();
      if (error) throw new Error("Chat unavailable");
      if (!data) return null;
      const messages = Array.isArray(data.messages) ? data.messages.flatMap((item: unknown) => { const parsed = message.safeParse(item); return parsed.success ? [parsed.data] : []; }) : [];
      return { id: data.id, title: data.title, updatedAt: time(data.updated_at), messages };
    },
    async append(id, title, messages) {
      const { error } = await client.rpc("append_assistant_chat", { p_id: id, p_title: title, p_messages: messages });
      if (error) throw new Error("Chat not saved");
    },
    async rename(id, title) {
      const { error } = await client.rpc("rename_assistant_chat", { p_id: id, p_title: title });
      if (error?.code === "P0002") return false;
      if (error) throw new Error("Chat not renamed");
      return true;
    },
    async remove(id) {
      const { data, error } = await client.rpc("delete_assistant_chats", { p_id: id });
      if (error) throw new Error("Chat not deleted");
      return typeof data === "number" ? data : 0;
    }
  };
}

const uuid = z.string().uuid();
const renameSchema = z.object({ title: z.string().trim().min(1).max(120) }).strict();

/** GET/DELETE /api/v1/assistant/chats and GET/PATCH/DELETE /api/v1/assistant/chats/:id, owner only. */
export function chatHandlers(authorize: () => Promise<ChatStore | null>) {
  async function access(request: Request, write: boolean) {
    if (write && !isSameOrigin(request)) return failure("FORBIDDEN", "This request must come from CareerForge.", 403);
    try { return (await authorize()) ?? failure("UNAUTHORIZED", "Sign in to see your chats.", 401); }
    catch { return failure("AUTH_UNAVAILABLE", "Your session could not be verified. Please try again.", 503); }
  }
  const unavailable = () => failure("CHATS_UNAVAILABLE", "Your chats could not be reached. Please try again.", 503);
  return {
    async list(request: Request) {
      const store = await access(request, false);
      if (store instanceof Response) return store;
      try { return json({ chats: await store.list() }); } catch { return unavailable(); }
    },
    async removeAll(request: Request) {
      const store = await access(request, true);
      if (store instanceof Response) return store;
      try { return json({ removed: await store.remove(null) }); } catch { return unavailable(); }
    },
    async get(request: Request, id: string) {
      if (!uuid.safeParse(id).success) return failure("NOT_FOUND", "This chat does not exist.", 404);
      const store = await access(request, false);
      if (store instanceof Response) return store;
      try { const chat = await store.get(id); return chat ? json({ chat }) : failure("NOT_FOUND", "This chat does not exist.", 404); } catch { return unavailable(); }
    },
    async rename(request: Request, id: string) {
      if (!uuid.safeParse(id).success) return failure("NOT_FOUND", "This chat does not exist.", 404);
      const store = await access(request, true);
      if (store instanceof Response) return store;
      const input = renameSchema.safeParse(await readBoundedJson(request, 2000));
      if (!input.success) return failure("INVALID_INPUT", "A chat name has 1 to 120 characters.", 400);
      try { return (await store.rename(id, input.data.title)) ? json({ title: input.data.title }) : failure("NOT_FOUND", "This chat does not exist.", 404); } catch { return unavailable(); }
    },
    async remove(request: Request, id: string) {
      if (!uuid.safeParse(id).success) return failure("NOT_FOUND", "This chat does not exist.", 404);
      const store = await access(request, true);
      if (store instanceof Response) return store;
      try { return json({ removed: await store.remove(id) }); } catch { return unavailable(); }
    }
  };
}
