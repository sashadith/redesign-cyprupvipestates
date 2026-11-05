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
