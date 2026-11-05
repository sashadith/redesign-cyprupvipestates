import type { Prisma } from "@prisma/client";

// Who may see and edit which lead (CRM v2, 2026-10-18). The ONE place this is
// decided: the new CRM, exports, search and the MCP tools all go through it.
// The old /admin/crm does not; restricted employees are kept out of it (Phase 2).

export type CrmUser = {
  id: string;
  role: "ADMIN" | "EDITOR";
  isOwner: boolean;
  isActive: boolean;
  canSeeColleagues: boolean;
  canEditColleagues: boolean;
};

// workedByPartner is required on purpose: every edit check must read it.
type LeadOwner = { assignedToId: string | null; workedByPartner: boolean };

// While a partner works his FIX client (Lead.workedByPartner), staff only read
// the lead: no status, data, presentation or send. Work lists skip it with
// EXCLUDE_PARTNER_WORKED (leadBucket.ts).
export const PARTNER_WORKED_READONLY = "This client is worked by the partner — read only until they hand it over.";

const isManager = (u: CrmUser) => u.isOwner || u.role === "ADMIN";

export function seesAllLeads(u: CrmUser): boolean {
  return u.isActive && (isManager(u) || u.canSeeColleagues);
}

export function leadAccessWhere(u: CrmUser): Prisma.LeadWhereInput {
  if (!u.isActive) return { id: "__no_access__" };
  return seesAllLeads(u) ? {} : { assignedToId: u.id };
}

export function canViewLead(u: CrmUser, lead: { assignedToId: string | null }): boolean {
  if (!u.isActive) return false;
  return seesAllLeads(u) || lead.assignedToId === u.id;
}

export function canEditLead(u: CrmUser, lead: LeadOwner): boolean {
  if (!u.isActive) return false;
  if (lead.workedByPartner) return false;
  if (isManager(u)) return true;
  if (lead.assignedToId === u.id) return true;
  return u.canSeeColleagues && u.canEditColleagues;
}

// Developer side of a lead (developer registration): under the FIX agreement CVE
// handles the developer and never touches the client, so this ignores
// workedByPartner on purpose. Otherwise the same rule as canEditLead.
export function canWorkDeveloperSide(u: CrmUser, lead: { assignedToId: string | null }): boolean {
  return canEditLead(u, { assignedToId: lead.assignedToId, workedByPartner: false });
}

// Why an edit is refused, or null when it is allowed. A partner-worked lead the
// user may see gets PARTNER_WORKED_READONLY; anything else the caller's own
// "not found" text, so a lead the user cannot see is never revealed.
export function leadEditError(u: CrmUser, lead: LeadOwner, notFound = "Lead not found."): string | null {
  if (canEditLead(u, lead)) return null;
  return lead.workedByPartner && canViewLead(u, lead) ? PARTNER_WORKED_READONLY : notFound;
}

export function canAssignLeads(u: CrmUser): boolean {
  return u.isActive && isManager(u);
}
