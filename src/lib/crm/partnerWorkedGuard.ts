import { prisma } from "@/lib/prisma";
import { PARTNER_WORKED_READONLY } from "./access";

// The old /admin CRM does not go through canEditLead (access.ts), so its lead
// writes ask here instead: while a partner works the FIX client, staff only read it.
export async function isPartnerWorked(leadId: string): Promise<boolean> {
  if (typeof leadId !== "string" || !leadId) return false;
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { workedByPartner: true } });
  return !!lead?.workedByPartner;
}

/** Throws PARTNER_WORKED_READONLY when any of the leads is partner-worked. */
export async function assertNotPartnerWorked(...leadIds: string[]): Promise<void> {
  const ids = leadIds.filter((id) => typeof id === "string" && id);
  if (!ids.length) return;
  const n = await prisma.lead.count({ where: { id: { in: ids }, workedByPartner: true } });
  if (n > 0) throw new Error(PARTNER_WORKED_READONLY);
}
