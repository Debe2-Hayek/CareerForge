"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { InterviewQueueItem } from "@/lib/project-interview/server";
import type { InterviewReview } from "@/lib/project-interview/ai";

const suggestionText = { likely_own_work: "Answers fit the code well", unclear: "Mixed: read the answers closely", likely_not_own_work: "Answers do not fit the code" } as const;
const minutes = (start: string | null, end: string | null) => start && end ? Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 60000)) : null;

async function post(body: unknown) {
  const response = await fetch("/api/v1/admin/interviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) }).catch(() => null);
  return { ok: !!response?.ok, data: await response?.json().catch(() => null) };
}

function ReviewCard({ item, onDone }: { item: InterviewQueueItem; onDone: (text: string) => void }) {
  const [review, setReview] = useState<(InterviewReview & { ownership: boolean }) | null>(item.aiReview as (InterviewReview & { ownership: boolean }) | null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const repo = `${item.repoOwner}/${item.repoName}`;
  const at = item.commitSha ? `https://github.com/${repo}/blob/${item.commitSha}` : `https://github.com/${repo}`;
  const used = minutes(item.startedAt, item.submittedAt);
  const test = review?.model === "careerforge-test-ai";

  async function runReview() {
    setBusy("review"); setError("");
    const result = await post({ action: "review", id: item.id });
    setBusy(null);
    if (!result.ok) { setError(result.data?.error?.message ?? "The AI review could not run."); return; }
    setReview(result.data.review);
  }
  async function decide(decision: "approve" | "reject") {
    if (decision === "reject" && !note.trim()) { setError("Write a short reason the student will see."); return; }
    setBusy(decision); setError("");
    const result = await post({ action: "decide", id: item.id, decision, note: decision === "reject" ? note.trim() : "" });
    setBusy(null);
    if (!result.ok) { setError(result.data?.error?.message ?? "The decision could not be saved."); return; }
    onDone(`${decision === "approve" ? "Approved" : "Rejected"}: ${repo}`);
  }

  return <article className="panel interview-review" aria-labelledby={`ir-${item.id}`}>
    <header className="interview-head">
      <div>
        <p className="eyebrow">PROJECT INTERVIEW · {item.ownerName}</p>
        <h3 id={`ir-${item.id}`}><a href={`https://github.com/${repo}${item.commitSha ? `/tree/${item.commitSha}` : ""}`} target="_blank" rel="noopener noreferrer">{repo} ↗</a></h3>
        <small>Commit {item.commitSha?.slice(0, 7) ?? "?"} · answered in {used ?? "?"} of 20 minutes · ownership code <code>{item.ownershipCode}</code></small>
      </div>
      <button type="button" className={review ? "text-button" : "button primary"} onClick={runReview} disabled={!!busy}>{busy === "review" ? "Reading code and answers…" : review ? "Run again" : "✦ Run AI review"}</button>
    </header>
    {review && <div className={`interview-summary suggestion-${review.suggestion}`}>
      <strong>{review.total} / {review.max}</strong>
      <span>{suggestionText[review.suggestion]}{test && <em>test AI, not real</em>}</span>
      <span className={review.ownership ? "ok" : "no"}>{review.ownership ? "✓ Ownership code found at this commit" : "✗ Ownership code NOT found at this commit"}</span>
      {review.citations.some(citation => !citation.ok) && <p className="interview-forgery" role="note"><strong>✗ {review.citations.filter(citation => !citation.ok).length} of {review.citations.length} questions do not match the repository.</strong> CareerForge never writes such questions; they were probably changed outside the app. Reject unless you can explain it.</p>}
    </div>}
    <ol className="interview-answers">
      {(item.questions ?? []).map((question, index) => {
        const score = review?.scores.find(entry => entry.id === question.id);
        const cited = review?.citations.find(entry => entry.id === question.id);
        return <li key={question.id}>
          <p className="interview-q"><strong>{index + 1}. {question.question}</strong></p>
          <p className="interview-ref"><a href={`${at}/${question.file.split("/").map(encodeURIComponent).join("/")}#L${question.startLine}-L${question.endLine}`} target="_blank" rel="noopener noreferrer"><code>{question.file}</code> lines {question.startLine}–{question.endLine} ↗</a>
            {cited && <span className={cited.ok ? "ok" : "no"}>{cited.ok ? "✓ quote matches the repository" : "✗ quote not found in the repository"}</span>}</p>
          <pre className="interview-quote"><code>{question.quote}</code></pre>
          <blockquote className="interview-answer">{item.answers?.[question.id]?.trim() || <em>No answer</em>}</blockquote>
          {score && <p className={`interview-score score-${score.score}`}><strong>{score.score}/2</strong> {score.reason}</p>}
        </li>;
      })}
    </ol>
    {review && <p className="muted-note">The AI only scores answers against the code; you decide. A convincing answer can still be rehearsed, and a nervous student can still be the author.</p>}
    {item.own ? <p className="muted-note">This is your own interview; another reviewer must decide it.</p> : <>
      {rejecting && <label className="review-reason">Reason the student will see<textarea rows={2} maxLength={500} value={note} onChange={event => setNote(event.target.value)} autoFocus placeholder="For example: the answers do not match what the code does." /></label>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="review-actions">
        {rejecting ? <><button type="button" className="text-button" onClick={() => { setRejecting(false); setError(""); }} disabled={!!busy}>Cancel</button><button type="button" className="button review-reject" onClick={() => decide("reject")} disabled={!!busy}>{busy === "reject" ? "Saving…" : "Reject with reason"}</button></>
          : <><button type="button" className="text-button" onClick={() => setRejecting(true)} disabled={!!busy}>Reject…</button><button type="button" className="button primary" onClick={() => decide("approve")} disabled={!!busy}>{busy === "approve" ? "Saving…" : "Approve: they know this code"}</button></>}
      </div>
    </>}
  </article>;
}

export function InterviewReviewQueue({ items }: { items: InterviewQueueItem[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  return <div className="review-queue">
    <div aria-live="polite">{message && <p className="notice" role="status">✓ {message}</p>}</div>
    {!items.length ? <div className="empty-state"><h2>No interviews to review.</h2><p>Submitted project interviews appear here, oldest first.</p></div>
      : items.map(item => <ReviewCard key={item.id} item={item} onDone={text => { setMessage(text); router.refresh(); }} />)}
  </div>;
}
