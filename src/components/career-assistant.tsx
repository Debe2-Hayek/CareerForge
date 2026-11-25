"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { linkify, type ContextChoice } from "@/lib/assistant/context";
import { AppIcon, type IconName } from "./app-icons";
import { AiGlobe } from "./ai-globe";

type Message = { role: "user" | "assistant"; content: string; test?: boolean };
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

function Reply({ text }: { text: string }) {
  return <>{linkify(text).map((segment, i) => "href" in segment ? <Link key={i} href={segment.href} className="assistant-link">{segment.label}</Link> : <span key={i}>{segment.text}</span>)}</>;
}

/** The assistant's living mark: a slowly turning, breathing orb (still when motion is reduced). */
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
  return <button type="button" className="chat-copy" onClick={copy} aria-label={copied ? "Copied" : "Copy answer"}>{copied ? "Copied ✓" : "Copy"}</button>;
}

export function CareerAssistant({ service, firstName = "" }: { service: string | null; firstName?: string }) {
  const [choice, setChoice] = useState<ContextChoice>({ profile: true, history: true, careers: false });
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [reused, setReused] = useState(false);
  const thread = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  // Scroll only the conversation (never the page), and only once there is something to show.
  useEffect(() => {
    const box = thread.current;
    if (!box || (!messages.length && !busy)) return;
    box.scrollTo({ top: box.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [messages, busy]);

  // The composer grows with its text, up to a limit.
  useEffect(() => {
    const box = input.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${Math.min(box.scrollHeight, 180)}px`;
  }, [draft]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next); setDraft(""); setBusy(true); setError(""); setReused(false);
    try {
      const response = await fetch("/api/v1/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(70000),
        body: JSON.stringify({ messages: next.slice(-12).map(({ role, content: body }) => ({ role, content: body })), context: choice }) });
      const body = await response.json().catch(() => null);
      if (!response.ok || typeof body?.reply !== "string") { setError(body?.error?.message ?? "The assistant could not answer right now."); setMessages(messages); setDraft(content); return; }
      setMessages([...next, { role: "assistant", content: body.reply, test: body.service === "fake" }]);
      if (body.cached) setReused(true);
      else if (typeof body.remaining === "number") setRemaining(body.remaining);
    } catch { setError("The message did not go through. Check your connection and try again."); setMessages(messages); setDraft(content); }
    finally { setBusy(false); input.current?.focus(); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void send(draft); }
  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(draft); }
  }
  function restart() { setMessages([]); setError(""); setReused(false); input.current?.focus(); }
  const shared = (Object.keys(choice) as (keyof ContextChoice)[]).filter(key => choice[key]);

  return <section className="chat" aria-labelledby="chat-title" data-empty={messages.length ? "no" : "yes"}>
    <header className="chat-top">
      <div className="chat-identity">
        <Orb thinking={busy} live />
        <div>
          <h1 id="chat-title">Career assistant</h1>
          <p>{busy ? "Thinking…" : service ? <>Ready · answers come from <strong>{service}</strong></> : "Not available right now"}</p>
        </div>
      </div>
      <div className="chat-top-actions">
        {remaining !== null && <span className="chat-pill" title="Messages left today">{remaining} left today</span>}
        {reused && <span className="chat-pill">Answer reused · not counted</span>}
        {messages.length > 0 && <button type="button" className="chat-new" onClick={restart} disabled={busy}><AppIcon name="spark" />New chat</button>}
      </div>
    </header>

    <div className="chat-context">
      <span className="chat-context-label" id="chat-context-label">Share with the assistant</span>
      <div className="chat-chips" role="group" aria-labelledby="chat-context-label">
        {(Object.keys(CONTEXT_LABELS) as (keyof ContextChoice)[]).map(key => <label key={key} className="chat-chip" title={CONTEXT_LABELS[key].detail}>
          <input type="checkbox" checked={choice[key]} onChange={event => setChoice(current => ({ ...current, [key]: event.target.checked }))} disabled={busy} />
          <span aria-hidden="true" className="chat-chip-tick">✓</span>{CONTEXT_LABELS[key].label}
        </label>)}
      </div>
      <details className="chat-privacy">
        <summary>What is sent?</summary>
        <p>{shared.length ? `Only ${shared.map(key => CONTEXT_LABELS[key].label.toLowerCase()).join(" and ")}, read fresh from your account for each message` : "Nothing from your profile: only your messages"}{service ? <>, go to <strong>{service}</strong></> : null}. Chats are not saved here and leaving the page clears them. Each answer is kept privately for 30 days so an identical question does not use AI twice. 20 messages a day.</p>
      </details>
    </div>

    <div ref={thread} className="chat-thread" role="log" aria-live="polite" aria-busy={busy}>
      {!messages.length && <div className="chat-welcome">
        <Orb size="large" thinking={busy} />
        <h2>{firstName ? `Hi ${firstName}, what's your next move?` : "What's your next move?"}</h2>
        <p>Ask about careers, skills, your CV or what to learn. Answers use only what you share above.</p>
        <div className="chat-starters">{STARTERS.map(starter => <button key={starter.text} type="button" onClick={() => send(starter.text)} disabled={busy || !service}>
          <span className="chat-starter-icon" aria-hidden="true"><AppIcon name={starter.icon} /></span>
          <span className="chat-starter-text"><strong>{starter.text}</strong><small>{starter.hint}</small></span>
        </button>)}</div>
      </div>}
      {messages.map((message, i) => <div key={i} className={`assistant-message from-${message.role}`}>
        {message.role === "assistant" ? <Orb /> : <span className="chat-avatar" aria-hidden="true">{(firstName[0] ?? "Y").toUpperCase()}</span>}
        <div className="chat-bubble">
          <span className="sr-only">{message.role === "user" ? "You said:" : "Assistant:"}</span>
          {message.test && <em className="assistant-test">test AI, not real</em>}
          <p>{message.role === "assistant" ? <Reply text={message.content} /> : message.content}</p>
          {message.role === "assistant" && <CopyButton text={message.content} />}
        </div>
      </div>)}
      {busy && <div className="assistant-message from-assistant typing" aria-label="The assistant is writing"><Orb thinking /><div className="chat-bubble chat-dots"><span /><span /><span /></div></div>}
    </div>

    {error && <p className="form-error chat-error" role="alert">{error}</p>}
    <form className="chat-composer" onSubmit={submit}>
      <label className="sr-only" htmlFor="assistant-input">Your message</label>
      <textarea ref={input} id="assistant-input" rows={1} maxLength={MAX} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={onKey}
        placeholder={service ? "Ask a career question…" : "The assistant is not available right now."} aria-describedby="assistant-keys" disabled={busy || !service} />
      {draft.length > MAX - 200 && <span className="chat-count" aria-live="polite">{MAX - draft.length}</span>}
      <button type="submit" className="chat-send" disabled={busy || !draft.trim() || !service} aria-label="Send">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
      </button>
    </form>
    <p className="chat-foot"><span id="assistant-keys">Enter sends · Shift+Enter adds a line</span><span>Suggestions, not decisions. Check anything important on the official source.</span></p>
  </section>;
}
