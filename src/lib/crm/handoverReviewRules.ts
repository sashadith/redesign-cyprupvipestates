// Pure rules for the manager's side of a partner's handover request (partner pipeline,
// 2026-11-05): who may accept, what the lead's partnerMode becomes, the keep-FIX
// override and the 24 h / 48 h escalation. No prisma here; handoverReview.ts applies them.
import type { CrmUser } from "./access";

export type PartnerModeValue = "FIX" | "HANDOVER";

export const DEAL_FIXED_ERROR = "The deal already exists — its commission share is fixed.";
export const NOTHING_TO_CHANGE = "Nothing to change.";

export const HANDOVER_REMIND_MS = 24 * 3_600_000;
export const HANDOVER_ESCALATE_MS = 48 * 3_600_000;

/** Admins and owners always (also when the partner has no manager); otherwise only the partner's own manager. */
export function mayAcceptHandover(u: Pick<CrmUser, "id" | "role" | "isOwner" | "isActive">, managerUserId: string | null): boolean {
  if (!u.isActive) return false;
  if (u.isOwner || u.role === "ADMIN") return true;
  return !!managerUserId && u.id === managerUserId;
}

/** The lead's partnerMode after acceptance; null leaves it as it is. */
export function acceptOutcome(p: { downgrade: boolean; keepFix: boolean }): PartnerModeValue | null {
  if (p.keepFix) return "FIX";
  return p.downgrade ? "HANDOVER" : null;
}

/** The partnerMode a keep-FIX toggle sets; null when nothing would change. Un-keep returns to HANDOVER only after an early handover. */
export function keepFixChange(p: { keep: boolean; currentMode: PartnerModeValue | null; downgrade: boolean }): PartnerModeValue | null {
  if (p.keep) return p.currentMode === "FIX" ? null : "FIX";
  return p.downgrade && p.currentMode !== "HANDOVER" ? "HANDOVER" : null;
}

/**
 * An OPEN request nobody answered: "remind" (the manager) from 24 h, "escalate" (every admin) from 48 h.
 * Each fires once, stamped on the row; the escalation goes first when both are due.
 */
export function escalationDue(
  req: { createdAt: Date; remindedAt: Date | null; escalatedAt: Date | null },
  now: Date,
): "remind" | "escalate" | null {
  const age = now.getTime() - req.createdAt.getTime();
  if (age >= HANDOVER_ESCALATE_MS && !req.escalatedAt) return "escalate";
  if (age >= HANDOVER_REMIND_MS && !req.remindedAt) return "remind";
  return null;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The office Telegram for an unanswered request (English, CRM side). */
export function handoverEscalationHtml(a: { kind: "remind" | "escalate"; partnerName: string; client: string; hours: number; url: string }): string {
  const head = a.kind === "remind"
    ? `Reminder: partner ${a.partnerName} asked you to take over ${a.client} ${a.hours} h ago.`
    : `Unanswered for ${a.hours} h: partner ${a.partnerName} asked to hand over ${a.client}. Any admin can accept it.`;
  return [esc(head), `<a href="${esc(a.url)}">Open the lead in the CRM</a>`].join("\n");
}
