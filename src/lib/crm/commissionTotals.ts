import type { CommissionStatusValue } from "./commission";

// Deals list and per-stage totals on the Commissions screen (2026-10-18). Pure.

// The list shows at most this many deals. The page loads one more, so the
// "Showing the latest 300" note appears only when there really are more.
export const DEALS_SHOWN = 300;

export function capDeals<T>(rows: T[]): { shown: T[]; truncated: boolean } {
  return { shown: rows.slice(0, DEALS_SHOWN), truncated: rows.length > DEALS_SHOWN };
}

export type StatusTotal = { status: CommissionStatusValue; count: number; sum: number; withoutRate: number };

// From prisma.deal.groupBy(by commissionStatus, _sum ourCommission, _count _all +
// ourCommission). _count.ourCommission counts non-null values, so the difference
// is the deals whose commission is unknown (no rate) — the sum leaves them out.
export function statusTotalsOf(
  groups: { commissionStatus: string; _sum: { ourCommission: number | null }; _count: { _all: number; ourCommission: number } }[],
): StatusTotal[] {
  return groups.map((g) => ({
    status: g.commissionStatus as CommissionStatusValue,
    count: g._count._all,
    sum: g._sum.ourCommission ?? 0,
    withoutRate: g._count._all - g._count.ourCommission,
  }));
}

export function withoutRateLabel(n: number): string | null {
  return n > 0 ? `${n} without rate` : null;
}
