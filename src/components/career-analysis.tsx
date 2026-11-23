"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { careerLabel, type CareerDetail, type CareerSummary, type EvidenceLevel, type Priority } from "@/lib/career-analysis/score";
import { careerExplanationResponseSchema, type CareerExplanation } from "@/lib/career-analysis/explain";

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const priorityLabel: Record<Priority, string> = { critical: "Critical", important: "Important", optional: "Optional" };
const evidenceLabel: Record<EvidenceLevel, string> = { proven: "Proven", profile: "On your profile", learned: "Learned", learning: "In progress", none: "Gap" };
type View = "gaps" | "covered" | "all";

function Ring({ score, size = "large" }: { score: number; size?: "large" | "small" }) {
  return <div className={`strength-ring${size === "small" ? " ring-small" : ""}`} role="img" aria-label={`Match ${score}%`}>
    <svg viewBox="0 0 120 120" aria-hidden="true"><circle className="ring-track" cx="60" cy="60" r={RADIUS} /><circle className="ring-value" cx="60" cy="60" r={RADIUS} strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE * (1 - score / 100)} /></svg>
    <span><strong>{score}<small>%</small></strong>{size === "large" && "match"}</span>
  </div>;
}

function Explain({ careerId }: { careerId: string }) {
  const [state, setState] = useState<{ id: string; explanation: CareerExplanation; removed: number; test: boolean; note: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = state?.id === careerId ? state : null;
  async function run() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/v1/career-analysis/explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ careerId }), signal: AbortSignal.timeout(70000) });
      const body = await response.json().catch(() => null);
      if (!response.ok) { setError(body?.error?.message ?? "The AI could not explain this right now."); return; }
      const parsed = careerExplanationResponseSchema.safeParse(body);
      if (!parsed.success) { setError("The AI answer could not be checked."); return; }
      setState({ id: careerId, explanation: parsed.data.explanation, removed: parsed.data.removed, test: parsed.data.model === "careerforge-test-ai", note: parsed.data.cached ? "Earlier answer for the same progress; no AI request used." : parsed.data.remaining !== null ? `AI requests left today: ${parsed.data.remaining}.` : "" });
    } catch { setError("The request did not finish. Try again."); }
    finally { setBusy(false); }
  }
  return <section className="panel fit-ai" aria-labelledby="career-ai-title" aria-busy={busy}>
    <div className="fit-ai-head">
      <h3 id="career-ai-title"><span aria-hidden="true">✦</span> AI coach{current?.test && <em>test AI, not real</em>}</h3>
      <button type="button" className={current ? "text-button" : "button primary"} onClick={run} disabled={busy}>{busy ? "Thinking…" : current ? "Explain again" : "Explain with AI"}</button>
    </div>
    {!current && !error && <p className="muted-note">The AI explains where you stand and picks your top three priorities from the gap list below. It cannot change the score. Uses one AI request.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {current && <div className="fit-ai-body">
      {current.explanation.summary && <p className="fit-ai-summary">{current.explanation.summary}</p>}
      {current.explanation.priorities.length > 0 && <ol className="career-priorities">{current.explanation.priorities.map(item => <li key={item.topic}><strong>{item.topic}</strong><span>{item.why}</span></li>)}</ol>}
      <p className="muted-note">{current.note}{current.removed > 0 ? ` ${current.removed} AI ${current.removed === 1 ? "suggestion was" : "suggestions were"} removed because ${current.removed === 1 ? "it was" : "they were"} not in your gap list.` : ""}</p>
    </div>}
  </section>;
}

export function CareerAnalysis({ ranked, detail, empty }: { ranked: CareerSummary[]; detail: CareerDetail; empty: boolean }) {
  const router = useRouter();
  const [view, setView] = useState<View>("gaps");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const PREVIEW = 6;
  const top = ranked.slice(0, 3);
  const isGap = (evidence: EvidenceLevel) => evidence === "none" || evidence === "learning";
  const shown = detail.topics.filter(topic => view === "all" ? true : view === "gaps" ? isGap(topic.evidence) && topic.priority !== "optional" : !isGap(topic.evidence));
  const groups = (["critical", "important", "optional"] as Priority[]).map(priority => ({ priority, topics: shown.filter(topic => topic.priority === priority) })).filter(group => group.topics.length);
  const counts = { gaps: detail.topics.filter(topic => isGap(topic.evidence) && topic.priority !== "optional").length, covered: detail.topics.filter(topic => !isGap(topic.evidence)).length, all: detail.topics.length };

  return <div className="career-page">
    {empty && <p className="notice">Your profile has no skills yet and nothing is marked on a roadmap, so every career starts at 0%. <Link href="/account" className="text-button">Add your skills</Link> or mark what you already know on a <Link href="/learning-roadmap" className="text-button">learning roadmap</Link>.</p>}
    <section aria-labelledby="career-top-title" className="career-top">
      <div className="career-top-head">
        <h2 id="career-top-title">Your closest careers</h2>
        <label className="career-select">Any career
          <select value={detail.id} onChange={event => router.push(`/career-analysis?career=${encodeURIComponent(event.target.value)}`)}>
            {ranked.map(career => <option key={career.id} value={career.id}>{career.title} · {career.score}%</option>)}
          </select>
        </label>
      </div>
      <ol className="career-cards">{top.map((career, index) => <li key={career.id}>
        <Link href={`/career-analysis?career=${encodeURIComponent(career.id)}`} className={`panel career-card${career.id === detail.id ? " selected" : ""}`} aria-current={career.id === detail.id ? "true" : undefined}>
          <span className="career-rank">#{index + 1}</span>
          <Ring score={career.score} size="small" />
          <span className="career-card-copy"><strong>{career.title}</strong><small>Critical {career.critical.done}/{career.critical.total} · Important {career.important.done}/{career.important.total}</small></span>
        </Link>
      </li>)}</ol>
    </section>

    <section className="panel career-detail" aria-labelledby="career-detail-title">
      <div className="fit-score">
        <Ring score={detail.score} />
        <div>
          <p className="eyebrow">TARGET CAREER</p>
          <h2 id="career-detail-title">{detail.title}</h2>
          <p className="career-tagline">{detail.tagline}</p>
          <p className={`fit-label label-${detail.score >= 75 ? "strong" : detail.score >= 50 ? "good" : detail.score >= 25 ? "partial" : "early"}`}>{careerLabel(detail.score)}</p>
        </div>
      </div>
      <div className="career-coverage">
        {(["critical", "important"] as const).map(priority => { const tally = detail[priority]; const percent = tally.total ? Math.round(tally.done / tally.total * 100) : 0; return <div key={priority}>
          <div className="fit-factor-head"><strong>{priorityLabel[priority]} topics</strong><span>{tally.done} of {tally.total}</span></div>
          <div className={`fit-bar bar-${priority}`} aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>
        </div>; })}
        <p className="muted-note">Critical topics are the foundations in the first half of the roadmap; Important ones come after. Optional topics never lower your match.</p>
        {detail.score < 50 && <p className="career-hint"><strong>Already know some of these?</strong> Mark them as known on the roadmap; they count as learned and raise this match right away. Proving a skill raises it most.</p>}
        <Link href={`/learning-roadmap/${detail.id}`} className="button primary career-open">Open the {detail.title} roadmap <span aria-hidden="true">→</span></Link>
      </div>
    </section>

    <Explain careerId={detail.id} />

    <section className="panel career-gaps" aria-labelledby="career-gaps-title">
      <div className="fit-picker-head">
        <h2 id="career-gaps-title">Topic by topic</h2>
        <div className="fit-tabs" role="tablist" aria-label="Show topics">
          {(["gaps", "covered", "all"] as View[]).map(option => <button key={option} type="button" role="tab" aria-selected={view === option} onClick={() => setView(option)}>{option === "gaps" ? "Gaps" : option === "covered" ? "Covered" : "All"} ({counts[option]})</button>)}
        </div>
      </div>
      {!groups.length ? <p className="fit-empty">{view === "gaps" ? "No Critical or Important gaps. Make sure your skills are proven." : "Nothing covered yet. Add skills to your profile or mark topics you know on the roadmap."}</p>
        : groups.map(group => { const key = `${view}:${group.priority}`; const open = expanded.has(key); const list = open ? group.topics : group.topics.slice(0, PREVIEW); return <div key={group.priority} className="career-group">
          <h3><span className={`priority-chip priority-${group.priority}`}>{priorityLabel[group.priority]}</span> {group.topics.length} {group.topics.length === 1 ? "topic" : "topics"}</h3>
          <ul>{list.map(topic => <li key={topic.id} className={`career-topic evidence-${topic.evidence}`}>
            <span className="career-topic-main"><strong>{topic.title}</strong><small>{topic.evidence === "none" ? topic.section : `${topic.section} · ${topic.detail}`}</small></span>
            {topic.evidence !== "none" ? <span className={`evidence-chip evidence-${topic.evidence}`}>{evidenceLabel[topic.evidence]}</span> : null}
            <Link href={topic.href} className="text-button">{isGap(topic.evidence) ? "Learn" : "Review"}<span className="sr-only"> {topic.title}</span> <span aria-hidden="true">→</span></Link>
          </li>)}</ul>
          {group.topics.length > PREVIEW && <button type="button" className="text-button career-more" aria-expanded={open} onClick={() => setExpanded(current => { const next = new Set(current); if (open) next.delete(key); else next.add(key); return next; })}>{open ? "Show fewer" : `Show all ${group.topics.length}`}</button>}
        </div>; })}
    </section>

    <p className="muted-note fit-disclaimer">Computed from your profile skills, your proof and the topics you marked on CareerForge roadmaps, the same way every time. Proven skills count fully, self-declared ones 80%, learned topics 70%. It is a guide to what to learn next, not a hiring prediction.</p>
  </div>;
}
