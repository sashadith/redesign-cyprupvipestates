/* Delivery/completion dates as the feeds actually state them.

   Leaf module on purpose: imported by @/lib/text and @/lib/formatMonthYear,
   which client components pull in — so it must stay free of any prisma/server
   import chain.
*/

// Some price lists state delivery relative to the contract instead of as a
// date — real values in the DB (2026-08-24): "24 Months from Signing",
// "24 months from signing", "22 months from contract signing". Left raw, those
// reach the client as a legal phrase that means nothing to a buyer comparing
// projects, and every year-extracting/parsing consumer downstream
// (resolveCompletionYear, formatMonthYear, toDeliveryQuarter, the
// "completion: soonest" sort) simply gives up on them.
//
// So they're converted to a concrete quarter, counted from TODAY — the same
// arithmetic a buyer would do. This is deliberately time-dependent: the
// resolved quarter rolls forward as the calendar moves (a "24 months" project
// reads Q3 2028 in Aug 2026 and Q4 2028 from Nov 2026 on), which is what
// "24 months from signing" actually means. Consequence: any page cached longer
// than a quarter can show the previous quarter until it revalidates.
//
// Anything that isn't this relative form is returned untouched — never
// reformatted, never guessed at.
const RELATIVE_COMPLETION = /^(\d{1,3})\s*(month|year)s?\b(?:\s*(?:from|after)\b.*)?$/i;

export function resolveRelativeCompletion(raw: string | null | undefined, now: Date = new Date()): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  const m = s.match(RELATIVE_COMPLETION);
  if (!m) return s;
  const n = parseInt(m[1], 10);
  const months = m[2].toLowerCase() === "year" ? n * 12 : n;
  // Guard against a nonsense figure ("0 months", "999 months from signing")
  // producing a confident-looking quarter — better to show the raw phrase.
  if (!Number.isFinite(months) || months <= 0 || months > 240) return s;
  // UTC month arithmetic on day 1: no DST/timezone drift, and Date normalizes
  // a month index past 11 into the following year on its own.
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + months, 1));
  return `Q${Math.floor(target.getUTCMonth() / 3) + 1} ${target.getUTCFullYear()}`;
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/* Sort key for the "Completion · soonest" mode (sortProjectsStandard in
   sanity.utils.ts). It used to be a bare `new Date(completionDate)`, which
   V8 parses for "October 2028" and "2026" but NOT for "Q2 2028" — and the
   quarter form is what most of the catalogue actually stores (49 of the 82
   developments carrying a completion value, 2026-08-24). Every one of those fell into
   the null branch and sorted BEHIND every project with a parseable date, so
   "soonest first" put the soonest-delivering projects last.

   Returns a UTC timestamp at the START of the stated period — a quarter, a
   month and a bare year are all ranges, and the earliest instant is the
   consistent choice across them.

   "Ready" and its synonyms are the one non-date label with an unambiguous
   position: the project is finished, so under "soonest first" it belongs at
   the very front, not behind everything with a future date. It maps to
   READY_SORT_KEY rather than to `now` so two ready projects always compare
   equal (and the sort stays stable) instead of drifting apart by milliseconds.

   Everything else that names no date ("TBA", "Off Plan") stays null and keeps
   sorting last: a label is not a date, and guessing one would reorder cards on
   invented data. */
// Finite on purpose — -Infinity would make `a - b` return NaN for two ready
// projects and corrupt the comparator. No real completion date is anywhere
// near the epoch, so 0 sorts ahead of every genuine value.
const READY_SORT_KEY = 0;
const READY_LABELS = /^(ready|ready to move in|ready to move|move-in ready|completed?|delivered|finished)$/i;
export function completionSortKey(raw: string | null | undefined): number | null {
  const s = resolveRelativeCompletion(raw);
  if (!s) return null;

  if (READY_LABELS.test(s)) return READY_SORT_KEY;

  const quarter = s.match(/^Q([1-4])\s+(\d{4})\b/i);
  if (quarter) return Date.UTC(Number(quarter[2]), (Number(quarter[1]) - 1) * 3, 1);

  const monthYear = s.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYear) {
    const i = MONTH_NAMES.indexOf(monthYear[1].toLowerCase());
    if (i >= 0) return Date.UTC(Number(monthYear[2]), i, 1);
  }

  // Legacy Project.completionDate is an ISO string ("2028-10" / "2028-10-01").
  const iso = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3] ?? 1));

  const year = s.match(/^(19|20)\d{2}$/);
  if (year) return Date.UTC(Number(s), 0, 1);

  return null;
}
