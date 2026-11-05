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

// Moving a lead TO VIEWING_SCHEDULED needs the appointment, as crm_update_lead requires.
export function viewingDateMissing(from: string, to: string, at: Date | null | undefined): boolean {
  return to === "VIEWING_SCHEDULED" && from !== to && !at;
}
