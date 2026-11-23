"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { linkify, type ContextChoice } from "@/lib/assistant/context";

type Message = { role: "user" | "assistant"; content: string; test?: boolean };
const STARTERS = ["Which career fits me best, and why?", "What should I learn next?", "How can I make my profile more convincing to employers?", "Which of my skills should I prove first?"];
const CONTEXT_LABELS: Record<keyof ContextChoice, { label: string; detail: string }> = {
  profile: { label: "Profile & skills", detail: "Headline, about you, skills and their trust badges" },
  history: { label: "Work & education", detail: "Your jobs and degrees with dates" },
  careers: { label: "Career matches", detail: "Your three closest careers and scores" }
};

function Reply({ text }: { text: string }) {
  return <>{linkify(text).map((segment, i) => "href" in segment ? <Link key={i} href={segment.href} className="assistant-link">{segment.label}</Link> : <span key={i}>{segment.text}</span>)}</>;
}

export function CareerAssistant({ service }: { service: string | null }) {
  const [choice, setChoice] = useState<ContextChoice>({ profile: true, history: true, careers: false });
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const thread = useRef<HTMLDivElement>(null);

  // Scroll only the conversation box (never the page), and only once there is something to show.
  useEffect(() => {
    const box = thread.current;
    if (!box || (!messages.length && !busy)) return;
    box.scrollTo({ top: box.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next); setDraft(""); setBusy(true); setError("");
    try {
      const response = await fetch("/api/v1/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(70000),
        body: JSON.stringify({ messages: next.slice(-12).map(({ role, content: body }) => ({ role, content: body })), context: choice }) });
      const body = await response.json().catch(() => null);
      if (!response.ok || typeof body?.reply !== "string") { setError(body?.error?.message ?? "The assistant could not answer right now."); setMessages(messages); setDraft(content); return; }
      setMessages([...next, { role: "assistant", content: body.reply, test: body.service === "fake" }]);
      setNote(body.cached ? "That answer was reused; no message was counted." : typeof body.remaining === "number" ? `${body.remaining} messages left today.` : "");
    } catch { setError("The message did not go through. Check your connection and try again."); setMessages(messages); setDraft(content); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); send(draft); }
  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(draft); }
  }

  return <div className="assistant">
    <aside className="panel assistant-context" aria-labelledby="assistant-context-title">
      <h2 id="assistant-context-title">What the assistant may see</h2>
      <p className="muted-note">Only the parts you tick are sent, read fresh from your account for each message.</p>
      <div className="assistant-choices">
        {(Object.keys(CONTEXT_LABELS) as (keyof ContextChoice)[]).map(key => <label key={key} className="assistant-choice">
          <input type="checkbox" checked={choice[key]} onChange={event => setChoice(current => ({ ...current, [key]: event.target.checked }))} disabled={busy} />
          <span><strong>{CONTEXT_LABELS[key].label}</strong><small>{CONTEXT_LABELS[key].detail}</small></span>
        </label>)}
      </div>
      <p className="assistant-privacy">{service ? <>Your messages and the ticked parts go to <strong>{service}</strong>. </> : null}Chats are not saved here; leaving the page clears them. Each answer is kept privately for 30 days so an identical question does not use AI twice. 20 messages a day.</p>
      {messages.length > 0 && <button type="button" className="text-button" onClick={() => { setMessages([]); setError(""); setNote(""); }} disabled={busy}>Start a new conversation</button>}
    </aside>

    <section className="panel assistant-chat" aria-labelledby="assistant-chat-title">
      <h2 id="assistant-chat-title" className="sr-only">Conversation</h2>
      <div ref={thread} className="assistant-thread" role="log" aria-live="polite" aria-busy={busy}>
        {!messages.length && <div className="assistant-empty">
          <p className="assistant-hello"><span aria-hidden="true">✦</span> Ask anything about your career: what to learn, which path fits, how to present yourself.</p>
          <div className="assistant-starters">{STARTERS.map(starter => <button key={starter} type="button" onClick={() => send(starter)} disabled={busy || !service}>{starter}</button>)}</div>
        </div>}
        {messages.map((message, i) => <div key={i} className={`assistant-message from-${message.role}`}>
          <span className="sr-only">{message.role === "user" ? "You said:" : "Assistant:"}</span>
          {message.test && <em className="assistant-test">test AI, not real</em>}
          <p>{message.role === "assistant" ? <Reply text={message.content} /> : message.content}</p>
        </div>)}
        {busy && <div className="assistant-message from-assistant typing" aria-label="The assistant is writing"><span /><span /><span /></div>}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <form className="assistant-composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="assistant-input">Your message</label>
        <textarea id="assistant-input" rows={2} maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={onKey} placeholder={service ? "Ask a career question…" : "The assistant is not available right now."} aria-describedby="assistant-keys" disabled={busy || !service} />
        <button type="submit" className="button primary" disabled={busy || !draft.trim() || !service}>{busy ? "…" : "Send"}</button>
      </form>
      <p className="assistant-foot"><span id="assistant-keys">Enter sends · Shift+Enter adds a line.</span> {note || "Answers are suggestions, not decisions. Check anything important on the official source."}</p>
    </section>
  </div>;
}
