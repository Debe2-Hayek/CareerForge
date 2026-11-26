"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { PASS_MARK, QUESTION_COUNT, RETRY_HOURS, sessionReplySchema, submissionResultSchema, type CheckOutcome, type CheckSession } from "@/lib/skill-checks";

type Phase = "intro" | "answering" | "review" | "result";
const LETTERS = ["A", "B", "C"];
const storeKey = (id: string) => `careerforge-check:${id}`;
/** Answers kept on this device for an open attempt (so leaving and coming back loses nothing). */
function restore(session: CheckSession | null): { answers: Record<string, number>; index: number } {
  if (!session || typeof window === "undefined") return { answers: {}, index: 0 };
  try {
    const saved = JSON.parse(sessionStorage.getItem(storeKey(session.id)) ?? "null") as { answers?: Record<string, number>; index?: number } | null;
    return { answers: saved?.answers ?? {}, index: Math.min(Math.max(0, saved?.index ?? 0), Math.max(0, session.questions.length - 1)) };
  } catch { return { answers: {}, index: 0 }; }
}
const when = (iso: string) => new Intl.DateTimeFormat(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

function errorOf(data: unknown, fallback: string): { message: string; retryAt?: string | null; code?: string } {
  if (data && typeof data === "object" && "error" in data && data.error && typeof data.error === "object") {
    const error = data.error as { message?: unknown; retryAt?: unknown; code?: unknown };
    return { message: typeof error.message === "string" ? error.message : fallback, retryAt: typeof error.retryAt === "string" ? error.retryAt : null, code: typeof error.code === "string" ? error.code : undefined };
  }
  return { message: fallback };
}

/**
 * One skill check, from the rules to the result. Used on the Skill checks page and inside the
 * Verification page. No clock: answers are kept on this device until submitted, so the person can
 * leave and come back; the server shuffles each attempt, grades it, and sets the 24-hour wait.
 */
export function SkillCheckRunner({ skill, onProfile, initialSession = null, withIntro = true, learnHref = null, onClose, onFinished }: {
  skill: string; onProfile: boolean; initialSession?: CheckSession | null; withIntro?: boolean; learnHref?: string | null;
  onClose: () => void; onFinished?: (outcome: CheckOutcome) => void;
}) {
  const [session, setSession] = useState<CheckSession | null>(initialSession);
  const [phase, setPhase] = useState<Phase>(initialSession ? "answering" : withIntro ? "intro" : "answering");
  const [answers, setAnswers] = useState<Record<string, number>>(() => restore(initialSession).answers);
  const [index, setIndex] = useState(() => restore(initialSession).index);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [retryAt, setRetryAt] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<CheckOutcome | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const started = useRef(false);

  // Answers stay on this device until they are submitted, so leaving and coming back loses nothing.
  useEffect(() => {
    if (!session || phase === "result") return;
    try { sessionStorage.setItem(storeKey(session.id), JSON.stringify({ answers, index })); } catch { /* private mode: answers stay in memory */ }
  }, [session, answers, index, phase]);
  useEffect(() => { heading.current?.focus(); }, [phase, index]);

  const begin = useCallback(async () => {
    if (pending) return;
    setPending(true); setError(""); setRetryAt(null);
    try {
      const response = await fetch("/api/v1/skill-checks/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ action: "start", skill, addToProfile: !onProfile }) });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) { const failure = errorOf(data, "The check could not start. Please try again."); setError(failure.message); setRetryAt(failure.retryAt ?? null); setPhase("intro"); return; }
      const parsed = sessionReplySchema.safeParse(data);
      if (!parsed.success || !parsed.data.session) { setError("The check could not be confirmed. Reload and try again."); setPhase("intro"); return; }
      const saved = restore(parsed.data.session);
      setSession(parsed.data.session); setAnswers(saved.answers); setIndex(saved.index); setPhase("answering");
    } catch { setError("The check could not start. Check your connection and try again."); setPhase("intro"); }
    finally { setPending(false); }
  }, [pending, skill, onProfile]);

  // Without the rules screen (a card's own button), the attempt starts straight away.
  useEffect(() => {
    if (!withIntro && !initialSession && !started.current) { started.current = true; void begin(); }
  }, [withIntro, initialSession, begin]);

  async function submit() {
    if (!session || pending) return;
    setPending(true); setError("");
    try {
      const response = await fetch("/api/v1/skill-checks", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ sessionId: session.id, answers }) });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) { setError(errorOf(data, "Your answers could not be sent. They are still here; try again.").message); return; }
      const result = submissionResultSchema.safeParse(data && typeof data === "object" && "result" in data ? data.result : null);
      if (!result.success || result.data.skill.toLowerCase() !== session.skill.toLowerCase()) { setError("The result could not be confirmed. Reload to see your recorded result; nothing is graded twice."); return; }
      try { sessionStorage.removeItem(storeKey(session.id)); } catch { /* ignore */ }
      setOutcome(result.data); setPhase("result"); onFinished?.(result.data);
    } catch { setError("Your answers could not be sent. They are still here; check your connection and try again. Nothing is graded twice."); }
    finally { setPending(false); }
  }

  async function endAttempt() {
    if (!session || pending || !window.confirm("End this attempt? Your answers are discarded and nothing is graded.")) return;
    setPending(true); setError("");
    try {
      const response = await fetch("/api/v1/skill-checks/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel", sessionId: session.id }) });
      if (!response.ok) { setError("The attempt could not be ended. Reload and try again."); return; }
      try { sessionStorage.removeItem(storeKey(session.id)); } catch { /* ignore */ }
      onClose();
    } catch { setError("The attempt could not be ended. Check your connection."); }
    finally { setPending(false); }
  }

  const questions = session?.questions ?? [];
  const question = questions[index];
  const answered = questions.filter(item => answers[item.id] !== undefined).length;
  const choose = (value: number) => { if (question) setAnswers(current => ({ ...current, [question.id]: value })); };
  function next() { if (index < questions.length - 1) setIndex(index + 1); else setPhase("review"); }
  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    if (phase !== "answering" || !question) return;
    const key = event.key.toLowerCase();
    const pick = ["1", "2", "3"].indexOf(key) >= 0 ? Number(key) - 1 : ["a", "b", "c"].indexOf(key);
    if (pick >= 0 && !(event.target instanceof HTMLInputElement && event.target.type === "text")) { event.preventDefault(); choose(pick); }
    else if (event.key === "Enter" && answers[question.id] !== undefined) { event.preventDefault(); next(); }
  }

  return <div className="check-runner" onKeyDown={onKey}>
    {phase === "intro" && <div className="check-intro">
      <span className="check-mono" aria-hidden="true">{skill.slice(0, 2)}</span>
      <h2 ref={heading} tabIndex={-1}>The {skill} check</h2>
      <ul className="check-rules">
        <li><span><b>{QUESTION_COUNT} questions</b> on the fundamentals, one at a time</span></li>
        <li><span><b>{PASS_MARK} right to pass</b>, and {skill} becomes Verified ✓ on your profile, CV and portfolio</span></li>
        <li><span><b>No time limit.</b> You can leave and come back; your answers wait on this device</span></li>
        <li><span>If you don&apos;t pass, you can try again <b>{RETRY_HOURS} hours later</b></span></li>
      </ul>
      {!onProfile && <p className="check-note">{skill} isn&apos;t on your profile yet. Starting adds it, so the result can show there.</p>}
      {error && <p className="form-error" role="alert">{error}{retryAt && <> Next try: <b>{when(retryAt)}</b>.</>}</p>}
      <div className="check-buttons">
        <button type="button" className="button primary" onClick={() => void begin()} disabled={pending || Boolean(retryAt)}>{pending ? "Starting…" : onProfile ? "Start the check" : "Add to profile and start"}</button>
        <button type="button" className="button ghost" onClick={onClose}>Not now</button>
        {retryAt && learnHref && <Link href={learnHref} className="text-button">Learn {skill} meanwhile <span aria-hidden="true">→</span></Link>}
      </div>
    </div>}

    {phase === "answering" && !session && <div className="check-loading" role="status"><span className="check-spinner" aria-hidden="true" />{error || "Preparing your questions…"}{error && <button type="button" className="text-button" onClick={onClose}>Back</button>}</div>}

    {phase === "answering" && session && question && <div className="check-ask">
      <div className="check-top">
        <p className="check-step"><b>{session.skill}</b> · Question {index + 1} of {questions.length}</p>
        <ol className="check-progress" aria-label={`${answered} of ${questions.length} answered`}>
          {questions.map((item, i) => <li key={item.id} data-done={answers[item.id] !== undefined || undefined} data-current={i === index || undefined}>
            <button type="button" onClick={() => setIndex(i)} aria-label={`Question ${i + 1}${answers[item.id] !== undefined ? ", answered" : ""}`} />
          </li>)}
        </ol>
      </div>
      <fieldset className="check-question" disabled={pending}>
        <legend><h2 ref={heading} tabIndex={-1}>{question.prompt}</h2></legend>
        <div className="check-options">{question.options.map((option, i) => <label key={`${question.id}-${i}`} className="check-option" data-picked={answers[question.id] === i || undefined}>
          <input type="radio" name={question.id} checked={answers[question.id] === i} onChange={() => choose(i)} />
          <span className="check-key" aria-hidden="true">{LETTERS[i]}</span><span className="check-option-text">{option}</span>
        </label>)}</div>
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="check-nav">
        <button type="button" className="button ghost" onClick={() => setIndex(index - 1)} disabled={index === 0}>Back</button>
        <span className="check-hint" aria-hidden="true">Keys: A B C to choose · Enter for next</span>
        <button type="button" className="button primary" onClick={next} disabled={answers[question.id] === undefined}>{index < questions.length - 1 ? "Next" : "Review answers"}</button>
      </div>
      <div className="check-leave"><button type="button" className="text-button" onClick={onClose}>Save and leave</button><button type="button" className="text-button danger" onClick={() => void endAttempt()} disabled={pending}>End attempt</button></div>
    </div>}

    {phase === "review" && session && <div className="check-review">
      <h2 ref={heading} tabIndex={-1}>Check your answers</h2>
      <p className="check-sub">Change any answer before you send them. Answers can&apos;t be changed after sending.</p>
      <ol className="check-summary">{questions.map((item, i) => <li key={item.id}>
        <button type="button" onClick={() => { setIndex(i); setPhase("answering"); }}>
          <span className="check-summary-n">{i + 1}</span>
          <span className="check-summary-q"><b>{item.prompt}</b><small>{answers[item.id] !== undefined ? <><span className="check-key mini">{LETTERS[answers[item.id]]}</span>{item.options[answers[item.id]]}</> : "Not answered"}</small></span>
          <span className="check-summary-edit" aria-hidden="true">Change</span>
        </button>
      </li>)}</ol>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="check-nav">
        <button type="button" className="button ghost" onClick={() => { setIndex(questions.length - 1); setPhase("answering"); }}>Back</button>
        <span className="check-hint">{answered < questions.length ? `${questions.length - answered} left to answer` : `If you don't pass, you can try again in ${RETRY_HOURS} hours.`}</span>
        <button type="button" className="button primary" onClick={() => void submit()} disabled={pending || answered < questions.length}>{pending ? "Grading…" : "Send answers"}</button>
      </div>
    </div>}

    {phase === "result" && outcome && <div className="check-result" data-passed={outcome.passed || undefined}>
      <div className="check-medal" aria-hidden="true">{outcome.passed ? <svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg> : <b>{outcome.score}/{outcome.total}</b>}</div>
      <h2 ref={heading} tabIndex={-1}>{outcome.passed ? `${outcome.skill} is now Verified` : "Not quite this time"}</h2>
      <p className="check-score"><b>{outcome.score} of {outcome.total}</b> correct{outcome.passed ? "" : ` · ${PASS_MARK} needed to pass`}</p>
      <p className="check-sub">{outcome.passed
        ? `The ✓ now shows next to ${outcome.skill} on your profile, CV and portfolio, and counts as a confirmed fact.`
        : <>Go over the fundamentals, then try again {outcome.retryAt ? <b>{when(outcome.retryAt)}</b> : `in ${RETRY_HOURS} hours`}.</>}</p>
      <div className="check-buttons">
        {outcome.passed ? <>
          <Link href="/cv/saved" className="button primary">See it on your CV <span aria-hidden="true">→</span></Link>
          <Link href={`/jobs?q=${encodeURIComponent(outcome.skill)}`} className="button ghost">Jobs that ask for {outcome.skill}</Link>
        </> : learnHref && <Link href={learnHref} className="button primary">Learn {outcome.skill} for free <span aria-hidden="true">→</span></Link>}
        <button type="button" className="button ghost" onClick={onClose}>Done</button>
      </div>
    </div>}
  </div>;
}
