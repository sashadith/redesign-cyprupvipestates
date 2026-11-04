import { canAssignLeads, canEditLead, type CrmUser } from "./access";
import { SOURCE_LABEL } from "./boardModel";
import { STATUS_LABEL, isLeadStatus } from "./leadStatus";

// Pure helpers of the new CRM's trash (move to trash / restore / trash list).
export const TRASH_REASON_MAX = 300;
export const TRASH_LIST_CAP = 200;
export const TRASH_RETENTION_DAYS = 90;

// Optional free text: trimmed, empty means none, over-long input is refused
// (not silently cut) so the person sees why.
export function normalizeTrashReason(raw: unknown): { ok: true; reason: string | null } | { ok: false; error: string } {
  if (raw == null) return { ok: true, reason: null };
  if (typeof raw !== "string") return { ok: false, error: "Invalid reason." };
  const t = raw.trim();
  if (t.length > TRASH_REASON_MAX) return { ok: false, error: `Keep the reason under ${TRASH_REASON_MAX} characters.` };
  return { ok: true, reason: t || null };
}

export type TrashDecision = { allowed: true } | { allowed: false; error: string };

export function canTrashLead(user: CrmUser, lead: { assignedToId: string | null } | null): TrashDecision {
  if (!lead) return { allowed: false, error: "Lead not found." };
  if (!canEditLead(user, lead)) return { allowed: false, error: "You may not edit this lead." };
  return { allowed: true };
}

export function canRestoreLead(user: CrmUser): TrashDecision {
  return canAssignLeads(user) ? { allowed: true } : { allowed: false, error: "Only managers can restore leads." };
}

export type TrashRow = { id: string; name: string; source: string; status: string; trashedAt: string; trashedBy: string };

export function toTrashRow(
  l: { id: string; firstName: string; lastName: string; email: string | null; source: string; status: string; deletedAt: Date | null; deletedById: string | null },
  names: Map<string, string>,
): TrashRow {
  const name = `${l.firstName} ${l.lastName}`.trim() || l.email || "Unnamed lead";
  return {
    id: l.id,
    name,
    source: SOURCE_LABEL[l.source] ?? l.source,
    status: isLeadStatus(l.status) ? STATUS_LABEL[l.status] : l.status,
    trashedAt: l.deletedAt ? l.deletedAt.toISOString().slice(0, 10) : "",
    trashedBy: (l.deletedById && names.get(l.deletedById)) || "—",
  };
}
