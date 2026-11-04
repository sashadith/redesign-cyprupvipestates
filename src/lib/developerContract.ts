// Developer contracts (2026-10-29) — the date maths, the status and which
// reminder is due. Pure and client-safe (no prisma import): the admin card,
// the sidebar dot, the Action Center rule and the reminder run all read the
// same functions, so the end date the operator sees is the one reminded on.
//
// Dates are calendar days as "YYYY-MM-DD". "Today" is the Nicosia date, not the
// server's or UTC's: a reminder "1 day before" counts the days the operator
// counts, whenever the run happens.

export const REMINDER_DAYS = [14, 1] as const;
export type ReminderStage = 14 | 1;
const STALE_AFTER_DAYS = 7;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_TERM_MONTHS = 600;

export type ContractDates = { signedAt: string; termMonths: number; autoRenew: boolean };
export type ContractStatusKind = "none" | "active" | "autoRenew" | "expiring" | "expired";
export type ContractStatus =
  | { kind: "none" }
  | { kind: Exclude<ContractStatusKind, "none">; endDate: string; daysLeft: number };

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(s: string): boolean {
  const m = ISO.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toISOString().slice(0, 10) === s;
}

const toUtc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Prisma returns a @db.Date column as UTC midnight. */
export const dateToIso = (d: Date): string => d.toISOString().slice(0, 10);

/** Same day n months later; a day the target month lacks becomes its last day (31 Jan + 1 → 28/29 Feb). */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = m - 1 + n;
  const ty = y + Math.floor(total / 12);
  const tm = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return fromUtc(Date.UTC(ty, tm, Math.min(d, last)));
}

export const addDays = (iso: string, n: number) => fromUtc(toUtc(iso) + n * 86_400_000);
export const daysBetween = (from: string, to: string) => Math.round((toUtc(to) - toUtc(from)) / 86_400_000);

/** Last day of the first term: signed 1 Jan, 12 months → 31 Dec. */
export const firstTermEnd = (signedAt: string, termMonths: number) => addDays(addMonths(signedAt, termMonths), -1);

/**
 * End of the term running on `today`. An auto-renewing contract rolls on by its
 * own term; each period is counted from the signing date (not from the previous
 * end) so a short month never shifts later periods.
 */
export function currentTermEnd(c: ContractDates, today: string): string {
  if (!c.autoRenew) return firstTermEnd(c.signedAt, c.termMonths);
  let k = 1;
  let end = firstTermEnd(c.signedAt, c.termMonths);
  while (end < today && k < 10_000) end = addDays(addMonths(c.signedAt, ++k * c.termMonths), -1);
  return end;
}

export function contractStatus(c: ContractDates | null, today: string): ContractStatus {
  if (!c) return { kind: "none" };
  const endDate = currentTermEnd(c, today);
  const daysLeft = daysBetween(today, endDate);
  if (c.autoRenew) return { kind: "autoRenew", endDate, daysLeft };
  if (daysLeft < 0) return { kind: "expired", endDate, daysLeft };
  if (daysLeft <= REMINDER_DAYS[0]) return { kind: "expiring", endDate, daysLeft };
  return { kind: "active", endDate, daysLeft };
}

/** The contract that counts: signed last; on the same day, the one entered last. */
export function currentContract<T extends { signedAt: Date | string; createdAt: Date | string }>(rows: T[]): T | null {
  const key = (r: T) => `${typeof r.signedAt === "string" ? r.signedAt : dateToIso(r.signedAt)}|${new Date(r.createdAt).toISOString()}`;
  return rows.reduce<T | null>((best, r) => (!best || key(r) > key(best) ? r : best), null);
}

/**
 * The reminder to send today, if any. A missed stage is caught up on the next
 * run (a contract entered 5 days before its end still gets the 14-day one);
 * once the 1-day stage is due the 14-day one is skipped, so a late entry gets
 * one message, not two.
 */
export function dueReminder(
  c: ContractDates & { reminder14SentAt: Date | null; reminder1SentAt: Date | null },
  today: string,
): ReminderStage | null {
  if (c.autoRenew) return null;
  const daysLeft = daysBetween(today, firstTermEnd(c.signedAt, c.termMonths));
  // A contract that ended more than a week ago (an old one uploaded as the
  // first, or left current after the newest was removed) gets no message —
  // the Action Center item already says it has expired.
  if (daysLeft < -STALE_AFTER_DAYS) return null;
  if (daysLeft <= 1) return c.reminder1SentAt ? null : 1;
  if (daysLeft <= 14) return c.reminder14SentAt ? null : 14;
  return null;
}

/** "Today" in Nicosia as YYYY-MM-DD. */
export function nicosiaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Nicosia", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function fmtDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** "ends tomorrow" / "ends in 14 days" / "ended 3 days ago" — admin copy, English. */
export function whenText(daysLeft: number): string {
  if (daysLeft > 1) return `ends in ${daysLeft} days`;
  if (daysLeft === 1) return "ends tomorrow";
  if (daysLeft === 0) return "ends today";
  if (daysLeft === -1) return "ended yesterday";
  return `ended ${-daysLeft} days ago`;
}

export const STATUS_LABEL: Record<ContractStatusKind, string> = {
  none: "No contract",
  active: "Contract active",
  autoRenew: "Renews automatically",
  expiring: "Contract ending",
  expired: "Contract expired",
};

// ── Form input ─────────────────────────────────────────────────────────────

export type ContractFields = { signedAt: string; termMonths: number; autoRenew: boolean; commissionPercent: number | null; note: string | null };

/** Validates what the admin form sends. Commission is optional, same rules as a commission rate. */
export function parseContractFields(input: { signedAt?: unknown; termMonths?: unknown; autoRenew?: unknown; commissionPercent?: unknown; note?: unknown }):
  { ok: true; value: ContractFields } | { ok: false; error: string } {
  const signedAt = String(input.signedAt ?? "").trim();
  if (!isIsoDate(signedAt)) return { ok: false, error: "Enter the signing date." };
  const termRaw = String(input.termMonths ?? "").trim();
  if (!/^\d{1,3}$/.test(termRaw)) return { ok: false, error: "Enter the term as whole months, e.g. 12." };
  const termMonths = Number(termRaw);
  if (termMonths < 1 || termMonths > MAX_TERM_MONTHS) return { ok: false, error: `The term must be 1 to ${MAX_TERM_MONTHS} months.` };
  const autoRenew = input.autoRenew === true || input.autoRenew === "on" || input.autoRenew === "true";
  let commissionPercent: number | null = null;
  const c = String(input.commissionPercent ?? "").trim().replace(/%$/, "").trim().replace(",", ".");
  if (c) {
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(c) || !(Number(c) > 0 && Number(c) <= 100)) return { ok: false, error: "Commission: a percentage like 10 or 5.5, above 0 and at most 100." };
    commissionPercent = Number(c);
  }
  const note = String(input.note ?? "").trim().slice(0, 500) || null;
  return { ok: true, value: { signedAt, termMonths, autoRenew, commissionPercent, note } };
}

/** A real PDF starts with "%PDF-" — the browser's MIME type and the file name are only claims. */
export function looksLikePdf(head: Uint8Array): boolean {
  return head.length >= 5 && head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46 && head[4] === 0x2d;
}
