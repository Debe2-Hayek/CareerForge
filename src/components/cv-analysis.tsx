"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { analyseFit, type CandidateInput } from "@/lib/cv-analysis/score";
import { explanationResponseSchema, type Explanation } from "@/lib/cv-analysis/explain";
import type { AnalysisJob } from "@/lib/cv-analysis/server";
import { ClaimBadge } from "./claim-badge";

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
type Pasted = { title: string; company: string; description: string };

function Explain({ request, signature }: { request: { jobId: string } | { pasted: Pasted }; signature: string }) {
  const [state, setState] = useState<{ signature: string; explanation: Explanation; removed: number; test: boolean; note: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = state?.signature === signature ? state : null;

  async function run() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/v1/cv-analysis/explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request), signal: AbortSignal.timeout(70000) });
      const body = await response.json().catch(() => null);
      if (!response.ok) { setError(body?.error?.message ?? "The AI could not explain this right now."); return; }
      const parsed = explanationResponseSchema.safeParse(body);
      if (!parsed.success) { setError("The AI answer could not be checked."); return; }
      setState({ signature, explanation: parsed.data.explanation, removed: parsed.data.removed, test: parsed.data.model === "careerforge-test-ai", note: parsed.data.cached ? "Earlier answer for the same profile and job; no AI request used." : parsed.data.remaining !== null ? `AI requests left today: ${parsed.data.remaining}.` : "" });
    } catch { setError("The request did not finish. Try again."); }
    finally { setBusy(false); }
  }

  return <section className="panel fit-ai" aria-labelledby="fit-ai-title" aria-busy={busy}>
    <div className="fit-ai-head">
      <h3 id="fit-ai-title"><span aria-hidden="true">✦</span> AI explanation{current?.test && <em>test AI, not real</em>}</h3>
      <button type="button" className={current ? "text-button" : "button primary"} onClick={run} disabled={busy}>{busy ? "Thinking…" : current ? "Explain again" : "Explain with AI"}</button>
    </div>
    {!current && !error && <p className="muted-note">The AI explains this score in plain words and suggests how to present what you already have. It cannot change the score and only uses facts from your profile. Uses one AI request.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {current && <div className="fit-ai-body">
      {current.explanation.summary && <p className="fit-ai-summary">{current.explanation.summary}</p>}
      <div className="fit-ai-columns">
        {current.explanation.strengths.length > 0 && <div><h4>What works</h4><ul>{current.explanation.strengths.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
        {current.explanation.gaps.length > 0 && <div><h4>Gaps to close</h4><ul>{current.explanation.gaps.map((gap, i) => <li key={i}><strong>{gap.item}:</strong> {gap.suggestion}</li>)}</ul></div>}
        {current.explanation.cvTips.length > 0 && <div><h4>CV tips</h4><ul>{current.explanation.cvTips.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
      </div>
      <p className="muted-note">{current.note}{current.removed > 0 ? ` ${current.removed} AI ${current.removed === 1 ? "suggestion was" : "suggestions were"} removed because ${current.removed === 1 ? "it" : "they"} claimed something not in your profile.` : ""}</p>
    </div>}
  </section>;
}

export function CvAnalysis({ candidate, jobs, initialJobId }: { candidate: CandidateInput; jobs: AnalysisJob[]; initialJobId: string | null }) {
  const [mode, setMode] = useState<"saved" | "paste">(jobs.length ? "saved" : "paste");
  const [selected, setSelected] = useState(() => jobs.find(job => job.id === initialJobId)?.id ?? jobs[0]?.id ?? null);
  const [draft, setDraft] = useState<Pasted>({ title: "", company: "", description: "" });
  const [pasted, setPasted] = useState<Pasted | null>(null);

  const job = useMemo(() => mode === "saved" ? jobs.find(item => item.id === selected) ?? null : pasted ? { ...pasted, id: null, skills: [], experienceLevel: null, source: "Pasted job", location: "" } : null, [mode, jobs, selected, pasted]);
  const analysis = useMemo(() => job ? analyseFit(job, candidate) : null, [job, candidate]);
  const profileEmpty = !candidate.skills.length && !candidate.experience.length && !candidate.education.length;

  function analysePasted(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.title.trim().length < 2 || draft.description.trim().length < 40) return;
    setPasted({ title: draft.title.trim(), company: draft.company.trim(), description: draft.description.trim() });
  }

  return <div className="fit-page">
    <section className="panel fit-picker" aria-labelledby="fit-picker-title">
      <div className="fit-picker-head">
        <h2 id="fit-picker-title">Choose a job</h2>
        <div className="fit-tabs" role="tablist" aria-label="Job source">
          <button type="button" role="tab" aria-selected={mode === "saved"} onClick={() => setMode("saved")}>Saved jobs{jobs.length ? ` (${jobs.length})` : ""}</button>
          <button type="button" role="tab" aria-selected={mode === "paste"} onClick={() => setMode("paste")}>Paste a job</button>
        </div>
      </div>
      {mode === "saved" ? (jobs.length ? <div className="fit-jobs" role="radiogroup" aria-label="Saved jobs">
        {jobs.map(item => <label key={item.id} className={`fit-job${selected === item.id ? " selected" : ""}`}>
          <input type="radio" name="fit-job" checked={selected === item.id} onChange={() => setSelected(item.id)} />
          <span><strong>{item.title}</strong><small>{item.company}{item.location ? ` · ${item.location}` : ""} · {item.source}</small></span>
        </label>)}
      </div> : <p className="fit-empty">No saved jobs yet. <Link href="/jobs" className="text-button">Find opportunities</Link> and save the ones you like, or paste a job description.</p>)
      : <form className="fit-paste" onSubmit={analysePasted}>
        <label>Job title<input value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} maxLength={160} placeholder="Junior Backend Developer" required /></label>
        <label>Company <small>(optional)</small><input value={draft.company} onChange={event => setDraft({ ...draft, company: event.target.value })} maxLength={120} /></label>
        <label className="full">Job description<textarea rows={6} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} maxLength={8000} placeholder="Paste the requirements and responsibilities from the posting." required /></label>
        <div className="full fit-paste-foot"><small>{draft.description.trim().length < 40 ? `${40 - draft.description.trim().length} more characters to go` : `${draft.description.trim().length.toLocaleString("en")} / 8,000`}</small><button type="submit" className="button primary" disabled={draft.title.trim().length < 2 || draft.description.trim().length < 40}>Analyse this job</button></div>
      </form>}
    </section>

    {profileEmpty && <p className="notice">Your profile has no skills, work or education yet, so every job scores low. <Link href="/account" className="text-button">Fill in your profile</Link> first; AI autofill can read your CV.</p>}

    {job && analysis ? <>
      <section className="panel fit-result" aria-labelledby="fit-result-title">
        <div className="fit-score">
          <div className="strength-ring" role="img" aria-label={`Match ${analysis.score}%`}>
            <svg viewBox="0 0 120 120" aria-hidden="true"><circle className="ring-track" cx="60" cy="60" r={RADIUS} /><circle key={job.title} className="ring-value" cx="60" cy="60" r={RADIUS} strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE * (1 - analysis.score / 100)} /></svg>
            <span><strong>{analysis.score}<small>%</small></strong>match</span>
          </div>
          <div>
            <p className="eyebrow">{job.source.toUpperCase()}</p>
            <h2 id="fit-result-title">{job.title}{job.company && <small> · {job.company}</small>}</h2>
            <p className={`fit-label label-${analysis.score >= 75 ? "strong" : analysis.score >= 55 ? "good" : analysis.score >= 35 ? "partial" : "early"}`}>{analysis.label}</p>
            {job.id && <Link href={`/cv-analysis?job=${encodeURIComponent(job.id)}`} className="text-button fit-permalink">Link to this analysis</Link>}
          </div>
        </div>
        <ul className="fit-factors">{analysis.factors.map(factor => <li key={factor.id} className={factor.score === null ? "na" : undefined}>
          <div className="fit-factor-head"><strong>{factor.label}</strong><span>{factor.score === null ? "Not assessed" : `${Math.round(factor.score * 100)}%`}<small> · weight {factor.weight}%</small></span></div>
          <div className="fit-bar" aria-hidden="true"><span style={{ width: `${Math.round((factor.score ?? 0) * 100)}%` }} /></div>
          <p>{factor.detail}</p>
        </li>)}</ul>
      </section>

      <div className="fit-grid">
        <section className="panel fit-skills" aria-labelledby="fit-skills-title">
          <h3 id="fit-skills-title">Skills the job lists</h3>
          {!analysis.skills.length ? <p className="muted-note">No skills CareerForge recognises were found in this posting.</p> : <>
            <ul className="fit-skill-list">{analysis.skills.filter(skill => skill.matched).map(skill => <li key={skill.name} className="have"><span>✓ {skill.name}</span>{skill.link?.relation === "shows" && <small className="fit-via">via {skill.link.via}</small>}<ClaimBadge status={skill.status ?? "self_declared"} compact /></li>)}</ul>
            <ul className="fit-skill-list">{analysis.skills.filter(skill => !skill.matched).map(skill => <li key={skill.name} className={skill.link ? "related" : "missing"}><span>{skill.link ? "≈" : "✗"} {skill.name}</span><small>{skill.link ? `close to your ${skill.link.via} · half credit` : "not on your profile"}</small></li>)}</ul>
          </>}
        </section>
        <section className="panel fit-steps" aria-labelledby="fit-steps-title">
          <h3 id="fit-steps-title">Your next steps</h3>
          {analysis.steps.length ? <ol>{analysis.steps.map((step, i) => <li key={i}><Link href={step.href}>{step.text}<span aria-hidden="true"> →</span></Link></li>)}</ol> : <p className="muted-note">Nothing obvious to add: your profile covers what this job lists. Make sure your proof is up to date.</p>}
        </section>
      </div>

      <Explain request={job.id ? { jobId: job.id } : { pasted: pasted! }} signature={job.id ?? `${job.title}|${job.description.length}`} />
      <p className="muted-note fit-disclaimer">A comparison of your saved profile with this posting, computed the same way every time. It is not a hiring prediction. Skills from live postings are detected by keyword and may be incomplete; always read the full posting.</p>
    </> : mode === "paste" && !pasted ? null : !jobs.length ? null : <p className="muted-note">Choose a job to see your match.</p>}
  </div>;
}
