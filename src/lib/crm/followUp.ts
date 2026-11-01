// Setting a lead's next follow-up by hand in the lead cockpit (2026-11-01). Pure:
// the action (leads/actions.ts) checks access and writes. A follow-up is a Cyprus
// calendar day; it is stored at 09:00 Cyprus time, like the "tomorrow / +3 days"
// buttons of the Telegram reminders (leadNag.snoozeUntil), so every view that
// reads the day (board marks, Today, reminders) sees the day that was picked.
import { CRM_TZ, dayKey } from "./today";

export const FOLLOW_UP_HOUR = 9;
export const FOLLOW_UP_MAX_DAYS = 730;
export const FOLLOW_UP_QUICK_DAYS = [1, 3, 7] as const;

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** The instant `hour`:00 on Cyprus day `day` ("YYYY-MM-DD"), across the clock changes. */
export function cyprusTime(day: string, hour = FOLLOW_UP_HOUR, tz = CRM_TZ): Date {
  const [, y, m, d] = DAY_RE.exec(day)!.map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hour, 0, 0));
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(guess)
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  const asLocal = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return new Date(guess.getTime() - (asLocal - guess.getTime()));
}

/** Cyprus day `n` days after the Cyprus day of `now`. */
export function dayPlus(now: Date, n: number, tz = CRM_TZ): string {
  const [y, m, d] = dayKey(now, tz).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10);
}

export type FollowUpInput = { day?: unknown; days?: unknown; clear?: unknown };

/** What to store: a date (09:00 Cyprus on the chosen day), null to clear, or why the input is refused. */
export function resolveFollowUp(input: FollowUpInput, now: Date): { ok: true; at: Date | null; day: string | null } | { ok: false; error: string } {
  if (input.clear === true) return { ok: true, at: null, day: null };
  let day: string;
  if (typeof input.days === "number") {
    if (!(FOLLOW_UP_QUICK_DAYS as readonly number[]).includes(input.days)) return { ok: false, error: "Unknown shortcut." };
    day = dayPlus(now, input.days);
  } else if (typeof input.day === "string" && DAY_RE.test(input.day.trim())) {
    day = input.day.trim();
    const [, y, m, d] = DAY_RE.exec(day)!.map(Number);
    const probe = new Date(Date.UTC(y, m - 1, d));
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return { ok: false, error: "That date does not exist." };
  } else {
    return { ok: false, error: "Pick a date." };
  }
  const today = dayKey(now);
  if (day < today) return { ok: false, error: "The follow-up cannot be in the past." };
  if (day > dayPlus(now, FOLLOW_UP_MAX_DAYS)) return { ok: false, error: "The follow-up is too far ahead (two years at most)." };
  return { ok: true, at: cyprusTime(day), day };
}

const LABEL = new Intl.DateTimeFormat("en-GB", { timeZone: CRM_TZ, weekday: "short", day: "numeric", month: "short", year: "numeric" });
/** "Tue, 4 Nov 2026": the follow-up as people read it (admin copy, English). */
export const followUpLabel = (at: Date) => LABEL.format(at);
