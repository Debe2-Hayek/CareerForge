"use client";

import Link from "next/link";
import { AppIcon } from "@/components/app-icons";
import { pictureFor, pictures } from "@/data/workshops/pictures";
import { SidePanel } from "@/components/roadmaps/side-panel";
import { canAddToCalendar, googleCalendarUrl, icsFor } from "@/lib/workshops/calendar";
import { lifecycleOf } from "@/lib/workshops/lifecycle";
import type { SuggestionStatus } from "@/lib/workshops/suggestions";
import type { Workshop } from "@/lib/workshops/types";
import { LocalTime, type Notify } from "./hooks";
import { Picture } from "./picture";
import { ActionLink, areaOf, BookmarkButton, Difficulty, durationLabel, FormatLabel } from "./workshop-card";
import styles from "./workshops.module.css";

function OwnStatus({ suggestion, onSuggest, onRemove }: { suggestion: { status: SuggestionStatus; note: string | null } | undefined; onSuggest: (suggested: boolean) => void; onRemove: () => void }) {
  const remove = <button type="button" className={styles.textButton} onClick={onRemove}>Remove it</button>;
  switch (suggestion?.status) {
    case undefined: return <p>You added this on this device. Only you can see it, and CareerForge has not checked it. {remove}</p>;
    case "private": return <p>Only you can see this. <button type="button" className={styles.textButton} onClick={() => onSuggest(true)}>Suggest it to everyone</button> or {remove}. Suggestions are checked before anyone else sees them, and your name is never shown.</p>;
    case "pending": return <p>Waiting for review. Only you can see it until it is approved. <button type="button" className={styles.textButton} onClick={() => onSuggest(false)}>Withdraw</button> or {remove}.</p>;
    case "approved": return <p>Approved. Other learners can now see it without your name. Removing it here removes it for everyone. {remove}</p>;
    case "rejected": return <p>Not published{suggestion.note ? `: ${suggestion.note}` : "."} You can still use it yourself. {remove}</p>;
  }
}

export function WorkshopDetails({ workshop, now, saved, roadmapTitles, suggestion, onSuggest, onToggle, onRemove, onClose, notify }: {
  workshop: Workshop; now: number; saved: boolean; roadmapTitles: Record<string, string>;
  /** Review state of a workshop this learner added; undefined when it is kept on the device. */
  suggestion: { status: SuggestionStatus; note: string | null } | undefined; onSuggest: (suggested: boolean) => void;
  onToggle: () => void; onRemove: () => void; onClose: () => void; notify: Notify;
}) {
  const state = lifecycleOf(workshop, now);
  const isPrivate = workshop.submissionStatus === "private";
  const googleUrl = canAddToCalendar(workshop, now) ? googleCalendarUrl(workshop) : null;
  const photoName = pictureFor(workshop);
  const photo = pictures[photoName];
  const roadmaps = (workshop.relatedRoadmaps ?? []).filter(id => roadmapTitles[id]);

  async function copyLink() {
    const url = new URL("/workshops", window.location.origin);
    url.searchParams.set("workshop", workshop.id);
    try { await navigator.clipboard.writeText(url.href); notify("Link copied."); } catch { notify(`Copy this link: ${url.href}`, "error"); }
  }
  function downloadIcs() {
    const content = icsFor(workshop, Date.now());
    if (!content) { notify("This session has already started.", "error"); return; }
    const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${workshop.id}.ics`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <SidePanel label={workshop.category} titleId="workshop-title" contentKey={workshop.id} area={areaOf[workshop.category]} onClose={onClose}>
    <div className={styles.detailCover}>
      <Picture name={photoName} sizes="(max-width: 560px) 100vw, 520px" eager />
      <p className={styles.chip}><FormatLabel workshop={workshop} now={now} /></p>
    </div>
    <header className={styles.detailHead}>
      <h2 id="workshop-title" tabIndex={-1}>{workshop.title}</h2>
      <p className={styles.detailHook}>{workshop.outcomeHook}</p>
    </header>

    <div className={styles.detailActions}>
      <ActionLink workshop={workshop} now={now} primary />
      <div className={styles.secondaryRow}>
        <BookmarkButton saved={saved} title={workshop.title} onToggle={onToggle} withLabel />
        {!isPrivate && <button type="button" className={styles.secondary} onClick={() => void copyLink()}><AppIcon name="share" />Copy link</button>}
        {googleUrl && <a className={styles.secondary} href={googleUrl} target="_blank" rel="noopener noreferrer"><AppIcon name="calendar" />Google Calendar<span className="sr-only"> (opens in a new tab)</span></a>}
        {googleUrl && <button type="button" className={styles.secondary} onClick={downloadIcs}><AppIcon name="calendar" />Download .ics</button>}
      </div>
    </div>

    <dl className={styles.facts}>
      {(state === "upcoming" || state === "live") && <div className={styles.factWide}><dt>When</dt><dd><LocalTime iso={workshop.startDateTime!} /></dd></div>}
      <div><dt>Level</dt><dd><Difficulty workshop={workshop} /></dd></div>
      <div><dt>Length</dt><dd>{durationLabel(workshop)}{workshop.durationNote ? <small>{workshop.durationNote}</small> : workshop.durationEstimated && <small>our estimate</small>}</dd></div>
      <div><dt>Format</dt><dd>{state === "replay" ? "Self-Paced / Recorded" : workshop.format}</dd></div>
      <div><dt>Cost</dt><dd>{workshop.priceType}</dd></div>
      <div className={styles.factWide}><dt>Host</dt><dd>{workshop.instructorOrHost}{workshop.platform !== workshop.instructorOrHost && <small>on {workshop.platform}</small>}</dd></div>
    </dl>

    <section className={styles.detailBlock}><h3>About</h3><p>{workshop.description}</p></section>
    {workshop.keyTakeaways.length > 0 && <section className={styles.detailBlock}><h3>What You’ll Learn</h3><ul className={styles.ticks}>{workshop.keyTakeaways.map(text => <li key={text}>{text}</li>)}</ul></section>}
    {workshop.sourceType === "curated" && <section className={styles.detailBlock}><h3>Before you start</h3>
      {workshop.prerequisites.length ? <ul className={styles.plainList}>{workshop.prerequisites.map(text => <li key={text}>{text}</li>)}</ul> : <p>No experience needed.</p>}</section>}
    {roadmaps.length > 0 && <section className={styles.detailBlock}><h3>Fits these roadmaps</h3><ul className={styles.links}>{roadmaps.map(id => <li key={id}><Link href={`/learning-roadmap/${id}`}>{roadmapTitles[id]}</Link></li>)}</ul></section>}

    <footer className={styles.detailFoot}>
      {workshop.accessNotes && <p>{workshop.accessNotes}</p>}
      {isPrivate || suggestion
        ? <OwnStatus suggestion={suggestion} onSuggest={onSuggest} onRemove={onRemove} />
        : workshop.sourceType === "community"
          ? <p>Suggested by a learner and reviewed {workshop.lastVerifiedAt}. CareerForge is not affiliated with the host.</p>
        : workshop.sourceType === "feed"
          ? <p>From the organiser’s public calendar, read {workshop.lastVerifiedAt}. Details can change, so confirm on the event page.</p>
          : <p>Checked on the publisher’s page {workshop.lastVerifiedAt}. CareerForge is not affiliated with the host.</p>}
      <p>Photo: <a href={photo.page} target="_blank" rel="noopener noreferrer">{photo.caption}<span className="sr-only"> (opens in a new tab)</span></a> by {photo.author}, {photo.license}.</p>
    </footer>
  </SidePanel>;
}
