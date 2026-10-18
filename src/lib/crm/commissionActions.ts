import { canTransitionCommission, type CommissionStatusValue } from "./commission";

// Which payout buttons a deal offers on the Commissions screen (2026-10-18). Pure.
// EXPECTED → EARNED is not a payout step: it follows the lead's status (closed).

export type PayoutAction = "DEVELOPER_PAID" | "PAID_OUT" | "CANCELLED";
export const PAYOUT_ACTIONS: readonly PayoutAction[] = ["DEVELOPER_PAID", "PAID_OUT", "CANCELLED"];

export function payoutActions(status: CommissionStatusValue): PayoutAction[] {
  return PAYOUT_ACTIONS.filter((a) => canTransitionCommission(status, a) && !(status === "EXPECTED" && a !== "CANCELLED"));
}

// Server-action arguments arrive from the client as-is: an id must be a
// non-empty string of at most 64 characters (cuid ids are ~25).
export function isIdArg(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

export function isPayoutAction(v: unknown): v is PayoutAction {
  return typeof v === "string" && (PAYOUT_ACTIONS as readonly string[]).includes(v);
}

// The date a payout stage happened: "YYYY-MM-DD", a real calendar day, not after
// today (compared as UTC date strings). Stored at 12:00 UTC so no time zone
// shifts it to a neighbouring day.
export function parseStageDate(input: string, now: Date = new Date()): { ok: true; value: Date } | { ok: false; error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return { ok: false, error: "Pick a date." };
  const value = new Date(`${input}T12:00:00.000Z`);
  if (Number.isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== input) return { ok: false, error: "Pick a valid date." };
  if (input > now.toISOString().slice(0, 10)) return { ok: false, error: "The date cannot be in the future." };
  return { ok: true, value };
}

// A payout stage cannot predate the stage it follows: the developer cannot pay
// before the deal was earned, and we cannot pay the partner out before that.
// Compared as UTC date strings, like parseStageDate.
export function stageOrderError(
  to: PayoutAction,
  onDate: string,
  deal: { earnedAt: Date | null; developerPaidAt: Date | null },
): string | null {
  const prior = to === "DEVELOPER_PAID" ? deal.earnedAt : to === "PAID_OUT" ? deal.developerPaidAt : null;
  if (!prior) return null;
  const priorDay = prior.toISOString().slice(0, 10);
  if (onDate >= priorDay) return null;
  return `The date cannot be before ${to === "DEVELOPER_PAID" ? "the deal was earned" : "the developer paid"} (${priorDay}).`;
}
