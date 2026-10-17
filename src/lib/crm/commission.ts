import type { LeadStatusValue } from "./leadStatus";

// Commission maths for CRM v2 deals (2026-10-18). Pure; the deal form, the
// Commissions screen and the partner portal all compute through here so a
// partner never sees a number the CRM would not.

export const DEFAULT_HANDOVER_SHARE = 30;
export const DEFAULT_FIX_SHARE = 50;

export type RateRow = { developerAccountId: string; developmentId: string | null; ratePercent: number };

export function resolveRate(
  rows: RateRow[],
  developerAccountId: string,
  developmentId: string,
): { ratePercent: number | null; source: "PROJECT" | "DEVELOPER" | "MISSING" } {
  const project = rows.find((r) => r.developmentId === developmentId);
  if (project) return { ratePercent: project.ratePercent, source: "PROJECT" };
  const developer = rows.find((r) => r.developerAccountId === developerAccountId && r.developmentId === null);
  if (developer) return { ratePercent: developer.ratePercent, source: "DEVELOPER" };
  return { ratePercent: null, source: "MISSING" };
}

// Percentages are DECIMAL(5,2), so work in integer basis points: 5.55% → 555.
// amount * pct / 100 in floats turns exact halves like 1161.5 into
// 1161.4999999999998 and rounds them the wrong way.
const percentOf = (amount: number, percent: number) => Math.round((amount * Math.round(percent * 100)) / 10000);

export function computeDealAmounts(input: {
  price: number;
  ourRatePercent: number | null;
  partnerSharePercent: number | null;
  ourCommissionOverride?: number | null;
  partnerCommissionOverride?: number | null;
}): { ourCommission: number | null; partnerCommission: number | null } {
  const ourCommission =
    input.ourCommissionOverride ?? (input.ourRatePercent == null ? null : percentOf(input.price, input.ourRatePercent));
  if (ourCommission == null) return { ourCommission: null, partnerCommission: null };
  const partnerCommission =
    input.partnerCommissionOverride ??
    (input.partnerSharePercent == null ? null : percentOf(ourCommission, input.partnerSharePercent));
  return { ourCommission, partnerCommission };
}

export const COMMISSION_STATUSES = ["EXPECTED", "EARNED", "DEVELOPER_PAID", "PAID_OUT", "CANCELLED"] as const;
export type CommissionStatusValue = (typeof COMMISSION_STATUSES)[number];

const NEXT: Record<CommissionStatusValue, CommissionStatusValue[]> = {
  EXPECTED: ["EARNED", "CANCELLED"],
  EARNED: ["DEVELOPER_PAID", "CANCELLED"],
  DEVELOPER_PAID: ["PAID_OUT", "CANCELLED"],
  PAID_OUT: [],
  CANCELLED: [],
};

export function canTransitionCommission(from: CommissionStatusValue, to: CommissionStatusValue): boolean {
  return NEXT[from].includes(to);
}

export function commissionStatusForLeadStatus(leadStatus: LeadStatusValue): CommissionStatusValue | null {
  if (leadStatus === "RESERVED") return "EXPECTED";
  if (leadStatus === "CLOSED") return "EARNED";
  return null;
}

export function estimatePartnerCommission(input: {
  budget: number | null;
  ourRatePercent: number | null;
  partnerSharePercent: number;
}): number | null {
  if (input.budget == null || input.ourRatePercent == null) return null;
  return computeDealAmounts({ price: input.budget, ourRatePercent: input.ourRatePercent, partnerSharePercent: input.partnerSharePercent }).partnerCommission;
}
