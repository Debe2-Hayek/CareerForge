"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { linkify, type ContextChoice } from "@/lib/assistant/context";
import { boldSpans, groupChats, titleFor, toBlocks, type ChatMessage } from "@/lib/assistant/chat-store";
import type { ChatDetail, ChatSummary } from "@/lib/assistant/chats";
import { AppIcon, type IconName } from "./app-icons";
import { AiClover } from "./ai-clover";

const STARTERS: { text: string; hint: string; icon: IconName }[] = [
  { text: "Which career fits me best, and why?", hint: "Compares your profile with the career paths", icon: "compass" },
  { text: "What should I learn next?", hint: "Turns your gaps into a short plan", icon: "roadmap" },
  { text: "How can I make my profile more convincing to employers?", hint: "Proof, wording and what to add", icon: "profile" },
  { text: "Which of my skills should I prove first?", hint: "The checks that help you most", icon: "checks" }
];
const CONTEXT_LABELS: Record<keyof ContextChoice, { label: string; detail: string }> = {
  profile: { label: "Profile & skills", detail: "Headline, about you, skills and their trust badges" },
  history: { label: "Work & education", detail: "Your jobs and degrees with dates" },
  careers: { label: "Career matches", detail: "Your three closest careers and scores" }
};
const MAX = 2000;
const newId = () => crypto.randomUUID();
const chatUrl = (id: string | null) => id ? `/career-assistant?chat=${id}` : "/career-assistant";

/** One line of an answer: CareerForge page links become chips, **bold** stays bold. */
function Inline({ text }: { text: string }) {
  return <>{linkify(text).map((segment, i) => "href" in segment
    ? <Link key={i} href={segment.href} className="assistant-link">{segment.label}</Link>
    : <Fragment key={i}>{boldSpans(segment.text).map((part, j) => part.bold ? <strong key={j}>{part.text}</strong> : <Fragment key={j}>{part.text}</Fragment>)}</Fragment>)}</>;
}

/** An answer laid out as paragraphs, lists and headings, never as raw HTML. */
function Reply({ text }: { text: string }) {
  const blocks = useMemo(() => toBlocks(text), [text]);
  return <div className="chat-answer">{blocks.map((block, i): ReactNode => {
    if (block.kind === "h") return <h3 key={i}><Inline text={block.text} /></h3>;
    if (block.kind === "p") return <p key={i}><Inline text={block.text} /></p>;
    const List = block.kind;
    return <List key={i}>{block.items.map((item, j) => <li key={j}><Inline text={item} /></li>)}</List>;
  })}</div>;
}

/** The assistant's mark: the clover (it turns slowly when live and breathes while thinking). */
function Orb({ size = "small", thinking = false, live = false }: { size?: "small" | "large"; thinking?: boolean; live?: boolean }) {
  return <span className={`ai-orb ai-orb-${size}${thinking ? " is-thinking" : ""}`} aria-hidden="true">
    <AiClover size={size === "large" ? 120 : 26} live={size === "large" || live || thinking} thinking={thinking} />
  </span>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard unavailable: nothing to do */ }
  }
  return <button type="button" className="chat-copy" onClick={copy} aria-label={copied ? "Copied" : "Copy answer"}>
    <svg viewBox="0 0 24 24" aria-hidden="true">{copied ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>}</svg>
    {copied ? "Copied" : "Copy"}
  </button>;
}

const Icon = {
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  trash: <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />,
  pen: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h10" />,
  compose: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>
};
const Svg = ({ name }: { name: keyof typeof Icon }) => <svg viewBox="0 0 24 24" aria-hidden="true">{Icon[name]}</svg>;

type Props = { service: string | null; firstName?: string; initialChats: ChatSummary[]; initialChat: ChatDetail | null; historyAvailable: boolean };

export function CareerAssistant({ service, firstName = "", initialChats, initialChat, historyAvailable }: Props) {
  const [choice, setChoice] = useState<ContextChoice>({ profile: true, history: true, careers: false });
  const [chats, setChats] = useState<ChatSummary[]>(initialChats);
  const [cache, setCache] = useState<Record<string, ChatMessage[]>>(() => initialChat ? { [initialChat.id]: initialChat.messages } : {});
  const [activeId, setActiveId] = useState(() => initialChat?.id ?? newId());
  const [opening, setOpening] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [reused, setReused] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const thread = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const activeRef = useRef(activeId);
  const busyRef = useRef(busyId);
  const chatsRef = useRef(chats);
  useEffect(() => { activeRef.current = activeId; busyRef.current = busyId; chatsRef.current = chats; }, [activeId, busyId, chats]);

  const messages = useMemo(() => cache[activeId] ?? [], [cache, activeId]);
  const shownChats = useMemo(() => { const q = query.trim().toLowerCase(); return q ? chats.filter(chat => chat.title.toLowerCase().includes(q)) : chats; }, [chats, query]);
  const groups = useMemo(() => groupChats(shownChats), [shownChats]);
  const busy = busyId !== null;
  const thinkingHere = busyId === activeId;
  const loadingHere = opening === activeId;
  const setMessages = useCallback((id: string, next: ChatMessage[]) => setCache(current => ({ ...current, [id]: next })), []);

  // Each chat has its own address (?chat=…), so a refresh or the back button returns to it.
  const remember = useCallback((id: string | null) => { if (typeof window !== "undefined") window.history.replaceState(window.history.state, "", chatUrl(id)); }, []);

  useEffect(() => { if (window.matchMedia("(min-width: 900px)").matches) input.current?.focus(); }, []);

  const fetchChat = useCallback(async (id: string) => {
    const response = await fetch(`/api/v1/assistant/chats/${id}`, { cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(body?.chat?.messages)) throw new Error("unavailable");
    return body.chat as ChatDetail;
  }, []);

  // Coming back to the tab picks up chats from other devices, and answers that finished while away.
  useEffect(() => {
    if (!historyAvailable) return;
    async function refresh() {
      if (document.visibilityState !== "visible" || busyRef.current) return;
      try {
        const response = await fetch("/api/v1/assistant/chats", { cache: "no-store" });
        const body = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(body?.chats)) return;
        const fresh = body.chats as ChatSummary[];
        const active = fresh.find(chat => chat.id === activeRef.current);
        const before = chatsRef.current.find(chat => chat.id === activeRef.current);
        setChats(fresh);
        if (active && (!before || active.updatedAt > before.updatedAt)) fetchChat(active.id).then(chat => setMessages(chat.id, chat.messages)).catch(() => {});
      } catch { /* offline: keep what is shown */ }
    }
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [historyAvailable, fetchChat, setMessages]);

  // Opening a chat jumps to its end; new messages glide there. Only the conversation scrolls, never the page.
  const shownId = useRef<string | null>(null);
  useEffect(() => {
    const box = thread.current;
    if (!box) return;
    const jump = shownId.current !== activeId || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    shownId.current = activeId;
    box.scrollTo({ top: box.scrollHeight, behavior: jump ? "auto" : "smooth" });
  }, [messages, thinkingHere, activeId]);

  // The composer grows with its text, up to a limit.
  useEffect(() => {
    const box = input.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${Math.min(box.scrollHeight, 200)}px`;
  }, [draft, activeId]);

  useEffect(() => {
    if (!drawer) return;
    const close = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") setDrawer(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [drawer]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy || !service || loadingHere) return;
    const id = activeId;
    const before = messages;
    const next: ChatMessage[] = [...before, { role: "user", content }];
    setMessages(id, next); setDraft(""); setBusyId(id); setError(""); setNotice(""); setReused(false);
    const fail = (message: string) => { setMessages(id, before); if (activeRef.current === id) { setError(message); setDraft(content); } };
    try {
      const response = await fetch("/api/v1/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(70000),
        body: JSON.stringify({ messages: next.slice(-12).map(({ role, content: body }) => ({ role, content: body })), context: choice, ...(historyAvailable ? { chatId: id } : {}) }) });
      const body = await response.json().catch(() => null);
      if (!response.ok || typeof body?.reply !== "string") { fail(body?.error?.message ?? "The assistant could not answer right now."); return; }
      setMessages(id, [...next, { role: "assistant", content: body.reply, ...(body.service === "fake" ? { test: true } : {}) }]);
      if (body.saved) {
        setChats(current => {
          const existing = current.find(chat => chat.id === id);
          return [{ id, title: existing?.title ?? titleFor(next), updatedAt: Date.now() }, ...current.filter(chat => chat.id !== id)];
        });
        if (activeRef.current === id) remember(id);
      } else if (historyAvailable) setNotice("This answer could not be saved to your account. Copy it if you need it later.");
      if (body.cached) setReused(true);
      else if (typeof body.remaining === "number") setRemaining(body.remaining);
    } catch { fail("The message did not go through. Check your connection and try again."); }
    finally { setBusyId(null); if (activeRef.current === id) input.current?.focus(); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void send(draft); }
  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(draft); }
  }

  async function open(id: string) {
    setDrawer(false);
    if (id === activeId) return;
    setActiveId(id); setError(""); setNotice(""); setReused(false); setDraft(""); remember(id);
    if (cache[id]) return;
    setOpening(id);
    try { const chat = await fetchChat(id); setMessages(id, chat.messages); }
    catch { if (activeRef.current === id) setError("This chat could not be opened. Check your connection and try again."); }
    finally { setOpening(current => current === id ? null : current); }
  }
  function startNew() {
    setActiveId(newId()); setError(""); setNotice(""); setReused(false); setDraft(""); setDrawer(false); remember(null);
    requestAnimationFrame(() => input.current?.focus());
  }
  async function remove(chat: ChatSummary) {
    if (!window.confirm(`Delete "${chat.title}"? This cannot be undone.`)) return;
    const before = chats;
    setChats(current => current.filter(item => item.id !== chat.id));
    if (chat.id === activeId) startNew();
    const response = await fetch(`/api/v1/assistant/chats/${chat.id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) { setChats(before); setError("The chat could not be deleted. Please try again."); }
  }
  async function removeAll() {
    if (!window.confirm("Delete all your chats? This cannot be undone.")) return;
    const before = chats;
    setChats([]); setCache({}); startNew();
    const response = await fetch("/api/v1/assistant/chats", { method: "DELETE" }).catch(() => null);
    if (!response?.ok) { setChats(before); setError("Your chats could not be deleted. Please try again."); }
  }
  async function saveName() {
    if (!renaming) return;
    const { id, title } = renaming;
    const name = title.trim().slice(0, 120);
    setRenaming(null);
    const old = chats.find(chat => chat.id === id)?.title;
    if (!name || name === old) return;
    setChats(current => current.map(chat => chat.id === id ? { ...chat, title: name } : chat));
    const response = await fetch(`/api/v1/assistant/chats/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: name }) }).catch(() => null);
    if (!response?.ok) { setChats(current => current.map(chat => chat.id === id ? { ...chat, title: old ?? chat.title } : chat)); setError("The new name could not be saved. Please try again."); }
  }

  const shared = (Object.keys(choice) as (keyof ContextChoice)[]).filter(key => choice[key]);
  const empty = !messages.length && !loadingHere;
  const title = chats.find(chat => chat.id === activeId)?.title ?? (messages.length ? titleFor(messages) : "New chat");

  return <section className="chat" aria-labelledby="chat-title" data-empty={empty ? "yes" : "no"} data-drawer={drawer ? "open" : "closed"}>
    <aside className="chat-side" aria-label="Your chats">
      <div className="chat-side-top">
        <button type="button" className="chat-new" onClick={startNew}><Svg name="plus" />New chat</button>
        <button type="button" className="chat-side-close" onClick={() => setDrawer(false)} aria-label="Close chats"><Svg name="close" /></button>
      </div>
      {chats.length > 3 && <label className="chat-search">
        <Svg name="search" />
        <span className="sr-only">Search your chats</span>
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search chats" />
      </label>}
      <nav className="chat-history" aria-label="Saved chats">
        {!chats.length && <p className="chat-history-empty">{historyAvailable ? "Your chats will appear here, saved to your account, so you can come back to any of them." : "Saved chats are not available right now."}</p>}
        {chats.length > 0 && !shownChats.length && <p className="chat-history-empty">No chat matches &ldquo;{query.trim()}&rdquo;.</p>}
        {groups.map(group => <div key={group.label} className="chat-group">
          <h2>{group.label}</h2>
          <ul>{group.chats.map(chat => <li key={chat.id} className={chat.id === activeId ? "is-active" : undefined}>
            {renaming?.id === chat.id
              ? <input className="chat-rename" aria-label="Chat name" value={renaming.title} maxLength={120} autoFocus onFocus={event => event.currentTarget.select()}
                  onChange={event => setRenaming({ id: chat.id, title: event.target.value })} onBlur={() => void saveName()}
                  onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void saveName(); } if (event.key === "Escape") { event.stopPropagation(); setRenaming(null); } }} />
              : <>
                <button type="button" className="chat-history-item" onClick={() => void open(chat.id)} aria-current={chat.id === activeId ? "page" : undefined} title={chat.title}>
                  {busyId === chat.id && <span className="chat-history-live" aria-label="Answering" />}
                  <span>{chat.title}</span>
                </button>
                <span className="chat-history-tools">
                  <button type="button" onClick={() => setRenaming({ id: chat.id, title: chat.title })} aria-label={`Rename chat: ${chat.title}`} title="Rename"><Svg name="pen" /></button>
                  <button type="button" className="is-danger" onClick={() => void remove(chat)} aria-label={`Delete chat: ${chat.title}`} title="Delete" disabled={busyId === chat.id}><Svg name="trash" /></button>
                </span>
              </>}
          </li>)}</ul>
        </div>)}
      </nav>
      <div className="chat-side-foot">
        <p><Svg name="lock" />{historyAvailable ? "Saved to your account. Only you can see your chats." : "This chat lasts until you leave the page."}</p>
        {chats.length > 0 && <button type="button" className="chat-clear" onClick={() => void removeAll()} disabled={busy}>Delete all chats</button>}
      </div>
    </aside>
    <button type="button" className="chat-scrim" tabIndex={-1} aria-hidden="true" onClick={() => setDrawer(false)} />

    <div className="chat-main">
      <header className="chat-bar">
        <button type="button" className="chat-menu" onClick={() => setDrawer(true)} aria-label="Show your chats" aria-expanded={drawer}><Svg name="menu" /></button>
        <div className="chat-identity">
          <Orb thinking={busy} live />
          <div>
            <h1 id="chat-title">Career assistant</h1>
            <p>{busy ? "Thinking…" : service ? <>Ready · <strong>{service}</strong></> : "Not available right now"}</p>
          </div>
        </div>
        {!empty && <p className="chat-current" title={title}>{title}</p>}
        <div className="chat-bar-actions">
          {remaining !== null && <span className="chat-pill" title="Messages left today">{remaining} left today</span>}
          {reused && <span className="chat-pill">Answer reused · not counted</span>}
          {!empty && <button type="button" className="chat-new-mini" onClick={startNew} aria-label="New chat" title="New chat"><Svg name="compose" /></button>}
        </div>
      </header>

      <div ref={thread} className="chat-thread" role="log" aria-live="polite" aria-busy={thinkingHere || loadingHere}>
        {empty && <div className="chat-welcome">
          <Orb size="large" thinking={busy} />
          <h2>{firstName ? `Hi ${firstName}, what's your next move?` : "What's your next move?"}</h2>
          <p>Ask about careers, skills, your CV or what to learn. Answers use only what you choose to share.</p>
        </div>}
        <div className="chat-column">
          {loadingHere && <div className="chat-loading" aria-label="Opening the chat"><span /><span /><span /></div>}
          {messages.map((message, i) => <div key={`${activeId}-${i}`} className={`assistant-message from-${message.role}`}>
            {message.role === "assistant" && <Orb />}
            <div className="chat-bubble">
              <span className="sr-only">{message.role === "user" ? "You said:" : "Assistant:"}</span>
              {message.test && <em className="assistant-test">test AI, not real</em>}
              {message.role === "assistant" ? <Reply text={message.content} /> : <p>{message.content}</p>}
              {message.role === "assistant" && <div className="chat-actions"><CopyButton text={message.content} /></div>}
            </div>
          </div>)}
          {thinkingHere && <div className="assistant-message from-assistant typing" aria-label="The assistant is writing"><Orb thinking /><div className="chat-bubble chat-dots"><span /><span /><span /></div></div>}
        </div>
      </div>

      <div className="chat-dock">
        {error && <p className="form-error chat-error" role="alert">{error}</p>}
        {notice && <p className="chat-notice" role="status">{notice}</p>}
        <form className="chat-composer" onSubmit={submit}>
          <label className="sr-only" htmlFor="assistant-input">Your message</label>
          <textarea ref={input} id="assistant-input" rows={1} maxLength={MAX} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={onKey}
            placeholder={service ? (messages.length ? "Reply to the assistant…" : "Ask a career question…") : "The assistant is not available right now."} aria-describedby="assistant-keys" disabled={busy || !service || loadingHere} />
          <div className="chat-tools">
            <div className="chat-chips" role="group" aria-label="Share with the assistant">
              <span className="chat-chips-label" aria-hidden="true">Share</span>
              {(Object.keys(CONTEXT_LABELS) as (keyof ContextChoice)[]).map(key => <label key={key} className="chat-chip" title={CONTEXT_LABELS[key].detail}>
                <input type="checkbox" checked={choice[key]} onChange={event => setChoice(current => ({ ...current, [key]: event.target.checked }))} disabled={busy} />
                <span aria-hidden="true" className="chat-chip-tick">✓</span>{CONTEXT_LABELS[key].label}
              </label>)}
            </div>
            {draft.length > MAX - 200 && <span className="chat-count" aria-live="polite">{MAX - draft.length}</span>}
            <button type="submit" className="chat-send" disabled={busy || !draft.trim() || !service || loadingHere} aria-label="Send">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            </button>
          </div>
        </form>
        {empty && <div className="chat-starters">{STARTERS.map(starter => <button key={starter.text} type="button" onClick={() => void send(starter.text)} disabled={busy || !service}>
          <span className="chat-starter-icon" aria-hidden="true"><AppIcon name={starter.icon} /></span>
          <span className="chat-starter-text"><strong>{starter.text}</strong><small>{starter.hint}</small></span>
        </button>)}</div>}
        <div className="chat-foot">
          <span id="assistant-keys">Enter sends · Shift+Enter adds a line</span>
          <details className="chat-privacy">
            <summary>What is sent?</summary>
            <p>{shared.length ? `Only ${shared.map(key => CONTEXT_LABELS[key].label.toLowerCase()).join(" and ")}, read fresh from your account for each message` : "Nothing from your profile: only your messages"}{service ? <>, go to <strong>{service}</strong></> : null}. Your chats are saved to your CareerForge account so you can come back to them on any device; only you can see them, and you can delete any chat, or all of them, at any time. Deleting your account deletes them too. Each answer is also kept privately for 30 days so an identical question does not use AI twice. 20 messages a day.</p>
          </details>
          <span className="chat-foot-note">Suggestions, not decisions. Check anything important on the official source.</span>
        </div>
      </div>
    </div>
  </section>;
}
