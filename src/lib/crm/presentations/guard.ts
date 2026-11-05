import { leadEditError, type CrmUser } from "../access";

// Pure access check for the new CRM's presentation actions. null = allowed.
// A lead the user may not edit is reported as missing, so its existence is not
// leaked; a partner-worked lead is read only. Deleting a selection is owner-only on top of that.
export function presentationGuard(
  user: CrmUser,
  lead: { assignedToId: string | null; workedByPartner: boolean } | null,
  op: "edit" | "delete",
): string | null {
  if (!lead) return "Lead not found.";
  const denied = leadEditError(user, lead);
  if (denied) return denied;
  if (op === "delete" && !user.isOwner) return "Only the owner can delete a selection.";
  return null;
}
