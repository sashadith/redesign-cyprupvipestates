// Scheduled publishing uses German local time: the admin enters a timezone-naive
// datetime ("YYYY-MM-DDTHH:mm") that means Europe/Berlin wall-clock, while the
// server and DB run UTC. These helpers convert between the two, DST-aware, with
// no external dependency (via Intl).

export const SCHEDULE_TZ = "Europe/Berlin";

// Offset (ms, tz ahead of UTC is positive) of `timeZone` at a given instant.
function tzOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(instant)) p[part.type] = part.value;
  const hour = p.hour === "24" ? "00" : p.hour; // some engines emit "24" at midnight
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +hour, +p.minute, +p.second);
  return asUTC - instant.getTime();
}

/** Parse a naive "YYYY-MM-DDTHH:mm" as Europe/Berlin wall time → UTC Date (null if blank/invalid). */
export function zonedInputToUtc(value: string, timeZone = SCHEDULE_TZ): Date | null {
  const m = (value || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [y, mo, d, h, mi] = [+m[1], +m[2], +m[3], +m[4], +m[5]];
  // Treat the wall time as if it were UTC, then subtract the zone's offset at that instant.
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const offset = tzOffsetMs(new Date(guess), timeZone);
  return new Date(guess - offset);
}

/** Format a UTC Date as naive "YYYY-MM-DDTHH:mm" in Europe/Berlin, for a datetime-local default value. */
export function utcToZonedInput(date: Date | null | undefined, timeZone = SCHEDULE_TZ): string {
  if (!date) return "";
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const hour = p.hour === "24" ? "00" : p.hour;
  return `${p.year}-${p.month}-${p.day}T${hour}:${p.minute}`;
}
