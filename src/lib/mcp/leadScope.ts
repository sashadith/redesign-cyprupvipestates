import type { Prisma } from "@prisma/client";
import { canEditLead, leadAccessWhere, type CrmUser } from "@/lib/crm/access";
import { loadCrmUser } from "@/lib/crm/accessUser";
import type { McpCallContext } from "./context";
import { ToolError } from "./toolWrapper";

// MCP tools see exactly the leads the connected user sees in the CRM. A lead
// outside the scope is reported with the tool's ordinary "Lead not found."
// error, so its existence never leaks.
export function scopeFor(user: CrmUser | null): Prisma.LeadWhereInput {
  return user ? leadAccessWhere(user) : { id: "__no_access__" };
}

export type LeadScope = { user: CrmUser; where: Prisma.LeadWhereInput };

export async function loadScope(ctx: McpCallContext): Promise<LeadScope> {
  const user = await loadCrmUser(ctx.userId);
  if (!user || !user.isActive) throw new ToolError("unauthorized", "Your account cannot access leads");
  return { user, where: scopeFor(user) };
}

export function assertCanEdit(user: CrmUser, lead: { assignedToId: string | null }): void {
  if (!canEditLead(user, lead)) throw new ToolError("unauthorized", "You can view this lead but not change it");
}
