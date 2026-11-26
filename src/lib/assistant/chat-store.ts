// Shared, browser-safe helpers for the assistant's chats: titles, sidebar groups and answer layout.
// The chats themselves are saved to the account (see ./chats.ts and migration 202611260001).

export type ChatMessage = { role: "user" | "assistant"; content: string; test?: boolean };

/** A short title from the first question, cut on a word, like the sidebar of any chat app. */
export function titleFor(messages: readonly ChatMessage[]): string {
  const first = messages.find(message => message.role === "user")?.content.replace(/\s+/g, " ").trim() ?? "";
  if (!first) return "New chat";
  if (first.length <= 46) return first;
  const cut = first.slice(0, 46);
  const space = cut.lastIndexOf(" ");
  return `${(space > 24 ? cut.slice(0, space) : cut).replace(/[\s,.;:!?-]+$/, "")}…`;
}

/** Sidebar groups, newest first: Today, Yesterday, Previous 7 days, Previous 30 days, Older. */
export function groupChats<T extends { updatedAt: number }>(chats: readonly T[], now = Date.now()): { label: string; chats: T[] }[] {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const day = 86400000;
  const start = today.getTime();
  const bands: [string, number][] = [["Today", start], ["Yesterday", start - day], ["Previous 7 days", start - 7 * day], ["Previous 30 days", start - 30 * day], ["Older", -Infinity]];
  const groups = bands.map(([label]) => ({ label, chats: [] as T[] }));
  for (const chat of [...chats].sort((a, b) => b.updatedAt - a.updatedAt)) groups[bands.findIndex(([, from]) => chat.updatedAt >= from)].chats.push(chat);
  return groups.filter(group => group.chats.length);
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
