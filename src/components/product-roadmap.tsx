"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { ProductRoadmapNode, ProductRoadmapView, RoadmapHorizon, RoadmapStatus } from "@/lib/product-roadmap";
import styles from "./product-roadmap.module.css";

type FeedbackCounts = Record<string, { upvotes: number; frictionReports: number }>;
type View = "graph" | "board";

const statusLabels: Record<RoadmapStatus, string> = {
  done: "Built",
  "in-progress": "In progress",
  planned: "Planned",
  "upstream-new": "Upstream new"
};
const horizonLabels: Record<RoadmapHorizon, string> = { now: "Now", next: "Next", later: "Later" };
const formatDate = (value: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));

function isTyping(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return !!element && (element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName));
}

function RoadmapNodeCard({ node, count, onOpen }: { node: ProductRoadmapNode; count?: FeedbackCounts[string]; onOpen: () => void }) {
  return <button type="button" className={styles.node} data-status={node.status} onClick={onOpen} aria-label={`Open ${node.title} proof and feedback`}>
    <span className={styles.nodeTop}><span className={styles.status}><i />{statusLabels[node.status]}</span><span className={styles.score}>{node.uxImpactScore}</span></span>
    <strong>{node.title}</strong>
    <span className={styles.nodeSummary}>{node.summary}</span>
    <span className={styles.nodeMeta}><span>{node.category}</span><span>{count?.upvotes ?? 0} votes</span></span>
  </button>;
}

export function ProductRoadmap({ roadmap }: { roadmap: ProductRoadmapView }) {
  const [view, setView] = useState<View>("graph");
  const [query, setQuery] = useState("");
  const [track, setTrack] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [counts, setCounts] = useState<FeedbackCounts>({});
  const [friction, setFriction] = useState("");
  const [feedbackState, setFeedbackState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const search = useRef<HTMLInputElement>(null);
  const drawer = useRef<HTMLDialogElement>(null);
  const selected = roadmap.nodes.find(node => node.id === selectedId) ?? null;
  const built = roadmap.nodes.filter(node => node.status === "done").length;
  const progress = Math.round((built / roadmap.nodes.length) * 100);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/v1/roadmap-feedback", { signal: controller.signal, headers: { Accept: "application/json" } })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("feedback unavailable")))
      .then((body: { counts?: FeedbackCounts }) => setCounts(body.counts ?? {}))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.key === "Escape" && drawer.current?.open) { drawer.current.close(); return; }
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "/") { event.preventDefault(); search.current?.focus(); }
      if (event.key.toLowerCase() === "g") setView("graph");
      if (event.key.toLowerCase() === "b") setView("board");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return roadmap.nodes.filter(node => (track === "all" || node.trackId === track)
      && (!needle || `${node.title} ${node.category} ${node.summary} ${node.status}`.toLowerCase().includes(needle)));
  }, [query, roadmap.nodes, track]);

  function openNode(id: string) {
    setSelectedId(id);
    setFriction("");
    setFeedbackState("idle");
    requestAnimationFrame(() => drawer.current?.showModal());
    window.dispatchEvent(new CustomEvent("careerforge:flow-start", { detail: { id: `roadmap-${id}` } }));
  }

  async function sendFeedback(kind: "upvote" | "friction") {
    if (!selected || feedbackState === "sending") return;
    setFeedbackState("sending");
    try {
      const response = await fetch("/api/v1/roadmap-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: selected.id, kind, summary: kind === "friction" ? friction.trim() : undefined })
      });
      if (!response.ok) throw new Error("feedback rejected");
      const body = await response.json() as { counts?: FeedbackCounts };
      if (body.counts) setCounts(body.counts);
      setFeedbackState("sent");
      window.dispatchEvent(new CustomEvent("careerforge:flow-complete", { detail: { id: `roadmap-${selected.id}` } }));
      if (kind === "friction") setFriction("");
    } catch { setFeedbackState("error"); }
  }

  function closeOnBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) drawer.current?.close();
  }

  return <div className={styles.experience}>
    <header className={styles.hero}>
      <div>
        <p className="eyebrow">LIVE PRODUCT SYSTEM · ROADMAP.SH SYNCED</p>
        <h1>See what CareerForge is becoming.</h1>
        <p>Explore the product as connected evidence, not promises. Open any node to inspect its files, verification notes and user signal.</p>
      </div>
      <div className={styles.orbit} aria-label={`${progress}% of visible roadmap nodes are built`}>
        <svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34" /><circle cx="40" cy="40" r="34" pathLength="100" style={{ strokeDasharray: `${progress} 100` }} /></svg>
        <strong>{progress}%</strong><span>built</span>
      </div>
    </header>

    <section className={styles.signalStrip} aria-label="Roadmap summary">
      <div><strong>{roadmap.nodes.length}</strong><span>product nodes</span></div>
      <div><strong>{built}</strong><span>with code proof</span></div>
      <div><strong>{roadmap.selfHealedLog.length}</strong><span>resolved signals</span></div>
      <div><strong>{roadmap.tracks.length}</strong><span>upstream tracks</span></div>
    </section>

    <div className={styles.toolbar}>
      <div className={styles.switcher} aria-label="Roadmap layout">
        <button type="button" aria-pressed={view === "graph"} aria-keyshortcuts="G" onClick={() => setView("graph")}><span aria-hidden="true">⌘</span> Node map <kbd>G</kbd></button>
        <button type="button" aria-pressed={view === "board"} aria-keyshortcuts="B" onClick={() => setView("board")}><span aria-hidden="true">▥</span> Now / Next / Later <kbd>B</kbd></button>
      </div>
      <label className={styles.search}><span className="sr-only">Search roadmap</span><span aria-hidden="true">⌕</span><input ref={search} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && query.trim() && filtered.length === 0) window.dispatchEvent(new Event("careerforge:empty-search")); }} placeholder="Find a capability…" aria-keyshortcuts="/" /><kbd>/</kbd></label>
      <label className={styles.track}><span className="sr-only">Filter by discipline</span><select value={track} onChange={event => setTrack(event.target.value)}><option value="all">All disciplines</option>{roadmap.tracks.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>
    </div>

    {filtered.length === 0 ? <div className={styles.empty}><strong>No nodes match that view.</strong><button type="button" onClick={() => { setQuery(""); setTrack("all"); }}>Clear filters</button></div> : view === "graph" ?
      <section className={styles.graph} aria-label="Connected roadmap node map">
        <div className={styles.graphHeader}><span>Current foundation</span><span>Next leverage</span><span>Long horizon</span></div>
        <div className={styles.graphGrid}>{(["now", "next", "later"] as const).map(horizon => <div className={styles.lane} key={horizon} data-horizon={horizon}>
          <div className={styles.laneLabel}><span>{horizonLabels[horizon]}</span><small>{filtered.filter(node => node.horizon === horizon).length} nodes</small></div>
          {filtered.filter(node => node.horizon === horizon).map(node => <RoadmapNodeCard key={node.id} node={node} count={counts[node.id]} onOpen={() => openNode(node.id)} />)}
        </div>)}</div>
      </section> :
      <section className={styles.board} aria-label="Now, next and later product board">
        {(["now", "next", "later"] as const).map(horizon => <div className={styles.boardColumn} key={horizon}>
          <header><span>{horizonLabels[horizon]}</span><small>{filtered.filter(node => node.horizon === horizon).length}</small></header>
          <p>{horizon === "now" ? "Working product and active delivery." : horizon === "next" ? "Highest-leverage foundations after the current slice." : "Important capabilities that need earlier evidence first."}</p>
          <div>{filtered.filter(node => node.horizon === horizon).sort((a, b) => b.uxImpactScore - a.uxImpactScore).map(node => <RoadmapNodeCard key={node.id} node={node} count={counts[node.id]} onOpen={() => openNode(node.id)} />)}</div>
        </div>)}
      </section>}

    <section className={styles.healing} aria-labelledby="self-healing-heading">
      <div className={styles.healingIntro}><p className="eyebrow">SELF-HEALING FEED</p><h2 id="self-healing-heading">Problems become product memory.</h2><p>Only verified resolutions belong here. Automated proposals remain pull requests until a human reviews and merges them.</p></div>
      <ol>{roadmap.selfHealedLog.map(entry => <li key={entry.id}><span className={styles.pulse} aria-hidden="true" /><div><small>{formatDate(entry.resolvedAt)} · resolved</small><strong>{entry.title}</strong><p>{entry.resolution}</p><code>{entry.revision.slice(0, 7)}</code></div></li>)}</ol>
    </section>

    <footer className={styles.sourceNote}>
      <span><i /> Synced to roadmap.sh source revision <code>{roadmap.upstream.sourceRevision.slice(0, 7) || "pending"}</code></span>
      <span>Updated {formatDate(roadmap.updatedAt)}</span>
    </footer>

    <dialog ref={drawer} className={styles.drawer} aria-labelledby="roadmap-node-title" onClick={closeOnBackdrop} onClose={() => { if (selectedId) window.dispatchEvent(new CustomEvent("careerforge:flow-cancel", { detail: { id: `roadmap-${selectedId}` } })); setSelectedId(null); }}>
      {selected && <article>
        <header><div><span className={styles.status} data-status={selected.status}><i />{statusLabels[selected.status]}</span><p>{selected.category} · impact {selected.uxImpactScore}/100</p></div><button type="button" aria-label="Close proof drawer" onClick={() => drawer.current?.close()}>×</button></header>
        <div className={styles.drawerBody}>
          <p className="eyebrow">LIVE CODEBASE PROOF</p><h2 id="roadmap-node-title">{selected.title}</h2><p className={styles.hook}>{selected.creativeHook}</p><p>{selected.summary}</p>
          <section><h3>Evidence in this repository</h3>{selected.linkedFiles.length ? <ul className={styles.fileList}>{selected.linkedFiles.map(file => <li key={file}><code>{file}</code></li>)}</ul> : <p className={styles.muted}>No CareerForge file is linked yet. This is an upstream discovery, not implementation evidence.</p>}
          {selected.proof.metrics.length > 0 && <ul className={styles.metrics}>{selected.proof.metrics.map(metric => <li key={metric}>{metric}</li>)}</ul>}
          {selected.proof.revision && <a href={`https://github.com/hussein-hayek-mu/CareerForge/commit/${selected.proof.revision}`} target="_blank" rel="noopener noreferrer">Inspect commit {selected.proof.revision.slice(0, 7)} <span aria-hidden="true">↗</span></a>}</section>
          <section className={styles.feedback}><div><h3>Shape this node</h3><p>Vote for priority or report where this workflow creates friction. Reports stay private to your account; only totals enter the public signal.</p></div>
            <button type="button" className={styles.vote} onClick={() => void sendFeedback("upvote")} disabled={feedbackState === "sending"}>↑ Upvote <span>{counts[selected.id]?.upvotes ?? 0}</span></button>
            <label><span>Report friction <small>(8–500 characters)</small></span><textarea value={friction} onChange={event => { setFriction(event.target.value.slice(0, 500)); setFeedbackState("idle"); }} placeholder="What slowed you down? Do not include private career details." rows={4} /></label>
            <button type="button" className="button primary" onClick={() => void sendFeedback("friction")} disabled={feedbackState === "sending" || friction.trim().length < 8}>Send private report</button>
            <span className={styles.feedbackMessage} role="status">{feedbackState === "sent" ? "Signal recorded. Thank you." : feedbackState === "error" ? "That signal could not be saved. Please retry." : ""}</span>
          </section>
          <a className={styles.upstream} href={selected.upstreamSourceUrl} target="_blank" rel="noopener noreferrer">Open the related roadmap.sh track <span aria-hidden="true">↗</span></a>
        </div>
      </article>}
    </dialog>
  </div>;
}
