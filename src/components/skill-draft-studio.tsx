"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { draftRowSchema, reviewDraft, type BankOverview, type DraftQuestion, type DraftRow } from "@/lib/skill-check-drafts";

const day = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });
const letters = ["A", "B", "C"];
const blank = (): DraftQuestion => ({ prompt: "", options: ["", "", ""], answer: 0, explanation: "" });

async function post(body: unknown) {
  const response = await fetch("/api/v1/admin/skill-checks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(70000) });
  const data = await response.json().catch(() => null);
  return { ok: response.ok, data };
}
function asQuestions(raw: unknown[]): DraftQuestion[] {
  const list = raw.map(item => {
    const value = (item ?? {}) as Partial<DraftQuestion>;
    return { prompt: value.prompt ?? "", options: [0, 1, 2].map(i => value.options?.[i] ?? ""), answer: value.answer ?? 0, explanation: value.explanation ?? "" };
  });
  while (list.length < 5) list.push(blank());
  return list.slice(0, 5);
}

function DraftEditor({ draft, onChanged }: { draft: DraftRow; onChanged: (text: string) => void }) {
  const [questions, setQuestions] = useState(() => asQuestions(draft.questions));
  const [saved, setSaved] = useState(() => JSON.stringify(asQuestions(draft.questions)));
  const [busy, setBusy] = useState<"save" | "publish" | "discard" | null>(null);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(questions) !== saved;
  const review = useMemo(() => reviewDraft(questions), [questions]);
  const testAi = draft.model === "careerforge-test-ai";
  const issuesFor = (index: number) => [...review.errors, ...review.warnings].filter(issue => issue.question === index + 1);

  const update = (index: number, change: Partial<DraftQuestion>) => setQuestions(list => list.map((question, i) => i === index ? { ...question, ...change } : question));
  async function act(action: "save" | "publish" | "discard") {
    if (busy) return;
    if (action === "discard" && !window.confirm(`Discard the ${draft.skill} draft?`)) return;
    if (action === "publish" && !window.confirm(`Publish these 5 questions for ${draft.skill}? Students who list ${draft.skill} can take the check right away.`)) return;
    setBusy(action); setError("");
    const result = await post(action === "save" ? { action, id: draft.id, questions } : { action, id: draft.id }).catch(() => null);
    setBusy(null);
    if (!result?.ok) {
      const details = Array.isArray(result?.data?.error?.details) ? result.data.error.details.map((issue: { question: number | null; message: string }) => `${issue.question ? `Q${issue.question}: ` : ""}${issue.message}`).join(" ") : "";
      setError(`${result?.data?.error?.message ?? "That did not work. Please try again."} ${details}`.trim());
      return;
    }
    if (action === "save") {
      const parsed = draftRowSchema.safeParse(result.data?.draft);
      if (parsed.success) setSaved(JSON.stringify(asQuestions(parsed.data.questions)));
      onChanged(`Saved the ${draft.skill} draft.`);
    } else onChanged(action === "publish" ? `Published: ${draft.skill} version ${result.data?.published?.version}. Students can take it now.` : `Discarded the ${draft.skill} draft.`);
  }

  return <article className="panel draft-card" aria-labelledby={`draft-${draft.id}`}>
    <header className="draft-head">
      <div>
        <p className="eyebrow">DRAFT · {draft.model ? (testAi ? "TEST AI, NOT REAL" : "AI-DRAFTED, NEEDS YOUR REVIEW") : "WRITTEN BY HAND"}</p>
        <h3 id={`draft-${draft.id}`}>{draft.skill}{draft.focus && <small> · {draft.focus}</small>}</h3>
      </div>
      <div className={`draft-health${review.errors.length ? " has-errors" : ""}`} role="status">
        {review.errors.length ? `${review.errors.length} to fix before publishing` : review.warnings.length ? `Ready · ${review.warnings.length} to double-check` : "Ready to publish"}
      </div>
    </header>
    <ol className="draft-questions">
      {questions.map((question, index) => {
        const issues = issuesFor(index);
        return <li key={index} className="draft-question">
          <label className="draft-field"><span>Question {index + 1}</span>
            <textarea rows={2} maxLength={300} value={question.prompt} onChange={event => update(index, { prompt: event.target.value })} placeholder="Describe a situation or show a short snippet, then ask what happens or what to do." />
          </label>
          <fieldset className="draft-options">
            <legend>Options: choose the correct one</legend>
            {question.options.map((option, optionIndex) => <div key={optionIndex} className={`draft-option${question.answer === optionIndex ? " correct" : ""}`}>
              <input type="radio" name={`answer-${draft.id}-${index}`} checked={question.answer === optionIndex} onChange={() => update(index, { answer: optionIndex })} aria-label={`Option ${letters[optionIndex]} is correct`} />
              <span aria-hidden="true">{letters[optionIndex]}</span>
              <input type="text" maxLength={160} value={option} aria-label={`Option ${letters[optionIndex]} for question ${index + 1}`} onChange={event => update(index, { options: question.options.map((value, i) => i === optionIndex ? event.target.value : value) })} />
            </div>)}
          </fieldset>
          <label className="draft-field"><span>Why the answer is right (only reviewers see this)</span>
            <textarea rows={2} maxLength={400} value={question.explanation} onChange={event => update(index, { explanation: event.target.value })} />
          </label>
          {issues.length > 0 && <ul className="draft-issues">{issues.map((issue, i) => <li key={i} className={review.errors.includes(issue) ? "error" : "warning"}>{issue.message}</li>)}</ul>}
        </li>;
      })}
    </ol>
    {review.errors.filter(issue => issue.question === null).concat(review.warnings.filter(issue => issue.question === null)).map((issue, i) => <p key={i} className="draft-issues-global">{issue.message}</p>)}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="draft-actions">
      <button type="button" className="text-button" onClick={() => act("discard")} disabled={!!busy}>Discard</button>
      <span className="draft-save-state">{dirty ? "Unsaved changes" : "All changes saved"}</span>
      <button type="button" className="button" onClick={() => act("save")} disabled={!!busy || !dirty}>{busy === "save" ? "Saving…" : "Save draft"}</button>
      <button type="button" className="button primary" onClick={() => act("publish")} disabled={!!busy || dirty || review.errors.length > 0} title={dirty ? "Save first" : review.errors.length ? "Fix the marked questions first" : undefined}>{busy === "publish" ? "Publishing…" : "Publish check"}</button>
    </div>
  </article>;
}

export function SkillDraftStudio({ drafts, live }: { drafts: DraftRow[]; live: BankOverview[] }) {
  const router = useRouter();
  const [skill, setSkill] = useState("");
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState<"generate" | "create" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const open = drafts.filter(draft => draft.status === "draft");

  async function start(event: FormEvent<HTMLFormElement>, action: "generate" | "create") {
    event.preventDefault();
    if (busy || !skill.trim()) return;
    setBusy(action); setError(""); setMessage("");
    const result = await post({ action, skill: skill.trim(), focus: focus.trim() }).catch(() => null);
    setBusy(null);
    if (!result?.ok) { setError(result?.data?.error?.message ?? "That did not work. Please try again."); return; }
    setMessage(action === "generate" ? `Drafted 5 questions for ${skill.trim()}. Review every one before publishing.` : `Started a blank ${skill.trim()} draft.`);
    setSkill(""); setFocus("");
    router.refresh();
  }

  return <div className="skill-studio">
    <section className="panel studio-new" aria-labelledby="studio-new-title">
      <div>
        <p className="eyebrow">NEW CHECK</p>
        <h2 id="studio-new-title">Draft 5 timed questions for any skill</h2>
        <p>The AI writes practical questions with three options and an explanation. You edit and approve them; nothing reaches students until you publish. Students get 10 minutes (100 with extended time) and need 4 of 5 to pass.</p>
      </div>
      <form className="studio-form" onSubmit={event => start(event, "generate")}>
        <label>Skill<input value={skill} onChange={event => setSkill(event.target.value)} maxLength={60} placeholder="Python, Docker, Excel, Figma…" required /></label>
        <label>Focus <small>(optional)</small><input value={focus} onChange={event => setFocus(event.target.value)} maxLength={200} placeholder="For example: lists, loops and functions" /></label>
        <div className="studio-buttons">
          <button type="submit" className="button primary" disabled={!!busy || !skill.trim()}>{busy === "generate" ? "Drafting…" : "✦ Draft with AI"}</button>
          <button type="button" className="text-button" disabled={!!busy || !skill.trim()} onClick={event => start(event as unknown as FormEvent<HTMLFormElement>, "create")}>{busy === "create" ? "Starting…" : "Write them myself"}</button>
        </div>
      </form>
      <div aria-live="polite">
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="notice" role="status">✓ {message}</p>}
      </div>
    </section>

    {open.length > 0 && <section aria-labelledby="studio-drafts-title" className="studio-section">
      <h2 id="studio-drafts-title">Drafts to review <span>{open.length}</span></h2>
      {open.map(draft => <DraftEditor key={`${draft.id}:${draft.updated_at}`} draft={draft} onChanged={text => { setMessage(text); router.refresh(); }} />)}
    </section>}

    <section className="panel studio-live" aria-labelledby="studio-live-title">
      <h2 id="studio-live-title">Live checks</h2>
      {!live.length ? <p className="muted-note">No checks are live yet.</p> : <table>
        <thead><tr><th scope="col">Skill</th><th scope="col">Version</th><th scope="col">Written by</th><th scope="col">Published</th><th scope="col">Attempts</th><th scope="col">Pass rate</th></tr></thead>
        <tbody>{live.map(bank => <tr key={bank.skill}>
          <th scope="row">{bank.skill}</th><td data-label="Version">v{bank.version}</td><td data-label="Written by">{bank.source === "ai_reviewed" ? "AI draft, reviewed" : "CareerForge"}</td>
          <td data-label="Published">{day.format(new Date(bank.publishedAt))}</td><td data-label="Attempts">{bank.attempts}</td><td data-label="Pass rate">{bank.attempts ? `${Math.round((bank.passes / bank.attempts) * 100)}%` : "–"}</td>
        </tr>)}</tbody>
      </table>}
      <p className="muted-note">Publishing a new draft for an existing skill creates the next version; earlier passes stay valid.</p>
    </section>
  </div>;
}
