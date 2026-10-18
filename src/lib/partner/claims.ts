// Pure claim logic (partner portal phase 3b). No DB access.

/** Interaction types that count as real contact with the client (notes do not). */
export const REAL_CONTACT_TYPES = ["CALL", "EMAIL_OUT", "EMAIL_IN", "WHATSAPP_OUT", "WHATSAPP_IN"] as const;

export type SubmissionDecision =
  | { kind: "CREATE" }
  | { kind: "REVIEW"; leadId: string }
  | { kind: "ALREADY_YOURS"; leadId: string };

export function decideSubmission(input: {
  duplicate: { leadId: string } | null;
  myActiveClaimLeadIds: string[];
}): SubmissionDecision {
  if (!input.duplicate) return { kind: "CREATE" };
  const leadId = input.duplicate.leadId;
  return input.myActiveClaimLeadIds.includes(leadId) ? { kind: "ALREADY_YOURS", leadId } : { kind: "REVIEW", leadId };
}

/** UTC month arithmetic, clamping the day to the target month's length (31 Aug + 6 = 28/29 Feb). */
export function addMonthsUtc(d: Date, months: number): Date {
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + months;
  const y = Math.floor(total / 12);
  const m = total % 12;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(
    y, m, Math.min(d.getUTCDate(), last),
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds(),
  ));
}

/** Protected until max(claimCreatedAt, lastRealContactAt) + 6 calendar months. */
export function claimProtection(input: {
  claimCreatedAt: Date;
  lastRealContactAt: Date | null;
  now: Date;
}): { protectedUntil: Date; expired: boolean } {
  const { claimCreatedAt, lastRealContactAt, now } = input;
  const anchor = lastRealContactAt && lastRealContactAt > claimCreatedAt ? lastRealContactAt : claimCreatedAt;
  const protectedUntil = addMonthsUtc(anchor, 6);
  return { protectedUntil, expired: now.getTime() > protectedUntil.getTime() };
}
