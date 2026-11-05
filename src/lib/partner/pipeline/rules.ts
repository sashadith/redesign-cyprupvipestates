// Pure rules for the partner FIX pipeline: no prisma, safe for client code and tests.

// A FIX claim accepted on a lead nobody on staff owns is worked by the partner;
// once a staff member is assigned, or for HANDOVER, staff keep working it.
export function workedByPartnerOnAccept(mode: "HANDOVER" | "FIX", assignedToId: string | null): boolean {
  return mode === "FIX" && assignedToId === null;
}

// The partner may act on a lead only when it is his, flagged as partner-worked, and not in the trash.
export function partnerMayWork(
  lead: { partnerId: string | null; workedByPartner: boolean; deletedAt: Date | null },
  partnerId: string,
): boolean {
  return lead.partnerId === partnerId && lead.workedByPartner && lead.deletedAt === null;
}

// A claim opens the partner's pipeline only when it is his, FIX, and ACTIVE.
export function claimEligible(
  claim: { partnerId: string; mode: "HANDOVER" | "FIX"; state: "ACTIVE" | "IN_REVIEW" | "REJECTED" | "EXPIRED" } | null,
  partnerId: string,
): boolean {
  return !!claim && claim.partnerId === partnerId && claim.mode === "FIX" && claim.state === "ACTIVE";
}

// The partner may act on his FIX client only while all three hold: the stored claim
// is his ACTIVE FIX claim, its protection is EFFECTIVELY active (effectiveStateOf,
// the same judgement as the deal's partner share), and partnerMayWork holds.
export function partnerMayAct(
  claim: Parameters<typeof claimEligible>[0],
  effective: string | null,
  lead: Parameters<typeof partnerMayWork>[0] | null,
  partnerId: string,
): boolean {
  return claimEligible(claim, partnerId) && effective === "ACTIVE" && !!lead && partnerMayWork(lead, partnerId);
}
