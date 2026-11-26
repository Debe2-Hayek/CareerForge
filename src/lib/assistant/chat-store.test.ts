import { test } from "node:test";
import assert from "node:assert/strict";
import { boldSpans, chatKey, forgetAllChats, groupChats, MAX_CHATS, parseChats, titleFor, toBlocks, upsertChat, type SavedChat } from "./chat-store";

test("chat titles come from the first question, cut on a word", () => {
  assert.equal(titleFor([]), "New chat");
  assert.equal(titleFor([{ role: "user", content: "What should I learn next?" }]), "What should I learn next?");
  const long = titleFor([{ role: "user", content: "How can I make my profile more convincing to employers in Beirut and abroad?" }]);
  assert.ok(long.endsWith("…") && long.length <= 47, long);
  assert.equal(long.includes("  "), false);
});

test("saved chats are read safely: bad, empty and duplicate entries are dropped", () => {
  assert.deepEqual(parseChats(null), []);
  assert.deepEqual(parseChats("not json"), []);
  assert.deepEqual(parseChats("{}"), []);
  const raw = JSON.stringify([
    { id: "a", updatedAt: 5, messages: [{ role: "user", content: "Hi" }, { role: "assistant", content: "Hello", test: true }, { role: "system", content: "x" }] },
    { id: "a", updatedAt: 9, messages: [{ role: "user", content: "dup" }] },
    { id: "b", updatedAt: 7, messages: [{ role: "user", content: "  " }] },
    { id: "c", updatedAt: 8, messages: [{ role: "user", content: "Newer" }], title: "<b>forged</b>" },
    null, 3
  ]);
  const chats = parseChats(raw);
  assert.deepEqual(chats.map(chat => chat.id), ["c", "a"]);
  assert.equal(chats[0].title, "Newer", "titles are rebuilt, never trusted");
  assert.deepEqual(chats[1].messages, [{ role: "user", content: "Hi" }, { role: "assistant", content: "Hello", test: true }]);
});

test("upserting moves the chat first and keeps the limit", () => {
  let chats: SavedChat[] = [];
  for (let i = 0; i < MAX_CHATS + 5; i++) chats = upsertChat(chats, `c${i}`, [{ role: "user", content: `Q${i}` }], i);
  assert.equal(chats.length, MAX_CHATS);
  assert.equal(chats[0].id, `c${MAX_CHATS + 4}`);
  chats = upsertChat(chats, "c10", [{ role: "user", content: "Q10" }, { role: "assistant", content: "A" }], 1000);
  assert.equal(chats[0].id, "c10");
  assert.equal(chats[0].messages.length, 2);
  assert.equal(upsertChat(chats, "c10", []).some(chat => chat.id === "c10"), false, "an empty chat is removed");
});

test("the sidebar groups chats by day", () => {
  const now = new Date(2026, 10, 26, 15).getTime();
  const at = (days: number) => now - days * 86400000;
  const chats = [at(0), at(1), at(3), at(20), at(90)].map((updatedAt, i) => ({ id: String(i), title: "t", updatedAt, messages: [{ role: "user" as const, content: "q" }] }));
  assert.deepEqual(groupChats(chats, now).map(group => [group.label, group.chats.length]), [["Today", 1], ["Yesterday", 1], ["Previous 7 days", 1], ["Previous 30 days", 1], ["Older", 1]]);
});

test("signing out forgets every saved chat and nothing else", () => {
  const data = new Map([[chatKey("u1"), "[]"], [chatKey("u2"), "[]"], ["careerforge-motion", "off"]]);
  const storage = { get length() { return data.size; }, key: (i: number) => [...data.keys()][i] ?? null, removeItem: (key: string) => { data.delete(key); } };
  forgetAllChats(storage);
  assert.deepEqual([...data.keys()], ["careerforge-motion"]);
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
