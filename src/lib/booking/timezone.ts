// Timezone handling for the booking page — deliberately minimal. The only
// place an actual UTC-offset calculation happens is converting "Sascha's
// intended Cyprus wall-clock slot" into a real UTC instant when generating
// the slot list; everything else (showing that instant back to the lead in
// their own timezone, or to Sascha in Cyprus time) is a plain Intl.DateTimeFormat
// render, not a calculation. No external timezone library — the native Intl
// API on Node 20+ is sufficient and avoids a dependency for something this
// self-contained.

const CYPRUS_TZ = "Asia/Nicosia";

function offsetMinutesAt(utcMs: number, timeZone: string): number {
  // en-US + longOffset gives a parseable "GMT+3" / "GMT+03:00" string for any
  // IANA zone at any instant (correctly reflects DST on that specific date).
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" }).formatToParts(new Date(utcMs));
  const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const match = raw.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? 0);
  return sign * (hours * 60 + minutes);
}

/**
 * Given a wall-clock date/time as it would read on a clock in `timeZone`,
 * return the real UTC instant it corresponds to. Handles DST correctly by
 * checking the offset twice (the second check catches the rare case where
 * the first guess landed just across a DST transition).
 */
export function zonedWallTimeToUtc(y: number, month1to12: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const guessUtcMs = Date.UTC(y, month1to12 - 1, day, hour, minute);
  const offset1 = offsetMinutesAt(guessUtcMs, timeZone);
  const adjustedMs = guessUtcMs - offset1 * 60_000;
  const offset2 = offsetMinutesAt(adjustedMs, timeZone);
  if (offset2 === offset1) return new Date(adjustedMs);
  return new Date(guessUtcMs - offset2 * 60_000);
}

/** Cyprus wall-clock time for a given UTC instant — the slot generator's building block. */
export function cyprusWallTimeToUtc(y: number, month1to12: number, day: number, hour: number, minute: number): Date {
  return zonedWallTimeToUtc(y, month1to12, day, hour, minute, CYPRUS_TZ);
}

/** Formats a UTC instant as it reads on a clock in `timeZone` — display only, e.g. "Mon, 28 Jul, 11:00". */
export function formatInZone(date: Date, timeZone: string, locale: string = "en-GB"): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export { CYPRUS_TZ };
