"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { linkify, type ContextChoice } from "@/lib/assistant/context";
import { boldSpans, chatKey, groupChats, parseChats, toBlocks, upsertChat, type ChatMessage, type SavedChat } from "@/lib/assistant/chat-store";
import { AppIcon, type IconName } from "./app-icons";
import { AiGlobe } from "./ai-globe";

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
const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

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

/** The assistant's mark: a turning wireframe globe. Message avatars stay still to keep long chats light. */
function Orb({ size = "small", thinking = false, live = false }: { size?: "small" | "large"; thinking?: boolean; live?: boolean }) {
  return <span className={`ai-orb ai-orb-${size}${thinking ? " is-thinking" : ""}`} aria-hidden="true">
    <AiGlobe size={size === "large" ? 150 : 34} live={size === "large" || live || thinking} thinking={thinking} />
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

export function CareerAssistant({ service, firstName = "", userId }: { service: string | null; firstName?: string; userId: string }) {
  const storageKey = chatKey(userId);
  const [choice, setChoice] = useState<ContextChoice>({ profile: true, history: true, careers: false });
  const [chats, setChats] = useState<SavedChat[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeId, setActiveId] = useState(newId);
  const [draft, setDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [reused, setReused] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const thread = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const written = useRef<string | null>(null);
  const activeRef = useRef(activeId);
  useEffect(() => { activeRef.current = activeId; }, [activeId]);

  const messages = useMemo(() => chats.find(chat => chat.id === activeId)?.messages ?? [], [chats, activeId]);
  const groups = useMemo(() => groupChats(chats), [chats]);
  const busy = busyId !== null;
  const thinkingHere = busyId === activeId;
  const commit = useCallback((id: string, next: ChatMessage[]) => setChats(current => upsertChat(current, id, next)), []);

  // Saved chats come back after a refresh or a visit to another page: the latest one opens again.
  useEffect(() => {
    let saved: SavedChat[] = [];
    try { written.current = localStorage.getItem(storageKey); saved = parseChats(written.current); } catch { /* storage blocked: start empty */ }
    setChats(saved);
    if (saved[0]) setActiveId(saved[0].id);
    setLoaded(true);
    if (window.matchMedia("(min-width: 900px)").matches) input.current?.focus();
  }, [storageKey]);

  // Every change is saved in this browser; other open tabs follow along.
  useEffect(() => {
    if (!loaded) return;
    const value = JSON.stringify(chats);
    if (value === written.current) return;
    written.current = value;
    try { if (chats.length) localStorage.setItem(storageKey, value); else localStorage.removeItem(storageKey); } catch { /* full or blocked: the chat still works on this page */ }
  }, [chats, loaded, storageKey]);
  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.key !== storageKey) return;
      written.current = event.newValue;
      setChats(parseChats(event.newValue));
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [storageKey]);

  // Opening a chat jumps to its end; new messages glide there. Only the conversation scrolls, never the page.
  const shownId = useRef<string | null>(null);
  useEffect(() => {
    const box = thread.current;
    if (!box || !loaded) return;
    const jump = shownId.current !== activeId || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    shownId.current = activeId;
    box.scrollTo({ top: box.scrollHeight, behavior: jump ? "auto" : "smooth" });
  }, [messages, thinkingHere, activeId, loaded]);

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

  /** Asks the AI about this chat's history; the answer lands in its own chat even if another one is open by then. */
  async function ask(id: string, history: ChatMessage[], before: ChatMessage[], content: string | null) {
    setBusyId(id); setError(""); setReused(false);
    const fail = (message: string) => {
      if (content === null) { if (activeRef.current === id) setError(message); return; }
      commit(id, before);
      if (activeRef.current === id) { setError(message); setDraft(content); }
    };
    try {
      const response = await fetch("/api/v1/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(70000),
        body: JSON.stringify({ messages: history.slice(-12).map(({ role, content: body }) => ({ role, content: body })), context: choice }) });
      const body = await response.json().catch(() => null);
      if (!response.ok || typeof body?.reply !== "string") { fail(body?.error?.message ?? "The assistant could not answer right now."); return; }
      commit(id, [...history, { role: "assistant", content: body.reply, ...(body.service === "fake" ? { test: true } : {}) }]);
      if (body.cached) setReused(true);
      else if (typeof body.remaining === "number") setRemaining(body.remaining);
    } catch { fail("The message did not go through. Check your connection and try again."); }
    finally { setBusyId(null); if (activeRef.current === id) input.current?.focus(); }
  }
  function send(text: string) {
    const content = text.trim();
    if (!content || busy || !service) return;
    const id = activeId;
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    commit(id, next); setDraft("");
    void ask(id, next, messages, content);
  }
  function submit(event: FormEvent) { event.preventDefault(); send(draft); }
  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(draft); }
  }
  function open(id: string) {
    if (id !== activeId) { setActiveId(id); setError(""); setReused(false); setDraft(""); }
    setDrawer(false);
  }
  function startNew() { open(newId()); requestAnimationFrame(() => input.current?.focus()); }
  function remove(chat: SavedChat) {
    if (!window.confirm(`Delete "${chat.title}"? This cannot be undone.`)) return;
    setChats(current => current.filter(item => item.id !== chat.id));
    if (chat.id === activeId) startNew();
  }
  function removeAll() {
    if (!window.confirm("Delete all your saved chats in this browser? This cannot be undone.")) return;
    setChats([]); startNew();
  }

  const shared = (Object.keys(choice) as (keyof ContextChoice)[]).filter(key => choice[key]);
  const empty = loaded && !messages.length;
  const waiting = !busy && messages.at(-1)?.role === "user";
  const title = chats.find(chat => chat.id === activeId)?.title ?? "New chat";

  return <section className="chat" aria-labelledby="chat-title" data-empty={empty ? "yes" : "no"} data-drawer={drawer ? "open" : "closed"}>
    <aside className="chat-side" aria-label="Your chats">
      <div className="chat-side-top">
        <button type="button" className="chat-new" onClick={startNew}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>New chat</button>
        <button type="button" className="chat-side-close" onClick={() => setDrawer(false)} aria-label="Close chats"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
      </div>
      <nav className="chat-history" aria-label="Saved chats">
        {loaded && !chats.length && <p className="chat-history-empty">Your chats will appear here. They stay saved when you refresh or leave the page.</p>}
        {groups.map(group => <div key={group.label} className="chat-group">
          <h2>{group.label}</h2>
          <ul>{group.chats.map(chat => <li key={chat.id} className={chat.id === activeId ? "is-active" : undefined}>
            <button type="button" className="chat-history-item" onClick={() => open(chat.id)} aria-current={chat.id === activeId ? "page" : undefined} title={chat.title}>
              {busyId === chat.id && <span className="chat-history-live" aria-label="Answering" />}
              <span>{chat.title}</span>
            </button>
            <button type="button" className="chat-history-delete" onClick={() => remove(chat)} aria-label={`Delete chat: ${chat.title}`} disabled={busyId === chat.id}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></svg>
            </button>
          </li>)}</ul>
        </div>)}
      </nav>
      <div className="chat-side-foot">
        <p><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>Saved only in this browser. Signing out deletes them.</p>
        {chats.length > 0 && <button type="button" className="chat-clear" onClick={removeAll} disabled={busy}>Delete all chats</button>}
      </div>
    </aside>
    <button type="button" className="chat-scrim" tabIndex={-1} aria-hidden="true" onClick={() => setDrawer(false)} />

    <div className="chat-main">
      <header className="chat-bar">
        <button type="button" className="chat-menu" onClick={() => setDrawer(true)} aria-label="Show your chats" aria-expanded={drawer}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
        </button>
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
          {!empty && <button type="button" className="chat-new-mini" onClick={startNew} aria-label="New chat" title="New chat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg></button>}
        </div>
      </header>

      <div ref={thread} className="chat-thread" role="log" aria-live="polite" aria-busy={thinkingHere}>
        {empty && <div className="chat-welcome">
          <Orb size="large" thinking={busy} />
          <h2>{firstName ? `Hi ${firstName}, what's your next move?` : "What's your next move?"}</h2>
          <p>Ask about careers, skills, your CV or what to learn. Answers use only what you choose to share.</p>
        </div>}
        <div className="chat-column">
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
          {waiting && <div className="chat-retry" role="status">
            <span>This question has no answer yet. The page may have closed before it arrived.</span>
            <button type="button" onClick={() => void ask(activeId, messages, messages, null)} disabled={!service}>Ask again</button>
          </div>}
        </div>
      </div>

      <div className="chat-dock">
        {error && <p className="form-error chat-error" role="alert">{error}</p>}
        <form className="chat-composer" onSubmit={submit}>
          <label className="sr-only" htmlFor="assistant-input">Your message</label>
          <textarea ref={input} id="assistant-input" rows={1} maxLength={MAX} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={onKey}
            placeholder={service ? (messages.length ? "Reply to the assistant…" : "Ask a career question…") : "The assistant is not available right now."} aria-describedby="assistant-keys" disabled={busy || !service} />
          <div className="chat-tools">
            <div className="chat-chips" role="group" aria-label="Share with the assistant">
              <span className="chat-chips-label" aria-hidden="true">Share</span>
              {(Object.keys(CONTEXT_LABELS) as (keyof ContextChoice)[]).map(key => <label key={key} className="chat-chip" title={CONTEXT_LABELS[key].detail}>
                <input type="checkbox" checked={choice[key]} onChange={event => setChoice(current => ({ ...current, [key]: event.target.checked }))} disabled={busy} />
                <span aria-hidden="true" className="chat-chip-tick">✓</span>{CONTEXT_LABELS[key].label}
              </label>)}
            </div>
            {draft.length > MAX - 200 && <span className="chat-count" aria-live="polite">{MAX - draft.length}</span>}
            <button type="submit" className="chat-send" disabled={busy || !draft.trim() || !service} aria-label="Send">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            </button>
          </div>
        </form>
        {empty && <div className="chat-starters">{STARTERS.map(starter => <button key={starter.text} type="button" onClick={() => send(starter.text)} disabled={busy || !service}>
          <span className="chat-starter-icon" aria-hidden="true"><AppIcon name={starter.icon} /></span>
          <span className="chat-starter-text"><strong>{starter.text}</strong><small>{starter.hint}</small></span>
        </button>)}</div>}
        <div className="chat-foot">
          <span id="assistant-keys">Enter sends · Shift+Enter adds a line</span>
          <details className="chat-privacy">
            <summary>What is sent?</summary>
            <p>{shared.length ? `Only ${shared.map(key => CONTEXT_LABELS[key].label.toLowerCase()).join(" and ")}, read fresh from your account for each message` : "Nothing from your profile: only your messages"}{service ? <>, go to <strong>{service}</strong></> : null}. Your chats are saved only in this browser on this device, not on CareerForge&apos;s servers, and signing out deletes them. Each answer is kept privately for 30 days so an identical question does not use AI twice. 20 messages a day.</p>
          </details>
          <span className="chat-foot-note">Suggestions, not decisions. Check anything important on the official source.</span>
        </div>
      </div>
    </div>
  </section>;
}
