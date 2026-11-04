// The one rule for "is this claim effectively active?" (partner portal phase 3b, final fix wave A).
// Pure, no DB access. Every place that decides on a claim's live state uses it: the portal display
// and filters, CRM accept, the partner share on a new deal, "already yours" on submit, the message
// composer and the notification outbox. Do not re-implement any part of it elsewhere.
import { claimProtection } from "./claims";

/** Lead statuses that commit a claim: its protection never runs out (the partner must always see their commission). */
export const COMMITTED_LEAD_STATUSES = ["RESERVED", "CLOSED"] as const;

export type ClaimStateValue = "ACTIVE" | "IN_REVIEW" | "REJECTED" | "EXPIRED";
/** The raw state plus NOT_PROCEEDING (an ACTIVE claim on a trashed lead). */
export type EffectiveClaimState = ClaimStateValue | "NOT_PROCEEDING";

/**
 * When the claim became active: an accepted known contact at review time, a new lead at submission.
 * Protection, and everything a partner may see about the lead (deals, milestones, activity, messages,
 * stage mails), starts here. The response-time metric alone keeps the submission time (createdAt).
 */
export function activeSince(claim: { createdAt: Date; reviewedAt?: Date | null }): Date {
  return claim.reviewedAt ?? claim.createdAt;
}

/** Committed = lead RESERVED/CLOSED or at least one non-CANCELLED deal on the lead. */
export function isCommitted(input: { leadStatus: string | null | undefined; hasLiveDeal: boolean }): boolean {
  return input.hasLiveDeal || (COMMITTED_LEAD_STATUSES as readonly string[]).includes(input.leadStatus ?? "");
}

/**
 * Effective state of a claim. Only an ACTIVE claim is re-evaluated:
 *  - on a trashed (or missing) lead → NOT_PROCEEDING;
 *  - committed (live deal or lead RESERVED/CLOSED) → ACTIVE;
 *  - protection (6 months from max(activeSince, last real contact)) run out → EXPIRED;
 *  - otherwise ACTIVE.
 * IN_REVIEW / REJECTED / EXPIRED are returned as they are.
 */
export function effectiveClaimState(input: {
  state: ClaimStateValue;
  activeSince: Date;
  lastRealContactAt: Date | null;
  now: Date;
  leadDeleted: boolean;
  leadStatus: string | null | undefined;
  hasLiveDeal: boolean;
}): EffectiveClaimState {
  if (input.state !== "ACTIVE") return input.state;
  if (input.leadDeleted) return "NOT_PROCEEDING";
  if (isCommitted(input)) return "ACTIVE";
  const p = claimProtection({ claimCreatedAt: input.activeSince, lastRealContactAt: input.lastRealContactAt, now: input.now });
  return p.expired ? "EXPIRED" : "ACTIVE";
}
