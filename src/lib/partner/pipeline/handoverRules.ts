// Pure rules for a partner's handover request on a FIX lead they work themselves. No prisma here.
import type { LeadStatusValue } from "@/lib/crm/leadStatus";

// From this stage on the partner has done the work that earns the FIX share, so a handover keeps it.
export const HANDOVER_KEEPS_FIX_FROM: LeadStatusValue = "VIEWING_SCHEDULED";

const BEFORE_VIEWING: readonly LeadStatusValue[] = ["NEW", "CONTACTED", "COMMUNICATING", "KEEP_CONTACT"];

// Terminal statuses: nothing left to hand over.
const TERMINAL: readonly LeadStatusValue[] = ["LOST", "CLOSED"];

export function handoverAllowed(status: LeadStatusValue): boolean {
  return !TERMINAL.includes(status);
}

export function handoverPlan(lead: {
  status: LeadStatusValue;
  partnerMode: "HANDOVER" | "FIX" | null;
  hasLiveDeal: boolean;
}): { downgrade: boolean; noDowngradeBecauseDeal: boolean } {
  const eligible = lead.partnerMode === "FIX" && BEFORE_VIEWING.includes(lead.status);
  if (!eligible) return { downgrade: false, noDowngradeBecauseDeal: false };
  if (lead.hasLiveDeal) return { downgrade: false, noDowngradeBecauseDeal: true };
  return { downgrade: true, noDowngradeBecauseDeal: false };
}

// The partner may ask to keep the FIX share only while no deal is live.
export function mayKeepFix(hasLiveDeal: boolean): boolean {
  return !hasLiveDeal;
}
