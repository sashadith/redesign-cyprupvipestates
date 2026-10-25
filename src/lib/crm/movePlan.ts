import type { LeadStatusValue } from "./leadStatus";

// What a pipeline move requires and does to the lead's deals (2026-10-18). Pure.
// Reserved creates a deal, Sold earns it, Lost asks for a reason, and leaving
// the Reserved/Sold zone cancels open deals — unless the developer already paid.

export type DealLite = { id: string; commissionStatus: "EXPECTED" | "EARNED" | "DEVELOPER_PAID" | "PAID_OUT" | "CANCELLED" };

export type MovePlan =
  | { kind: "blocked"; reason: string }
  | { kind: "ok"; needsDeal: boolean; needsLostReason: boolean; cancelDealIds: string[]; earnDealIds: string[] };

const DEAL_ZONE: LeadStatusValue[] = ["RESERVED", "CLOSED"];

// `from` is accepted for future rules and readability; it does not change the outcome today.
export function planMove(from: LeadStatusValue, to: LeadStatusValue, deals: DealLite[]): MovePlan {
  void from;
  const live = deals.filter((d) => d.commissionStatus !== "CANCELLED");
  const settled = live.filter((d) => d.commissionStatus === "DEVELOPER_PAID" || d.commissionStatus === "PAID_OUT");
  const open = live.filter((d) => d.commissionStatus === "EXPECTED" || d.commissionStatus === "EARNED");
  const leavingZone = !DEAL_ZONE.includes(to);

  if (leavingZone && settled.length) {
    return { kind: "blocked", reason: "A deal on this lead was already paid by the developer; it cannot leave Reserved/Sold." };
  }

  const plan = { kind: "ok" as const, needsDeal: false, needsLostReason: to === "LOST", cancelDealIds: [] as string[], earnDealIds: [] as string[] };
  if (leavingZone) {
    plan.cancelDealIds = open.map((d) => d.id);
    return plan;
  }
  if (to === "RESERVED") {
    plan.needsDeal = live.length === 0;
    return plan;
  }
  // to === "CLOSED"
  plan.earnDealIds = live.filter((d) => d.commissionStatus === "EXPECTED").map((d) => d.id);
  plan.needsDeal = live.length === 0;
  return plan;
}
