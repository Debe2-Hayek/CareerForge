"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PASS_MARK, QUESTION_COUNT, type CheckSession } from "@/lib/skill-checks";
import { SkillCheckRunner } from "./skill-check-runner";

export type CheckCard = {
  skill: string; onProfile: boolean; passedAt: string | null; lastScore: number | null; retryAt: string | null; learnHref: string | null;
};

const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
function waitText(iso: string, now: number) {
  const hours = Math.max(1, Math.ceil((Date.parse(iso) - now) / 3600000));
  return hours >= 2 ? `Try again in ${hours} hours` : "Try again within the hour";
}

/**
 * Skill checks, as part of verification: every skill with a check, where you stand on it, and one clear
 * action. A check opens in place (one question at a time), and ?skill=React opens that one directly.
 */
export function SkillChecks({ cards, initialSession, focus }: { cards: CheckCard[]; initialSession: CheckSession | null; focus: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState<{ skill: string; intro: boolean } | null>(() => {
    if (initialSession) return { skill: initialSession.skill, intro: false };
    const wanted = focus ? cards.find(card => card.skill.toLowerCase() === focus.toLowerCase()) : null;
    return wanted && !wanted.passedAt && !wanted.retryAt ? { skill: wanted.skill, intro: true } : null;
  });
  const [now] = useState(() => Date.now());
  const grid = useRef<HTMLDivElement>(null);
  const opener = useRef<string | null>(null);
  const card = open ? cards.find(item => item.skill.toLowerCase() === open.skill.toLowerCase()) : null;
  const sorted = useMemo(() => [...cards].sort((a, b) => Number(Boolean(b.onProfile && !b.passedAt)) - Number(Boolean(a.onProfile && !a.passedAt)) || a.skill.localeCompare(b.skill)), [cards]);
  const verified = cards.filter(item => item.passedAt).length;

  // Coming back from a check puts the focus back on its card.
  useEffect(() => {
    if (open || !opener.current) return;
    grid.current?.querySelector<HTMLElement>(`[data-skill="${CSS.escape(opener.current)}"] button, [data-skill="${CSS.escape(opener.current)}"] a`)?.focus();
    opener.current = null;
  }, [open]);
  // A deep link to a skill that is already passed or waiting scrolls to its card instead.
  useEffect(() => {
    if (!focus || open) return;
    grid.current?.querySelector<HTMLElement>(`[data-skill="${CSS.escape(cards.find(item => item.skill.toLowerCase() === focus.toLowerCase())?.skill ?? "")}"]`)?.scrollIntoView({ block: "center" });
  }, [focus, open, cards]);

  function close() { opener.current = open?.skill ?? null; setOpen(null); router.refresh(); }

  return <div className="account-content checks-page">
    <div className="page-heading checks-heading">
      <div>
        <p className="eyebrow">VERIFICATION · SKILL CHECKS</p>
        <h1>Prove a skill, get a ✓<span>.</span></h1>
        <p>{QUESTION_COUNT} questions on the fundamentals. No time limit. Get {PASS_MARK} right and the skill is Verified on your profile, CV and portfolio.</p>
      </div>
      <Link href="/account/verification" className="button ghost">All verification <span aria-hidden="true">→</span></Link>
    </div>

    <ol className="trust-ladder" aria-label="How a skill earns trust">
      <li><span className="ladder-dot" aria-hidden="true" /><b>Self-declared</b><small>You list the skill</small></li>
      <li><span className="ladder-dot" aria-hidden="true" /><b>Reviewed</b><small>A reviewer checks your proof</small></li>
      <li data-here><span className="ladder-dot" aria-hidden="true">✓</span><b>Verified</b><small>You pass its check here</small></li>
    </ol>

    {open && card ? <section className="panel check-panel" aria-label={`${card.skill} check`}>
      <button type="button" className="check-back text-button" onClick={close}><span aria-hidden="true">←</span> All checks</button>
      <SkillCheckRunner skill={card.skill} onProfile={card.onProfile} initialSession={initialSession && initialSession.skill.toLowerCase() === card.skill.toLowerCase() ? initialSession : null}
        withIntro={open.intro} learnHref={card.learnHref} onClose={close} />
    </section> : <>
      <p className="checks-count">{verified ? `${verified} of ${cards.length} skills verified` : `${cards.length} skills have a check`}</p>
      <div ref={grid} className="checks-grid">{sorted.map(item => {
        const resumable = initialSession?.skill.toLowerCase() === item.skill.toLowerCase();
        const state = resumable ? "open" : item.passedAt ? "passed" : item.retryAt ? "wait" : item.onProfile ? "ready" : "add";
        return <article key={item.skill} className="panel check-card" data-state={state} data-skill={item.skill} data-focus={focus?.toLowerCase() === item.skill.toLowerCase() || undefined}>
          <div className="check-card-top">
            <span className="check-mono" aria-hidden="true">{item.skill.slice(0, 2)}</span>
            <span className="check-state">{state === "passed" ? <><i aria-hidden="true">✓</i>Verified</> : state === "wait" ? "Not yet" : state === "open" ? "In progress" : state === "ready" ? "On your profile" : "Not on your profile"}</span>
          </div>
          <h2>{item.skill}</h2>
          <p className="check-card-meta">{state === "passed" ? `Passed ${day.format(new Date(item.passedAt!))}` : state === "wait" ? `${item.lastScore ?? 0}/${QUESTION_COUNT} last time · ${waitText(item.retryAt!, now)}` : `${QUESTION_COUNT} questions · ${PASS_MARK} to pass · no time limit`}</p>
          <div className="check-card-actions">
            {state === "wait"
              ? item.learnHref ? <Link href={item.learnHref} className="button ghost">Learn {item.skill} <span aria-hidden="true">→</span></Link> : <span className="check-card-wait">Come back later</span>
              : <button type="button" className={state === "passed" ? "button ghost" : "button primary"} onClick={() => setOpen({ skill: item.skill, intro: state === "add" })}>
                {state === "open" ? "Continue" : state === "passed" ? "Take again" : state === "ready" ? "Start check" : "Add & start"}
              </button>}
            {state !== "wait" && item.learnHref && state !== "passed" && <Link href={item.learnHref} className="text-button">Free roadmap</Link>}
          </div>
        </article>;
      })}</div>
      <p className="muted-note checks-foot">Checks cover the fundamentals only; they are not proof of mastery or professional experience. Each attempt shows the questions in a new order and is graded on our server. For a skill without a check, <Link href="/account/verification">send proof from Verification</Link> and a reviewer will look at it.</p>
    </>}
  </div>;
}
