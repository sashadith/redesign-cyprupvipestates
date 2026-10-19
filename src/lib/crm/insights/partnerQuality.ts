// Partner quality rows and flags (CRM v2 phase 4a, Decision 3). Pure: one PartnerClaimFact per
// claim created in the period, with the lead facts the server has batched for it.
import { effectiveClaimState, isCommitted, activeSince, type ClaimStateValue } from "../../partner/claimState";
import { median, pct1 } from "./channels";

export const LOW_QUALITY_MIN_SUBMITTED = 5;
export const LOW_QUALITY_VALID_RATIO = 0.4;
export const TOP_PARTNER_MIN_CLOSED = 2;
/** Lost reasons that make an accepted claim not "valid". */
export const INVALID_LOST_REASONS = ["UNREACHABLE", "INVALID"] as const;
const VIEWING_OR_LATER = ["VIEWING_SCHEDULED", "OFFER", "RESERVED", "CLOSED"];

export type InsightPartner = { id: string; name: string; status: string };

export type PartnerClaimFact = {
  partnerId: string;
  state: ClaimStateValue;
  createdAt: Date;
  reviewedAt: Date | null;
  lastRealContactAt: Date | null;
  leadDeleted: boolean;
  leadStatus: string | null;
  leadLostReason: string | null;
  hasLiveDeal: boolean;
  reachedViewing: boolean; // lead reached VIEWING_SCHEDULED at any point
  responseMinutes: number | null; // partner's first response time to their client
};

export type PartnerQualityRow = {
  partnerId: string;
  name: string;
  status: string;
  submitted: number;
  accepted: number;
  inReview: number;
  rejected: number;
  valid: number;
  reachedViewing: number;
  closed: number;
  conversionPct: number | null; // closed / accepted
  medianResponseMin: number | null;
  lowQuality: boolean;
  topPartner: boolean;
};

export function partnerQualityRows(input: { partners: InsightPartner[]; claims: PartnerClaimFact[]; now: Date }): PartnerQualityRow[] {
  const byPartner = new Map<string, PartnerClaimFact[]>();
  for (const c of input.claims) {
    const list = byPartner.get(c.partnerId);
    if (list) list.push(c);
    else byPartner.set(c.partnerId, [c]);
  }

  const rows = input.partners.map((p): PartnerQualityRow => {
    const claims = byPartner.get(p.id) ?? [];
    let accepted = 0, inReview = 0, rejected = 0, valid = 0, viewing = 0, closed = 0;
    const responses: number[] = [];
    for (const c of claims) {
      if (c.state === "IN_REVIEW") inReview += 1;
      if (c.state === "REJECTED") rejected += 1;
      if (c.responseMinutes !== null) responses.push(c.responseMinutes);

      const eff = effectiveClaimState({
        state: c.state, activeSince: activeSince(c), lastRealContactAt: c.lastRealContactAt, now: input.now,
        leadDeleted: c.leadDeleted, leadStatus: c.leadStatus, hasLiveDeal: c.hasLiveDeal,
      });
      // accepted = ACTIVE, or committed (live deal / RESERVED / CLOSED) on a claim that was not rejected or still in review
      const isAccepted = eff === "ACTIVE" || (c.state !== "IN_REVIEW" && c.state !== "REJECTED" && isCommitted(c));
      if (!isAccepted) continue;
      accepted += 1;
      const invalid = c.leadStatus === "LOST" && (INVALID_LOST_REASONS as readonly string[]).includes(c.leadLostReason ?? "");
      if (!invalid) valid += 1;
      if (c.reachedViewing || VIEWING_OR_LATER.includes(c.leadStatus ?? "")) viewing += 1;
      if (c.leadStatus === "CLOSED") closed += 1;
    }
    const submitted = claims.length;
    return {
      partnerId: p.id, name: p.name, status: p.status, submitted, accepted, inReview, rejected, valid,
      reachedViewing: viewing, closed,
      conversionPct: pct1(closed, accepted),
      medianResponseMin: median(responses),
      lowQuality: submitted >= LOW_QUALITY_MIN_SUBMITTED && valid / submitted < LOW_QUALITY_VALID_RATIO,
      topPartner: closed >= TOP_PARTNER_MIN_CLOSED,
    };
  });
  return rows.sort((a, b) => b.submitted - a.submitted || a.name.localeCompare(b.name));
}
