// Match alerts planner (partner portal phase 3e, Decision 6). Pure, no DB access: the cron loads the
// effectively ACTIVE claims with a budget and the last 24 h of inventoryChanges(), maps them to these
// shapes and writes the returned rows to the partner outbox (kind MATCH).
import { locationMatch } from "@/lib/crm/matching";
import type { ChangeType } from "@/lib/crm/inventoryChanges";

type Loc = { district: string | null; town: string | null; area: string | null };
export type MatchProject = { developmentId: string } & Loc;

export type MatchClaim = {
  claimId: string;
  partnerId: string;
  leadId: string;
  budgetMin: number | null;
  budgetMax: number | null;
  /** The claim's submitted projects. */
  projects: MatchProject[];
  /** The lead's projectInterest development; used only when there are no submitted projects. */
  interest?: MatchProject | null;
};

export type MatchChange = {
  type: ChangeType;
  developmentId: string;
  name: string;
  location: Loc;
  /** Unit price, or priceFrom for development-level events. */
  price: number | null;
  /** For price changes: the price before. A change without it is not a provable decrease. */
  previousPrice?: number | null;
  url: string;
};

export const MATCH_CHANGE_TYPES = ["published", "new_units", "price_from_changed", "unit_price_changed", "back_on_market"] as const;
export type MatchChangeType = (typeof MATCH_CHANGE_TYPES)[number];
const PRICE_CHANGES: readonly string[] = ["price_from_changed", "unit_price_changed"];

/** Tolerance on the budget maximum only; the minimum is never widened. */
export const MATCH_TOLERANCE = 0.1;
export const MAX_ALERTS_PER_CLAIM = 3;

export type MatchAlertPayload = { projectName: string; changeType: MatchChangeType; priceFrom: number; url: string };
export type PlannedMatchAlert = {
  claimId: string;
  partnerId: string;
  leadId: string;
  developmentId: string;
  refKey: string;
  payload: MatchAlertPayload;
};

export function matchRefKey(claimId: string, developmentId: string, today: string): string {
  return `match:${claimId}:${developmentId}:${today}`;
}

function relevant(c: MatchChange): c is MatchChange & { type: MatchChangeType; price: number } {
  if (!(MATCH_CHANGE_TYPES as readonly string[]).includes(c.type)) return false;
  if (c.price == null || !Number.isFinite(c.price) || c.price <= 0) return false;
  if (PRICE_CHANGES.includes(c.type)) return c.previousPrice != null && c.price < c.previousPrice;
  return true;
}

/** Within [min, max × 1.10]; missing min → 0, missing max → no upper bound; no budget at all → never. */
function inBudget(price: number, min: number | null, max: number | null): boolean {
  if (min == null && max == null) return false;
  if (price < (min ?? 0)) return false;
  // Integer arithmetic so that exactly +10 % is inside (max * 1.1 is not exact in floating point).
  return max == null || price * 10 <= max * (10 + MATCH_TOLERANCE * 10);
}

const districtKey = (l: Loc) => (l.district || l.town || "").toLowerCase();

export function planMatchAlerts(input: { claims: MatchClaim[]; changes: MatchChange[]; today: string }): PlannedMatchAlert[] {
  const changes = input.changes.filter(relevant);
  const out: PlannedMatchAlert[] = [];
  for (const claim of input.claims) {
    if (claim.budgetMin == null && claim.budgetMax == null) continue;
    const anchors = claim.projects.length ? claim.projects : claim.interest ? [claim.interest] : [];
    if (!anchors.length) continue;
    const ownIds = new Set(anchors.map((a) => a.developmentId));
    const districts = Array.from(new Set(anchors.map(districtKey).filter(Boolean)));

    // One candidate per development: the lowest matching price (first one on a tie).
    const best = new Map<string, MatchChange & { type: MatchChangeType; price: number }>();
    for (const ch of changes) {
      if (!inBudget(ch.price, claim.budgetMin, claim.budgetMax)) continue;
      const near = ownIds.has(ch.developmentId) || locationMatch(ch.location, districts, []).districtMatches;
      if (!near) continue;
      const cur = best.get(ch.developmentId);
      if (!cur || ch.price < cur.price) best.set(ch.developmentId, ch);
    }

    const picked = Array.from(best.values())
      .sort((a, b) => {
        const own = Number(ownIds.has(b.developmentId)) - Number(ownIds.has(a.developmentId));
        return own || a.price - b.price || a.developmentId.localeCompare(b.developmentId);
      })
      .slice(0, MAX_ALERTS_PER_CLAIM);

    for (const ch of picked) {
      out.push({
        claimId: claim.claimId,
        partnerId: claim.partnerId,
        leadId: claim.leadId,
        developmentId: ch.developmentId,
        refKey: matchRefKey(claim.claimId, ch.developmentId, input.today),
        payload: { projectName: ch.name, changeType: ch.type, priceFrom: ch.price, url: ch.url },
      });
    }
  }
  return out;
}
