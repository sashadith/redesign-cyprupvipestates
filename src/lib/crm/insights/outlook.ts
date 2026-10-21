// Commission outlook (CRM v2 phase 4a, Decision 3). Pure. Amounts are plain numbers (the server
// converts Decimals) and every output figure is whole euros.
import { dayKey } from "../today";

/** Estimate weight applied to the expected pipeline. No contract dates are invented. */
export const OUTLOOK_WEIGHT = 0.7;
export const OUTLOOK_MONTHS = 12;

export type OutlookDeal = {
  status: string; // EXPECTED | EARNED | DEVELOPER_PAID | PAID_OUT | CANCELLED
  ourCommission: number | null;
  partnerCommission: number | null;
  earnedAt: Date | null;
  developerPaidAt: Date | null;
  paidOutAt: Date | null;
};

export type OutlookMonth = { month: string; earned: number; developerPaid: number };
export type CommissionOutlook = {
  totals: { expected: number; earned: number; developerPaid: number; paidOutInPeriod: number };
  weightedExpected: number;
  partnerOwed: number;
  months: OutlookMonth[];
};

/** The last `count` Cyprus months ending at the month `now` falls in, oldest first, as "YYYY-MM". */
export function lastMonthKeys(now: Date, count: number = OUTLOOK_MONTHS): string[] {
  const [y, m] = dayKey(now).split("-").map(Number);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

export function commissionOutlook(input: {
  deals: OutlookDeal[];
  now: Date;
  period: { from: Date; to: Date }; // [from, to)
}): CommissionOutlook {
  const live = input.deals.filter((d) => d.status !== "CANCELLED");
  const amount = (d: OutlookDeal) => d.ourCommission ?? 0;
  let expected = 0, earned = 0, developerPaid = 0, paidOut = 0, partnerOwed = 0;
  for (const d of live) {
    if (d.status === "EXPECTED") expected += amount(d);
    else if (d.status === "EARNED") earned += amount(d);
    else if (d.status === "DEVELOPER_PAID") developerPaid += amount(d);
    else if (d.status === "PAID_OUT" && d.paidOutAt && d.paidOutAt >= input.period.from && d.paidOutAt < input.period.to) paidOut += amount(d);
    if (d.status === "EARNED" || d.status === "DEVELOPER_PAID") partnerOwed += d.partnerCommission ?? 0;
  }

  const keys = lastMonthKeys(input.now);
  const buckets = new Map(keys.map((k) => [k, { earned: 0, developerPaid: 0 }]));
  for (const d of live) {
    if (d.earnedAt) {
      const b = buckets.get(dayKey(d.earnedAt).slice(0, 7));
      if (b) b.earned += amount(d);
    }
    if (d.developerPaidAt) {
      const b = buckets.get(dayKey(d.developerPaidAt).slice(0, 7));
      if (b) b.developerPaid += amount(d);
    }
  }

  const expectedWhole = Math.round(expected);
  return {
    totals: {
      expected: expectedWhole,
      earned: Math.round(earned),
      developerPaid: Math.round(developerPaid),
      paidOutInPeriod: Math.round(paidOut),
    },
    weightedExpected: Math.round(expected * OUTLOOK_WEIGHT),
    partnerOwed: Math.round(partnerOwed),
    months: keys.map((month) => {
      const b = buckets.get(month)!;
      return { month, earned: Math.round(b.earned), developerPaid: Math.round(b.developerPaid) };
    }),
  };
}
