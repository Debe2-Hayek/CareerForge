import { endOf, lifecycleOf, startOf } from "./lifecycle";
import type { Workshop } from "./types";

// Calendar exports for genuine upcoming sessions only (RFC 5545 for .ics).

const stamp = (time: number) => new Date(time).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export const canAddToCalendar = (workshop: Workshop, now: number) => lifecycleOf(workshop, now) === "upcoming";

const details = (workshop: Workshop) => `${workshop.outcomeHook}\n\nHosted by ${workshop.instructorOrHost} (${workshop.platform}).\nRegister: ${workshop.registrationOrWatchUrl}`;

export function googleCalendarUrl(workshop: Workshop): string | null {
  const start = startOf(workshop), end = endOf(workshop);
  if (start === null || end === null) return null;
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", workshop.title);
  url.searchParams.set("dates", `${stamp(start)}/${stamp(end)}`);
  url.searchParams.set("details", details(workshop));
  url.searchParams.set("location", workshop.registrationOrWatchUrl);
  return url.href;
}

const escapeText = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** Content lines are folded at 75 octets without splitting a character. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "", size = 0;
  for (const character of line) {
    const width = encoder.encode(character).length;
    if (size + width > (parts.length ? 74 : 75)) { parts.push(current); current = ""; size = 0; }
    current += character;
    size += width;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function icsFor(workshop: Workshop, now: number): string | null {
  const start = startOf(workshop), end = endOf(workshop);
  if (start === null || end === null || !canAddToCalendar(workshop, now)) return null;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CareerForge//Workshops//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${workshop.id}@workshops.careerforge`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeText(workshop.title)}`,
    `DESCRIPTION:${escapeText(details(workshop))}`,
    `LOCATION:${escapeText(`Online (${workshop.platform})`)}`,
    `URL:${workshop.registrationOrWatchUrl}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].map(foldLine).join("\r\n") + "\r\n";
}
