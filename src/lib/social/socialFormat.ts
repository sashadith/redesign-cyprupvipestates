// Shared text building blocks for every social Telegram text — the reminder
// messages and the morning digest's Social section — so the two always look
// alike (2026-10-09 brief). Pure: no network, `now`/dates always passed in.
// All times are Cyprus wall-clock, 24-hour (CYPRUS_TZ = "Asia/Nicosia", the
// canonical name of the brief's Europe/Nicosia).
import { CYPRUS_TZ } from "@/lib/booking/timezone";
import type { TypefullyDraft } from "./typefully";
import { draftLink, draftTitle } from "./socialMonitor";

export type PlatformGroup = { icon: string; label: string };

const NEWS: PlatformGroup = { icon: "🗞", label: "News" };
const LINKEDIN: PlatformGroup = { icon: "💼", label: "LinkedIn" };
const SOCIAL: PlatformGroup = { icon: "🌐", label: "Social" };
const SUBSTACK: PlatformGroup = { icon: "📰", label: "Substack" };
const UNKNOWN: PlatformGroup = { icon: "📝", label: "No platform" };

/* The routines title drafts "2026-WNN · <Weekday> · News · <topic>"; the News
   segment wins over the platform flags. Matched as a whole " · News · " segment
   so a topic merely containing the word ("Market news") does not count. */
const NEWS_SEGMENT = /(^|·)\s*News\s*(·|$)/;

export function isNewsDraft(d: TypefullyDraft): boolean {
  return NEWS_SEGMENT.test(d.draft_title ?? "");
}

/** 🗞 for News, otherwise one group per enabled platform family, fixed order. */
export function platformGroups(d: TypefullyDraft): PlatformGroup[] {
  if (isNewsDraft(d)) return [NEWS];
  const on = (k: string) => d[`${k}_post_enabled`] === true;
  const groups: PlatformGroup[] = [];
  if (on("linkedin")) groups.push(LINKEDIN);
  if (on("x") || on("x_article") || on("threads") || on("bluesky")) groups.push(SOCIAL);
  if (on("substack")) groups.push(SUBSTACK);
  return groups.length ? groups : [UNKNOWN];
}

export const platformIcons = (d: TypefullyDraft) => platformGroups(d).map((g) => g.icon).join("");
export const platformLabels = (d: TypefullyDraft) => platformGroups(d).map((g) => g.label).join(" + ");

/* Fixed three-letter names: ICU's en-GB says "Sept" for September. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(date: Date): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-GB", {
    timeZone: CYPRUS_TZ, weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date)) out[p.type] = p.value;
  out.month = MONTHS[Number(out.month) - 1];
  out.day = String(Number(out.day)); // en-GB pads the day once the month is numeric
  out.hour = String(Number(out.hour) % 24).padStart(2, "0");
  return out;
}

/** "08:30" */
export function cyprusHm(date: Date): string {
  const p = parts(date);
  return `${p.hour}:${p.minute}`;
}

/** "Mon 19 Oct 08:30" */
export function cyprusDayTime(date: Date): string {
  const p = parts(date);
  return `${p.weekday} ${p.day} ${p.month} ${p.hour}:${p.minute}`;
}

/** "Wed 12:30" — for windows that span at most two days. */
export function cyprusWeekdayTime(date: Date): string {
  const p = parts(date);
  return `${p.weekday} ${p.hour}:${p.minute}`;
}

/** Cyprus calendar date of an instant, as a UTC-midnight Date (for date arithmetic only). */
function cyprusCalendarDate(date: Date): Date {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: CYPRUS_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return new Date(`${p}T00:00:00Z`);
}

/** ISO 8601 week number of the Cyprus calendar date of `date`. */
export function isoWeek(date: Date): number {
  const d = cyprusCalendarDate(date);
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow); // the Thursday of this week decides the year
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

/** "KW 43 (19 - 23 Oct)"; across a month end "KW 40 (28 Sep - 2 Oct)". */
export function weekLabel(date: Date): string {
  const d = cyprusCalendarDate(date);
  const mon = new Date(d.getTime() - ((d.getUTCDay() || 7) - 1) * 86_400_000);
  const fri = new Date(mon.getTime() + 4 * 86_400_000);
  const month = (x: Date) => MONTHS[x.getUTCMonth()];
  const range = month(mon) === month(fri)
    ? `${mon.getUTCDate()} - ${fri.getUTCDate()} ${month(fri)}`
    : `${mon.getUTCDate()} ${month(mon)} - ${fri.getUTCDate()} ${month(fri)}`;
  return `KW ${isoWeek(date)} (${range})`;
}

const when = (d: TypefullyDraft) => (d.scheduled_date ? new Date(d.scheduled_date) : null);

/** Reminder body for one draft — two lines, the second carries the link:
 *     🌐 Mon 19 Oct 08:30 — <title>
 *     👉 https://typefully.com/?d=<id>&a=339303 */
export function reminderDraftLines(d: TypefullyDraft): string[] {
  const w = when(d);
  return [`   ${platformIcons(d)} ${w ? cyprusDayTime(w) : "no date"} — ${draftTitle(d)}`, `   👉 ${draftLink(d.id)}`];
}

/** Telegram rejects anything over 4096 characters outright; stay well below. */
export const MESSAGE_BUDGET = 3_800;

/** header + draft blocks + footer, dropping whole draft blocks past the budget
 *  (with an "… and N more" line) rather than ever exceeding it. */
export function buildMessage(header: string, drafts: TypefullyDraft[], footer?: string): string {
  const head = [header];
  const tail = footer ? [footer] : [];
  const body: string[] = [];
  let length = [...head, ...tail].join("\n").length + 40;
  let shown = 0;
  for (const d of drafts) {
    const block = reminderDraftLines(d);
    const add = block.join("\n").length + 1;
    if (length + add > MESSAGE_BUDGET) break;
    body.push(...block);
    length += add;
    shown++;
  }
  if (shown < drafts.length) body.push(`   … and ${drafts.length - shown} more in Typefully`);
  return [...head, ...body, ...tail].join("\n");
}
