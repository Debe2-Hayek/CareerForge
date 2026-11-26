// Saved assistant chats. They live only in this browser (localStorage), under a key for the signed-in
// account, so another person signing in on the same computer never sees them; signing out deletes them.
// Everything read back is checked, because anything in localStorage may be old, partial or edited.

export type ChatMessage = { role: "user" | "assistant"; content: string; test?: boolean };
export type SavedChat = { id: string; title: string; updatedAt: number; messages: ChatMessage[] };

export const CHAT_PREFIX = "careerforge-chats:";
export const MAX_CHATS = 40;
export const MAX_MESSAGES = 80;
const MAX_TEXT = 8000;

export const chatKey = (userId: string) => `${CHAT_PREFIX}${userId}`;

/** A short title from the first question, cut on a word, like the sidebar of any chat app. */
export function titleFor(messages: readonly ChatMessage[]): string {
  const first = messages.find(message => message.role === "user")?.content.replace(/\s+/g, " ").trim() ?? "";
  if (!first) return "New chat";
  if (first.length <= 46) return first;
  const cut = first.slice(0, 46);
  const space = cut.lastIndexOf(" ");
  return `${(space > 24 ? cut.slice(0, space) : cut).replace(/[\s,.;:!?-]+$/, "")}…`;
}

function cleanMessage(value: unknown): ChatMessage | null {
  if (!value || typeof value !== "object") return null;
  const { role, content, test } = value as Record<string, unknown>;
  if ((role !== "user" && role !== "assistant") || typeof content !== "string" || !content.trim()) return null;
  return { role, content: content.slice(0, MAX_TEXT), ...(test === true ? { test: true } : {}) };
}

/** Reads saved chats safely: bad entries are dropped, newest first, within the limits. */
export function parseChats(raw: string | null): SavedChat[] {
  if (!raw) return [];
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(data)) return [];
  const chats: SavedChat[] = [];
  const seen = new Set<string>();
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const { id, updatedAt, messages } = item as Record<string, unknown>;
    if (typeof id !== "string" || !id || seen.has(id) || !Array.isArray(messages)) continue;
    const kept = messages.map(cleanMessage).filter((message): message is ChatMessage => message !== null).slice(-MAX_MESSAGES);
    if (!kept.length) continue;
    seen.add(id);
    chats.push({ id, title: titleFor(kept), updatedAt: typeof updatedAt === "number" && Number.isFinite(updatedAt) ? updatedAt : 0, messages: kept });
  }
  return chats.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CHATS);
}

/** Puts a chat first with its new messages (the oldest chats fall off past the limit). */
export function upsertChat(chats: readonly SavedChat[], id: string, messages: readonly ChatMessage[], now = Date.now()): SavedChat[] {
  const kept = messages.slice(-MAX_MESSAGES);
  const rest = chats.filter(chat => chat.id !== id);
  if (!kept.length) return rest;
  return [{ id, title: titleFor(kept), updatedAt: now, messages: [...kept] }, ...rest].slice(0, MAX_CHATS);
}

/** Sidebar groups, newest first: Today, Yesterday, Previous 7 days, Previous 30 days, Older. */
export function groupChats(chats: readonly SavedChat[], now = Date.now()): { label: string; chats: SavedChat[] }[] {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const day = 86400000;
  const start = today.getTime();
  const bands: [string, number][] = [["Today", start], ["Yesterday", start - day], ["Previous 7 days", start - 7 * day], ["Previous 30 days", start - 30 * day], ["Older", -Infinity]];
  const groups = bands.map(([label]) => ({ label, chats: [] as SavedChat[] }));
  for (const chat of [...chats].sort((a, b) => b.updatedAt - a.updatedAt)) groups[bands.findIndex(([, from]) => chat.updatedAt >= from)].chats.push(chat);
  return groups.filter(group => group.chats.length);
}

/** Deletes every saved chat in this browser (used when signing out). */
export function forgetAllChats(storage: Pick<Storage, "length" | "key" | "removeItem"> | undefined = typeof window === "undefined" ? undefined : window.localStorage) {
  if (!storage) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) { const key = storage.key(i); if (key?.startsWith(CHAT_PREFIX)) keys.push(key); }
    keys.forEach(key => storage.removeItem(key));
  } catch { /* storage blocked: nothing was saved */ }
}

export type Block = { kind: "p"; text: string } | { kind: "ul" | "ol"; items: string[] } | { kind: "h"; text: string };

/** Turns a plain-text answer into paragraphs, lists and small headings (no HTML is ever produced). */
export function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => { if (paragraph.length) { blocks.push({ kind: "p", text: paragraph.join("\n") }); paragraph = []; } };
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    const bullet = /^(?:[-*•]|–)\s+(.+)$/.exec(line);
    const numbered = /^\d{1,2}[.)]\s+(.+)$/.exec(line);
    const heading = /^#{1,4}\s+(.+)$/.exec(line);
    if (!line) { flush(); continue; }
    if (heading) { flush(); blocks.push({ kind: "h", text: heading[1] }); continue; }
    const item = bullet?.[1] ?? numbered?.[1];
    if (item) {
      flush();
      const kind = bullet ? "ul" : "ol";
      const last = blocks.at(-1);
      if (last && last.kind === kind) last.items.push(item);
      else blocks.push({ kind, items: [item] });
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return blocks;
}

/** Splits **bold** spans out of a line of text. */
export function boldSpans(text: string): { text: string; bold: boolean }[] {
  const out: { text: string; bold: boolean }[] = [];
  let last = 0;
  for (const match of text.matchAll(/\*\*([^*\n]+)\*\*/g)) {
    if (match.index! > last) out.push({ text: text.slice(last, match.index), bold: false });
    out.push({ text: match[1], bold: true });
    last = match.index! + match[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), bold: false });
  return out;
}
