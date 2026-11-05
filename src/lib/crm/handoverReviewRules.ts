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

/**
 * The downgrade acceptance applies: only one the partner confirmed at the request (stored), and only while
 * today's data still calls for it (a deal or a move to VIEWING_SCHEDULED since cancels it). Fresh data never
 * creates a downgrade the partner was not warned about.
 */
export function effectiveDowngrade(stored: boolean, fresh: boolean): boolean {
  return stored && fresh;
}

/** Who owns the lead after acceptance: the partner's manager while that user is active, else the accepting user. */
export function acceptOwnerId(actorId: string, manager: { id: string; isActive: boolean } | null): string {
  return manager && manager.isActive ? manager.id : actorId;
}

export type TakeOverReason = "partner_inactive" | "protection_lapsed";

/**
 * Why the partner can no longer work his FIX client, or null when he still can: his account is not ACTIVE
 * (suspended, pending), or his claim is not effectively ACTIVE (protection lapsed, gone). The partner status
 * is checked first: it is the reason staff can act on, whatever the protection says.
 */
export function takeOverReason(p: { claimEffective: string | null; partnerStatus: string | null }): TakeOverReason | null {
  if (p.partnerStatus !== "ACTIVE") return "partner_inactive";
  if (p.claimEffective !== "ACTIVE") return "protection_lapsed";
  return null;
}

/** A partner-worked lead nobody could otherwise work: staff may take it over explicitly. */
export function partnerCannotAct(p: { claimEffective: string | null; partnerStatus: string | null }): boolean {
  return takeOverReason(p) !== null;
}

export const TAKE_OVER_REASON_LABEL: Record<TakeOverReason, string> = {
  partner_inactive: "Partner account not active",
  protection_lapsed: "Partner protection lapsed",
};

/** The lead's partnerMode after acceptance; null leaves it as it is. keepFix only ever undoes a downgrade. */
export function acceptOutcome(p: { downgrade: boolean; keepFix: boolean }): PartnerModeValue | null {
  return p.downgrade && !p.keepFix ? "HANDOVER" : null;
}

/**
 * The partnerMode a keep-FIX toggle sets; null when nothing would change. Both directions exist only after an
 * early handover (downgrade): keep undoes the downgrade, un-keep restores it. Never an upgrade to FIX otherwise.
 */
export function keepFixChange(p: { keep: boolean; currentMode: PartnerModeValue | null; downgrade: boolean }): PartnerModeValue | null {
  if (!p.downgrade) return null;
  if (p.keep) return p.currentMode === "FIX" ? null : "FIX";
  return p.currentMode === "HANDOVER" ? null : "HANDOVER";
}

/**
 * An OPEN request nobody answered: "remind" (the manager) from 24 h, "escalate" (every admin) from 48 h.
 * Each fires once, stamped on the row. When both are due in one run (the 24 h run was missed) only the
 * escalation fires and the runner stamps the reminder with it, so no stale reminder follows.
 */
export function escalationDue(
  req: { createdAt: Date; remindedAt: Date | null; escalatedAt: Date | null },
  now: Date,
): "remind" | "escalate" | null {
  const age = now.getTime() - req.createdAt.getTime();
  if (age >= HANDOVER_ESCALATE_MS && !req.escalatedAt) return "escalate";
  if (age >= HANDOVER_REMIND_MS && !req.remindedAt && !req.escalatedAt) return "remind";
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
