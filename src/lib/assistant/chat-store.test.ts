import { test } from "node:test";
import assert from "node:assert/strict";
import { boldSpans, groupChats, titleFor, toBlocks, type ChatMessage } from "./chat-store";
import { chatHandlers, type ChatDetail, type ChatStore } from "./chats";
import { assistantHandlers } from "./handlers";
import { chatProviderFromEnv } from "../ai/provider";
import type { AiRunStore } from "../ai/runner";

const ORIGIN = "http://localhost:3000";
const ID = "0b9c8f4e-5a52-4d0e-9a59-3f3b6c1d2e11";

/** An in-memory chat store with the same rules as the database functions. */
function memoryStore(): ChatStore & { rows: Map<string, ChatDetail>; fail: boolean } {
  const rows = new Map<string, ChatDetail>();
  return {
    rows, fail: false,
    async list() { if (this.fail) throw new Error("down"); return [...rows.values()].map(({ id, title, updatedAt }) => ({ id, title, updatedAt })); },
    async get(id) { return rows.get(id) ?? null; },
    async append(id, title, messages) {
      if (this.fail) throw new Error("down");
      const row = rows.get(id);
      rows.set(id, row ? { ...row, messages: [...row.messages, ...messages].slice(-80), updatedAt: Date.now() } : { id, title, updatedAt: Date.now(), messages });
    },
    async rename(id, title) { const row = rows.get(id); if (!row) return false; row.title = title; return true; },
    async remove(id) { if (id === null) { const n = rows.size; rows.clear(); return n; } return rows.delete(id) ? 1 : 0; }
  };
}

test("chat titles come from the first question, cut on a word", () => {
  assert.equal(titleFor([]), "New chat");
  assert.equal(titleFor([{ role: "user", content: "What should I learn next?" }]), "What should I learn next?");
  const long = titleFor([{ role: "user", content: "How can I make my profile more convincing to employers in Beirut and abroad?" }]);
  assert.ok(long.endsWith("…") && long.length <= 47, long);
});

test("the sidebar groups chats by day", () => {
  const now = new Date(2026, 10, 26, 15).getTime();
  const at = (days: number) => now - days * 86400000;
  const chats = [at(0), at(1), at(3), at(20), at(90)].map((updatedAt, i) => ({ id: String(i), updatedAt }));
  assert.deepEqual(groupChats(chats, now).map(group => [group.label, group.chats.length]), [["Today", 1], ["Yesterday", 1], ["Previous 7 days", 1], ["Previous 30 days", 1], ["Older", 1]]);
});

test("answers become paragraphs, lists and headings", () => {
  const blocks = toBlocks("Here is a plan:\n\n1. Learn Docker\n2) Build a project\n\n- **Prove** it\n* Share it\n\n## Next\nKeep going.\nEvery week.");
  assert.deepEqual(blocks, [
    { kind: "p", text: "Here is a plan:" },
    { kind: "ol", items: ["Learn Docker", "Build a project"] },
    { kind: "ul", items: ["**Prove** it", "Share it"] },
    { kind: "h", text: "Next" },
    { kind: "p", text: "Keep going.\nEvery week." }
  ]);
  assert.deepEqual(boldSpans("A **bold** word"), [{ text: "A ", bold: false }, { text: "bold", bold: true }, { text: " word", bold: false }]);
  assert.deepEqual(boldSpans("no ** pair"), [{ text: "no ** pair", bold: false }]);
});

test("each answer is saved to the person's chat with its question; a failed save keeps the answer", async () => {
  const store = memoryStore();
  const runs: AiRunStore = { async reserve() { return { status: "reserved", runId: "r", remaining: 19 }; }, async finish() {} };
  const { POST } = assistantHandlers(async () => ({ runs, chats: store, data: async () => ({ headline: "", location: "", bio: "", skills: [], experience: [], education: [], careers: [] }) }),
    () => chatProviderFromEnv({ AI_FAKE: "1", NODE_ENV: "test" }));
  const ask = (messages: ChatMessage[], chatId?: string) => POST(new Request(`${ORIGIN}/api/v1/assistant`, { method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" },
    body: JSON.stringify({ messages, context: { profile: false, history: false, careers: false }, ...(chatId ? { chatId } : {}) }) }));
  assert.equal((await ask([{ role: "user", content: "Hi" }], "not-a-uuid")).status, 400);
  const first = await (await ask([{ role: "user", content: "What should I learn next?" }], ID)).json() as { saved: boolean; reply: string };
  assert.equal(first.saved, true);
  assert.deepEqual(store.rows.get(ID)?.messages.map(m => m.role), ["user", "assistant"]);
  assert.equal(store.rows.get(ID)?.title, "What should I learn next?");
  assert.equal(store.rows.get(ID)?.messages[1].test, true, "test-AI answers stay marked");
  await ask([{ role: "user", content: "What should I learn next?" }, { role: "assistant", content: first.reply }, { role: "user", content: "And then?" }], ID);
  assert.equal(store.rows.get(ID)?.messages.length, 4, "only the new question and answer are added");
  assert.equal(store.rows.get(ID)?.title, "What should I learn next?", "the title stays");
  store.fail = true;
  const failed = await ask([{ role: "user", content: "Still there?" }], ID);
  assert.equal(failed.status, 200);
  assert.equal((await failed.json() as { saved: boolean }).saved, false);
  store.fail = false;
  assert.equal((await (await ask([{ role: "user", content: "No chat id" }])).json() as { saved: boolean }).saved, false);
});

test("chat endpoints: owner only, same-origin writes, checked ids and names", async () => {
  const store = memoryStore();
  await store.append(ID, "Plan", [{ role: "user", content: "Plan?" }, { role: "assistant", content: "Yes" }]);
  const api = chatHandlers(async () => store);
  const call = (method: string, body?: unknown, origin = ORIGIN) => new Request(`${ORIGIN}/api/v1/assistant/chats`, { method, headers: { Origin: origin, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal((await chatHandlers(async () => null).list(call("GET"))).status, 401);
  assert.deepEqual(((await (await api.list(call("GET"))).json()) as { chats: { id: string }[] }).chats.map(chat => chat.id), [ID]);
  assert.equal((await api.get(call("GET"), "nope")).status, 404);
  assert.equal((await api.get(call("GET"), "11111111-1111-4111-8111-111111111111")).status, 404);
  assert.equal(((await (await api.get(call("GET"), ID)).json()) as { chat: ChatDetail }).chat.messages.length, 2);
  assert.equal((await api.rename(call("PATCH", { title: "Mine" }, "https://evil.example"), ID)).status, 403);
  assert.equal((await api.rename(call("PATCH", { title: "  " }), ID)).status, 400);
  assert.equal((await api.rename(call("PATCH", { title: "x".repeat(121) }), ID)).status, 400);
  assert.equal((await api.rename(call("PATCH", { title: "My plan" }), ID)).status, 200);
  assert.equal(store.rows.get(ID)?.title, "My plan");
  assert.equal((await api.remove(call("DELETE", undefined, "https://evil.example"), ID)).status, 403);
  assert.equal((await api.removeAll(call("DELETE", undefined, "https://evil.example"))).status, 403);
  assert.equal((await api.remove(call("DELETE"), ID)).status, 200);
  assert.equal(store.rows.size, 0);
  store.fail = true;
  assert.equal((await api.list(call("GET"))).status, 503);
});
