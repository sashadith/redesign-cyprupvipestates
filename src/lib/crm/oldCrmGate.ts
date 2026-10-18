import { seesAllLeads, type CrmUser } from "./access";

// The old /admin/crm does not know per-employee visibility, so only people who
// may see every lead are let in (operator decision 2026-10-18).
export function mayUseOldCrm(u: CrmUser | null): boolean {
  return u !== null && seesAllLeads(u);
}
