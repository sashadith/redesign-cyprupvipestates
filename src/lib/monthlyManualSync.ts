// The monthly manual-sync round (2026-10-16). Every hand-maintained developer
// account (DeveloperAccount.monthlyManualSync) is synced once a month, on the
// FIRST MONDAY, and the Action Center shows one item listing the ones still
// open. Pure: dates are compared as Cyprus calendar dates ("YYYY-MM-DD" in
// Europe/Nicosia), so no timezone arithmetic can shift a round by a day.

const TZ = "Europe/Nicosia";

/** "YYYY-MM-DD" of `d` in Cyprus. */
export function nicosiaDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** First Monday of a month, as "YYYY-MM-DD" (month 1–12). */
export function firstMonday(year: number, month: number): string {
  const dow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0 = Sunday
  const day = 1 + ((8 - dow) % 7);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The round in force on `now`: this month's first Monday once it has come,
 *  otherwise last month's. */
export function currentRound(now: Date): string {
  const [y, m] = nicosiaDate(now).split("-").map(Number);
  const thisMonth = firstMonday(y, m);
  if (nicosiaDate(now) >= thisMonth) return thisMonth;
  return m === 1 ? firstMonday(y - 1, 12) : firstMonday(y, m - 1);
}

/** The round after `round` — for "next round" hints. */
export function nextRound(round: string): string {
  const [y, m] = round.split("-").map(Number);
  return m === 12 ? firstMonday(y + 1, 1) : firstMonday(y, m + 1);
}

/** Done for a round = marked done on or after that round's day (Cyprus date). */
export const doneForRound = (manualSyncedAt: Date | null | undefined, round: string): boolean =>
  !!manualSyncedAt && nicosiaDate(manualSyncedAt) >= round;

export type RoundAccount = { id: string; name: string; manualSyncedAt: Date | null };

export function roundStatus(accounts: RoundAccount[], now: Date): { round: string; open: RoundAccount[]; done: RoundAccount[] } {
  const round = currentRound(now);
  const open = accounts.filter((a) => !doneForRound(a.manualSyncedAt, round)).sort((a, b) => a.name.localeCompare(b.name));
  const done = accounts.filter((a) => doneForRound(a.manualSyncedAt, round));
  return { round, open, done };
}
