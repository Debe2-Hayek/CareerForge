"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { AppIcon, type IconName } from "@/components/app-icons";
import type { RailSelection } from "@/lib/workshops/discovery";
import { useMounted } from "./hooks";
import { areaOf } from "./workshop-card";
import styles from "./workshops.module.css";

export const railItems: readonly { id: RailSelection; slug: string; label: string; icon: IconName }[] = [
  { id: "all", slug: "all", label: "All Workshops", icon: "grid" },
  { id: "AI & ML", slug: "ai", label: "AI & ML", icon: "brain" },
  { id: "Web Dev", slug: "web", label: "Web Development", icon: "code" },
  { id: "Python", slug: "python", label: "Python", icon: "python" },
  { id: "Cybersecurity", slug: "security", label: "Cybersecurity", icon: "shield" },
  { id: "Cloud & DevOps", slug: "cloud", label: "Cloud & DevOps", icon: "cloud" },
  { id: "Systems & Algorithms", slug: "systems", label: "Systems & Algorithms", icon: "cpu" },
  { id: "saved", slug: "saved", label: "My Saved", icon: "bookmark" }
];

/** Icon-only topic rail: vertical on the right of the content, a scrollable strip on phones. */
export function WorkshopRail({ selected, savedCount, onSelect }: { selected: RailSelection; savedCount: number; onSelect: (id: RailSelection) => void }) {
  const [tip, setTip] = useState<{ label: string; x: number; y: number; below: boolean } | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const mounted = useMounted();

  function show(element: HTMLElement, label: string) {
    const box = element.getBoundingClientRect();
    const strip = list.current ? getComputedStyle(list.current).flexDirection === "row" : false;
    setTip(strip ? { label, x: box.left + box.width / 2, y: box.bottom + 8, below: true } : { label, x: box.left - 10, y: box.top + box.height / 2, below: false });
  }
  function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
    if (event.key === "Escape") { setTip(null); return; }
    const buttons = [...(list.current?.querySelectorAll("button") ?? [])];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const target = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : step === undefined || index < 0 ? -1 : (index + step + buttons.length) % buttons.length;
    if (target < 0) return;
    event.preventDefault();
    buttons[target]?.focus();
  }

  return <nav className={styles.rail} aria-label="Workshop topics">
    <ul ref={list} onKeyDown={onKeyDown}>
      {railItems.map(item => {
        const name = item.id === "saved" ? `My Saved, ${savedCount} available` : item.label;
        return <li key={item.slug}>
          <button type="button" aria-label={name} aria-pressed={selected === item.id} data-topic={item.slug} data-area={item.id === "all" || item.id === "saved" ? undefined : areaOf[item.id]} onClick={() => onSelect(item.id)}
            onPointerEnter={event => { if (event.pointerType === "mouse") show(event.currentTarget, item.label); }} onPointerLeave={() => setTip(null)}
            onFocus={event => { if (event.currentTarget.matches(":focus-visible")) show(event.currentTarget, item.label); }} onBlur={() => setTip(null)}>
            <AppIcon name={item.icon} />
            {item.id === "saved" && savedCount > 0 && <span className={styles.railCount} aria-hidden="true">{savedCount > 99 ? "99+" : savedCount}</span>}
          </button>
        </li>;
      })}
    </ul>
    {mounted && tip && createPortal(<div className={styles.tip} data-below={tip.below || undefined} style={{ left: tip.x, top: tip.y }} aria-hidden="true">{tip.label}</div>, document.body)}
  </nav>;
}
