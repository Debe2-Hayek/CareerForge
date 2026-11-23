"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import type { InterviewRow } from "@/lib/project-interview/server";

const statusText: Record<InterviewRow["status"], string> = {
  draft: "Step 1 · Prove it is your repository", ready: "Step 2 · Ready to start", in_progress: "Step 3 · Interview in progress",
  submitted: "Waiting for a reviewer", approved: "Reviewed: your project", rejected: "Not accepted", expired: "Time ran out"
};

async function post(body: unknown) {
  const response = await fetch("/api/v1/project-interviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) }).catch(() => null);
  const data = await response?.json().catch(() => null);
  return { ok: !!response?.ok, data };
}

function Clock({ deadline, offset, onEnd }: { deadline: string; offset: number; onEnd: () => void }) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now() + offset), 1000);
    return () => window.clearInterval(id);
  }, [offset]);
  const left = Math.max(0, Date.parse(deadline) - now);
  useEffect(() => { if (left === 0) onEnd(); }, [left, onEnd]);
  const minutes = Math.floor(left / 60000);
  const seconds = Math.floor(left / 1000) % 60;
  return <p className={`interview-clock${left < 120000 ? " low" : ""}`} role="timer" aria-live="off" aria-label={`${minutes} minutes ${seconds} seconds left`}>
    <span aria-hidden="true">⏱</span> {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")} left
  </p>;
}

function Interview({ row, offset, onChanged }: { row: InterviewRow; offset: number; onChanged: (text: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [ended, setEnded] = useState(false);
  const repo = `github.com/${row.repo_owner}/${row.repo_name}`;

  async function act(action: "prepare" | "start" | "submit") {
    if (busy) return;
    if (action === "start" && !window.confirm("Start now? You will have 20 minutes and cannot pause.")) return;
    setBusy(action); setError("");
    const result = await post(action === "submit" ? { action, id: row.id, answers } : { action, id: row.id });
    setBusy(null);
    if (!result.ok) { setError(result.data?.error?.message ?? "That did not work. Please try again."); return; }
    onChanged(action === "prepare" ? "Your repository is confirmed and the questions are ready." : action === "start" ? "The interview has started." : result.data?.status === "expired" ? "Time ran out before the answers were sent." : "Answers sent. A reviewer will check them against your code.");
  }

  return <article className="panel interview-card" data-status={row.status} aria-labelledby={`interview-${row.id}`}>
    <header className="interview-head">
      <div><p className="eyebrow">{statusText[row.status].toUpperCase()}</p><h3 id={`interview-${row.id}`}><a href={`https://${repo}`} target="_blank" rel="noopener noreferrer">{repo}<span className="sr-only"> (opens in a new tab)</span> ↗</a></h3></div>
      {row.status === "in_progress" && row.deadline_at && <Clock deadline={row.deadline_at} offset={offset} onEnd={() => setEnded(true)} />}
    </header>

    {row.status === "draft" && <div className="interview-step">
      <p>Add this code to the repository&apos;s <strong>README</strong> (or a file named <code>.careerforge</code>) on the default branch, push it, then check:</p>
      <p className="interview-code"><code>{row.ownership_code}</code><button type="button" className="text-button" onClick={() => navigator.clipboard?.writeText(row.ownership_code)}>Copy</button></p>
      <p className="muted-note">This shows the repository is yours. CareerForge then reads up to six source files at that commit and prepares four questions about specific lines.</p>
      <button type="button" className="button primary" onClick={() => act("prepare")} disabled={!!busy}>{busy === "prepare" ? "Checking and preparing…" : "Check my repository"}</button>
    </div>}

    {row.status === "ready" && <div className="interview-step">
      <p><strong>{row.questions?.length ?? 4} questions</strong> about your code are ready. You will have <strong>20 minutes</strong>, measured by CareerForge&apos;s server. Answer in your own words, two or three sentences each; you may keep your repository open.</p>
      <button type="button" className="button primary" onClick={() => act("start")} disabled={!!busy}>{busy === "start" ? "Starting…" : "Start the 20-minute interview"}</button>
    </div>}

    {row.status === "in_progress" && row.questions && <form className="interview-form" onSubmit={(event: FormEvent) => { event.preventDefault(); act("submit"); }}>
      {row.questions.map((question, index) => <fieldset key={question.id} className="interview-question">
        <legend>{index + 1}. {question.question}</legend>
        <p className="interview-ref"><code>{question.file}</code> lines {question.startLine}–{question.endLine}</p>
        <pre className="interview-quote"><code>{question.quote}</code></pre>
        <label><span className="sr-only">Your answer to question {index + 1}</span>
          <textarea rows={4} maxLength={1500} value={answers[question.id] ?? ""} onChange={event => setAnswers(current => ({ ...current, [question.id]: event.target.value }))} placeholder="Explain in your own words." disabled={ended} />
        </label>
      </fieldset>)}
      {ended && <p className="form-error" role="alert">Time is up. Answers sent now are refused by the server.</p>}
      <div className="interview-actions"><button type="submit" className="button primary" disabled={!!busy || ended}>{busy === "submit" ? "Sending…" : "Send my answers"}</button></div>
    </form>}

    {row.status === "submitted" && <p className="muted-note">Sent {row.submitted_at ? new Date(row.submitted_at).toLocaleString("en") : ""}. A CareerForge reviewer compares your answers with the code.</p>}
    {row.status === "approved" && <p className="interview-result ok">✓ A reviewer confirmed you understand this project&apos;s code.</p>}
    {row.status === "rejected" && <p className="interview-result no">Not accepted{row.decision_note ? `: ${row.decision_note}` : "."} You can start a new interview.</p>}
    {row.status === "expired" && <p className="muted-note">The 20 minutes ended before answers were sent. You can start a new interview.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </article>;
}

export function ProjectInterviews({ rows, serverNow }: { rows: InterviewRow[]; serverNow: string }) {
  const router = useRouter();
  const [offset] = useState(() => Date.parse(serverNow) - Date.now());
  const [repoUrl, setRepoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    const result = await post({ action: "create", repoUrl });
    setBusy(false);
    if (!result.ok) { setError(result.data?.error?.message ?? "That did not work. Please try again."); return; }
    setRepoUrl(""); setMessage("Interview created. Follow step 1 below."); router.refresh();
  }

  return <div className="interviews">
    <section className="panel interview-new" aria-labelledby="interview-new-title">
      <div>
        <p className="eyebrow">PROVE A PROJECT</p>
        <h2 id="interview-new-title">Show you built it</h2>
        <p>Anyone can copy a repository. Explaining your own code is hard to fake: link a public GitHub project, prove it is yours, then answer four questions about specific lines in 20 minutes. A reviewer checks the answers against the code.</p>
      </div>
      <form className="interview-create" onSubmit={create}>
        <label>Public GitHub repository<input type="url" value={repoUrl} onChange={event => setRepoUrl(event.target.value)} placeholder="https://github.com/you/your-project" required maxLength={300} /></label>
        <button type="submit" className="button primary" disabled={busy || repoUrl.trim().length < 10}>{busy ? "Creating…" : "Start a project interview"}</button>
      </form>
      <div aria-live="polite">{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="notice" role="status">✓ {message}</p>}</div>
    </section>
    {rows.length ? rows.map(row => <Interview key={`${row.id}:${row.status}`} row={row} offset={offset} onChanged={text => { setMessage(text); router.refresh(); }} />)
      : <p className="fit-empty">No project interviews yet.</p>}
  </div>;
}
