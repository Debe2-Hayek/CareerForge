"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { AppIcon } from "@/components/app-icons";
import { activeFilterCount, availableSavedCount, defaultFilters, discover, mergeWorkshops, spotlight, type DiscoveryFilters, type RailSelection } from "@/lib/workshops/discovery";
import { isAvailable } from "@/lib/workshops/lifecycle";
import type { OwnSuggestion, SuggestionInput } from "@/lib/workshops/suggestions";
import type { WorkshopCatalog } from "@/lib/workshops/types";
import { FilterPopover } from "./filter-popover";
import { useBookmarks, useMounted, useNow, type Notify } from "./hooks";
import { SubmitWorkshop } from "./submit-workshop";
import { Spotlight, WorkshopCard } from "./workshop-card";
import { WorkshopDetails } from "./workshop-details";
import { railItems, WorkshopRail } from "./workshop-rail";
import styles from "./workshops.module.css";

const staleAfter = 30 * 60_000;
/** A short first page; the rest is one button away. */
const firstPage = 12;

type Reply = { ok: true; body: unknown } | { ok: false; message: string; fields?: Record<string, string> };

async function changeSuggestion(change: SuggestionInput): Promise<Reply> {
  try {
    const response = await fetch("/api/v1/workshops/suggestions", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change) });
    const body = await response.json().catch(() => null);
    if (response.ok) return { ok: true, body };
    return { ok: false, message: typeof body?.error?.message === "string" ? body.error.message : "Your change could not be saved. Please retry.", fields: body?.error?.fields };
  } catch { return { ok: false, message: "You appear to be offline. Nothing was saved." }; }
}

function minutesAgo(iso: string, now: number) {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  return minutes < 1 ? "just now" : minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`;
}

export function WorkshopsExperience({ initialCatalog, initialBookmarks, initialOwn, deviceScope, initialNow, initialTopic, roadmapTitles }: {
  initialCatalog: WorkshopCatalog; initialBookmarks: string[] | null; initialOwn: OwnSuggestion[] | null; deviceScope: string; initialNow: number; initialTopic: string | null; roadmapTitles: Record<string, string>;
}) {
  const searchParams = useSearchParams();
  const openId = searchParams.get("workshop");
  const mounted = useMounted();
  const [catalog, setCatalog] = useState(initialCatalog);
  const [rail, setRail] = useState<RailSelection>(() => railItems.find(item => item.slug === initialTopic)?.id ?? "all");
  const [filters, setFilters] = useState<DiscoveryFilters>(defaultFilters);
  const [showAll, setShowAll] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const pushed = useRef(false);
  const trigger = useRef<string | null>(null);

  const notify = useCallback<Notify>((text, tone = "info") => setToast({ text, tone }), []);
  const { saved, toggle, usesAccount, device } = useBookmarks(initialBookmarks, deviceScope, notify);
  const [own, setOwn] = useState(initialOwn);
  // Once approved, the shared copy replaces the learner's own card.
  const workshops = useMemo(() => mergeWorkshops(catalog.workshops, (own ?? []).map(item => item.workshop), device.data.submissions), [catalog.workshops, own, device.data.submissions]);
  const now = useNow(workshops, initialNow);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.tone === "error" ? 8000 : 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  // A page left open refreshes quietly when the learner returns to it.
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      if (document.hidden || Date.now() - Date.parse(catalog.generatedAt) < staleAfter) return;
      try {
        const response = await fetch("/api/v1/workshops", { signal: controller.signal });
        const next: unknown = response.ok ? await response.json() : null;
        if (next && typeof next === "object" && Array.isArray((next as WorkshopCatalog).workshops)) setCatalog(next as WorkshopCatalog);
      } catch { /* the current list stays usable */ }
    }
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); document.removeEventListener("visibilitychange", refresh); };
  }, [catalog.generatedAt]);

  const query = useDeferredValue(filters.query);
  const results = useMemo(() => discover(workshops, rail, { ...filters, query }, saved, now), [workshops, rail, filters, query, saved, now]);
  const featured = useMemo(() => spotlight(workshops, now), [workshops, now]);
  const savedCount = useMemo(() => availableSavedCount(workshops, saved, now), [workshops, saved, now]);
  const opened = openId ? workshops.find(workshop => workshop.id === openId && isAvailable(workshop, now)) ?? null : null;
  // An approved workshop carries a public id; its owner still manages the original.
  const ownId = opened?.id.replace(/^community-/, "local-") ?? "";
  const ownOpened = own?.find(item => item.workshop.id === ownId);
  // Private workshops exist only after the browser's storage has been read.
  const missing = Boolean(openId && !opened && mounted);

  const addressWith = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("workshop", id); else url.searchParams.delete("workshop");
    return `${url.pathname}${url.search}${url.hash}`;
  };
  function open(id: string) {
    trigger.current = id;
    pushed.current = true;
    window.history.pushState(null, "", addressWith(id));
  }
  const close = useCallback(() => {
    // Opened here: step back, so Back never reopens what was just closed. Opened by link: just drop the parameter.
    if (pushed.current) { pushed.current = false; window.history.back(); }
    else window.history.replaceState(null, "", addressWith(null));
  }, []);
  // Closing with the browser's Back button removes the dialog, so return focus by hand.
  useEffect(() => {
    if (openId || !trigger.current) return;
    const id = trigger.current;
    trigger.current = null;
    pushed.current = false;
    document.querySelector<HTMLElement>(`[data-workshop="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
  }, [openId]);

  const label = railItems.find(item => item.id === rail)?.label ?? "All Workshops";
  const filtered = Boolean(filters.query) || activeFilterCount(filters) > 0;
  const reset = () => { setFilters(defaultFilters); setRail("all"); };
  const feeds = catalog.sources.filter(source => source.id !== "curated");
  const curatedCount = catalog.sources.find(source => source.id === "curated")?.count ?? 0;

  return <div className={styles.page}>
    <header className={styles.head}>
      <div><h1>Workshops</h1><p>Free, hands-on computer science sessions. Pick a topic and start.</p></div>
      <button type="button" className={styles.textButton} onClick={() => setSubmitting(true)}>Submit workshop</button>
    </header>

    <div className={styles.layout}>
      <WorkshopRail selected={rail} savedCount={mounted ? savedCount : initialBookmarks?.length ? savedCount : 0} onSelect={setRail} />
      <div className={styles.content}>
        {featured && rail === "all" && !filters.query && <Spotlight workshop={featured} now={now} onOpen={() => open(featured.id)} />}

        <div className={styles.tools}>
          <div className={styles.search}>
            <AppIcon name="search" />
            <label htmlFor="workshop-search" className="sr-only">Search workshops</label>
            <input id="workshop-search" type="search" value={filters.query} placeholder="Search workshops" autoComplete="off" maxLength={80} onChange={event => setFilters(current => ({ ...current, query: event.target.value }))} />
          </div>
          <FilterPopover filters={filters} onChange={setFilters} />
        </div>

        <div className={styles.listHead}>
          <h2>{label}</h2>
          <p role="status" aria-live="polite">{results.length} {results.length === 1 ? "workshop" : "workshops"}{filtered && results.length > 0 && <button type="button" className={styles.textButton} onClick={() => setFilters(defaultFilters)}>Reset Filters</button>}</p>
        </div>

        {missing && <div className={styles.notice} role="status"><p>That workshop is no longer available.</p><button type="button" className={styles.textButton} onClick={close}>Dismiss</button></div>}

        {results.length > 0
          ? <ul className={styles.grid}>{(showAll ? results : results.slice(0, firstPage)).map(workshop => <li key={workshop.id}><WorkshopCard workshop={workshop} now={now} saved={saved.has(workshop.id)} onOpen={() => open(workshop.id)} onToggle={() => void toggle(workshop.id, workshop.title)} /></li>)}</ul>
          : <div className={styles.empty}>
              <span aria-hidden="true"><AppIcon name={rail === "saved" ? "bookmark" : "search"} /></span>
              {rail === "saved" && savedCount === 0
                ? <><h3>Nothing saved yet</h3><p>Use the bookmark on any workshop to keep it here.</p><button type="button" className={styles.secondary} onClick={reset}>Browse workshops</button></>
                : <><h3>No workshops match</h3><p>Try another word or topic.</p><button type="button" className={styles.secondary} onClick={reset}>Reset Filters</button></>}
            </div>}

        {!showAll && results.length > firstPage && <div className={styles.more}><button type="button" className={styles.secondary} onClick={() => setShowAll(true)}>Show all {results.length}</button></div>}

        <footer className={styles.sources}>
          <p>{curatedCount} hand-checked workshops{feeds.map(feed => <span key={feed.id}> · {feed.label}: {feed.state === "failed" ? (feed.count ? "temporarily unavailable, showing the last copy" : "temporarily unavailable") : feed.state === "empty" ? "no upcoming sessions" : `${feed.count} upcoming`}{feed.state !== "failed" && mounted ? `, checked ${minutesAgo(feed.checkedAt, now)}` : ""}</span>)}</p>
          {!usesAccount && <p>Saved workshops are kept on this device.</p>}
        </footer>
      </div>
    </div>

    {opened && <WorkshopDetails workshop={opened} now={now} saved={saved.has(opened.id)} roadmapTitles={roadmapTitles} notify={notify}
      onToggle={() => void toggle(opened.id, opened.title)} onClose={close}
      suggestion={ownOpened}
      onSuggest={async suggested => {
        const reply = await changeSuggestion({ action: suggested ? "suggest" : "withdraw", workshopId: ownId });
        if (!reply.ok) { notify(reply.message, "error"); return; }
        setOwn(current => current?.map(item => item.workshop.id === ownId ? { ...item, status: suggested ? "pending" : "private" } : item) ?? null);
        notify(suggested ? "Sent for review." : "Suggestion withdrawn.");
      }}
      onRemove={async () => {
        if (ownOpened) {
          const reply = await changeSuggestion({ action: "remove", workshopId: ownId });
          if (!reply.ok) { notify(reply.message, "error"); return; }
          setOwn(current => current?.filter(item => item.workshop.id !== ownId) ?? null);
          setCatalog(current => ({ ...current, workshops: current.workshops.filter(item => item.id !== opened.id) }));
        }
        device.update(current => ({ bookmarks: current.bookmarks.filter(id => id !== opened.id), submissions: current.submissions.filter(item => item.id !== opened.id) }));
        notify("Workshop removed.");
        close();
      }} />}
    {submitting && <SubmitWorkshop existing={workshops} inAccount={own !== null} onClose={() => setSubmitting(false)} onSave={async (workshop, input) => {
      if (own !== null) {
        // The server repeats every check; it needs the moment, not this device's wall clock.
        const reply = await changeSuggestion({ action: "add", input: { ...input, startLocal: workshop.startDateTime ?? "" } });
        if (!reply.ok) return reply.fields ?? { url: reply.message };
        setOwn(current => [...(current ?? []), { workshop, status: "private", note: null }]);
        notify("Added. Only you can see it.");
        return null;
      }
      const stored = device.update(current => ({ ...current, submissions: [...current.submissions.filter(item => item.id !== workshop.id), workshop].slice(-100) }));
      if (!stored) return { url: "This browser is not allowing CareerForge to save. Check its storage settings." };
      notify("Added. Only you can see it.");
      return null;
    }} />}
    <p className={styles.toast} role="status" aria-live="polite" data-tone={toast?.tone} data-visible={toast ? true : undefined}>{toast?.text ?? ""}</p>
  </div>;
}
