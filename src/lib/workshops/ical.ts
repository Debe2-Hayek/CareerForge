// Minimal, defensive iCalendar reader (RFC 5545) for event feeds. It reads only
// what a workshop needs and skips anything it cannot place in time with
// certainty: all-day entries, recurring rules, unknown time zones, cancellations.

export type IcalEvent = { uid: string; summary: string; description: string; location: string; url: string; start: number; end: number; organizer: string };
export type IcalResult = { events: IcalEvent[]; skipped: number };

type Property = { params: Map<string, string>; value: string };

const unescapeText = (value: string) => value.replace(/\\([\\;,nN])/g, (_, character: string) => character === "n" || character === "N" ? "\n" : character);

/** Offset of a time zone at an instant, in milliseconds. Throws for unknown zones. */
function offsetAt(timeZone: string, instant: number): number {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
  }).formatToParts(instant).map(part => [part.type, part.value]));
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - Math.floor(instant / 1000) * 1000;
}

export function parseIcalTime(property: Property): number | null {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(property.value.trim());
  if (!match || property.params.get("VALUE") === "DATE") return null;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(wall);
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59) return null;
  if (match[7]) return wall;
  const zone = property.params.get("TZID");
  // A floating time means a different moment in every country, so it is unusable.
  if (!zone) return null;
  try {
    // Two passes settle the offset around daylight-saving changes.
    const first = wall - offsetAt(zone, wall);
    return wall - offsetAt(zone, first);
  } catch { return null; }
}

function durationMs(value: string): number | null {
  const match = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value.trim());
  if (!match) return null;
  const [weeks, days, hours, minutes, seconds] = match.slice(1).map(part => Number(part ?? 0));
  return ((((weeks * 7 + days) * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000 || null;
}

export function parseIcal(source: string, limit = 2000): IcalResult {
  const lines = source.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const events: IcalEvent[] = [];
  let skipped = 0, depth = 0;
  let current: Map<string, Property> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { current = new Map(); depth = 0; continue; }
    if (!current) continue;
    // Alarms and other nested components have their own DESCRIPTION.
    if (line.startsWith("BEGIN:")) { depth++; continue; }
    if (line.startsWith("END:") && line !== "END:VEVENT") { depth = Math.max(0, depth - 1); continue; }
    if (line === "END:VEVENT") {
      const event = events.length < limit ? toEvent(current) : null;
      if (event) events.push(event); else skipped++;
      current = null;
      continue;
    }
    if (depth) continue;
    const match = /^([A-Za-z0-9-]+)((?:;[^:;="]+=(?:"[^"]*"|[^:;"]*))*):([\s\S]*)$/.exec(line);
    if (!match || current.has(match[1].toUpperCase())) continue;
    const params = new Map([...match[2].matchAll(/;([^=;]+)=(?:"([^"]*)"|([^;:]*))/g)].map(param => [param[1].toUpperCase(), param[2] ?? param[3] ?? ""] as const));
    current.set(match[1].toUpperCase(), { params, value: match[3] });
  }
  return { events, skipped };
}

function toEvent(properties: Map<string, Property>): IcalEvent | null {
  const value = (name: string) => unescapeText(properties.get(name)?.value ?? "").trim();
  const startProperty = properties.get("DTSTART");
  if (!startProperty || properties.has("RRULE") || /^CANCELLED$/i.test(value("STATUS"))) return null;
  const start = parseIcalTime(startProperty);
  if (start === null) return null;
  const endProperty = properties.get("DTEND");
  const length = properties.has("DURATION") ? durationMs(value("DURATION")) : null;
  const end = endProperty ? parseIcalTime(endProperty) : length === null ? null : start + length;
  const uid = value("UID"), summary = value("SUMMARY");
  if (end === null || end <= start || !uid || !summary) return null;
  return { uid, summary, description: value("DESCRIPTION"), location: value("LOCATION"), url: value("URL"), start, end, organizer: properties.get("ORGANIZER")?.params.get("CN") ?? "" };
}
