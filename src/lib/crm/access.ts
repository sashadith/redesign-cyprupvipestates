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

type LeadOwner = { assignedToId: string | null };

const isManager = (u: CrmUser) => u.isOwner || u.role === "ADMIN";

export function seesAllLeads(u: CrmUser): boolean {
  return u.isActive && (isManager(u) || u.canSeeColleagues);
}

export function leadAccessWhere(u: CrmUser): Prisma.LeadWhereInput {
  if (!u.isActive) return { id: "__no_access__" };
  return seesAllLeads(u) ? {} : { assignedToId: u.id };
}

export function canViewLead(u: CrmUser, lead: LeadOwner): boolean {
  if (!u.isActive) return false;
  return seesAllLeads(u) || lead.assignedToId === u.id;
}

export function canEditLead(u: CrmUser, lead: LeadOwner): boolean {
  if (!u.isActive) return false;
  if (isManager(u)) return true;
  if (lead.assignedToId === u.id) return true;
  return u.canSeeColleagues && u.canEditColleagues;
}

export function canAssignLeads(u: CrmUser): boolean {
  return u.isActive && isManager(u);
}
