import { canEditLead, type CrmUser } from "../access";

// Pure access check for the new CRM's presentation actions. null = allowed.
// A lead the user may not edit is reported as missing, so its existence is not
// leaked. Deleting a selection is owner-only on top of that.
export function presentationGuard(
  user: CrmUser,
  lead: { assignedToId: string | null } | null,
  op: "edit" | "delete",
): string | null {
  if (!lead || !canEditLead(user, lead)) return "Lead not found.";
  if (op === "delete" && !user.isOwner) return "Only the owner can delete a selection.";
  return null;
}
