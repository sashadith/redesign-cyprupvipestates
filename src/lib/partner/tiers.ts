// Partner tiers (partner portal phase 4b). Pure, no DB access.
// The system proposes an upgrade from the closed deals of the last 12 months; the operator confirms.
// There are no automatic downgrades: a lower count never produces a proposal.
import type { CommissionStatusValue } from "@/lib/crm/commission";

export type TierConfig = {
  key: string;
  name: string;
  sort: number;
  minClosedDeals: number;
  handoverShare: number;
  fixShare: number;
  active: boolean;
};

/** Deal statuses that count as a closed deal for the tier threshold. */
export const CLOSED_DEAL_STATUSES = ["EARNED", "DEVELOPER_PAID", "PAID_OUT"] as const satisfies readonly CommissionStatusValue[];

export const TIER_WINDOW_DAYS = 365;
const DAY = 86_400_000;

/**
 * Closed deals with `earnedAt` in [now − 365 days, now]. The caller passes only deals on leads where the
 * partner's claim is effectively committed (claimState.ts); this function does not re-check the claim.
 */
export function closedDealsLast12Months(deals: { commissionStatus: string; earnedAt: Date | null }[], now: Date): number {
  const from = now.getTime() - TIER_WINDOW_DAYS * DAY;
  const to = now.getTime();
  return deals.filter((d) => {
    if (!(CLOSED_DEAL_STATUSES as readonly string[]).includes(d.commissionStatus) || !d.earnedAt) return false;
    const t = d.earnedAt.getTime();
    return t >= from && t <= to;
  }).length;
}

const activeSorted = (tiers: TierConfig[]) => tiers.filter((t) => t.active).sort((a, b) => a.sort - b.sort || a.key.localeCompare(b.key));

/** The partner's tier for comparison and display: the stored key, else (unset or unknown) the lowest active tier. */
export function currentTier(currentKey: string | null, tiers: TierConfig[]): TierConfig | null {
  return tiers.find((t) => t.key === currentKey) ?? activeSorted(tiers)[0] ?? null;
}

/**
 * The highest active tier whose threshold is reached, when it ranks strictly above the current tier;
 * null otherwise (never a downgrade, never the same tier).
 */
export function proposeTier(currentKey: string | null, closedDeals: number, tiers: TierConfig[]): TierConfig | null {
  const reachable = activeSorted(tiers).filter((t) => t.minClosedDeals <= closedDeals);
  const target = reachable[reachable.length - 1];
  if (!target) return null;
  const current = currentTier(currentKey, tiers);
  return !current || target.sort > current.sort ? target : null;
}

export type TierProgress = { current: TierConfig; next: TierConfig | null; remaining: number; pct: number };

/**
 * Progress toward the next active tier above the current one. The bar runs from the current tier's
 * threshold to the next one (0–100, rounded). At the top tier: next null, remaining 0, pct 100.
 * Throws when no tier is configured at all (the migration seeds three).
 */
export function tierProgress(currentKey: string | null, closedDeals: number, tiers: TierConfig[]): TierProgress {
  const current = currentTier(currentKey, tiers);
  if (!current) throw new Error("tierProgress: no tiers configured");
  const next = activeSorted(tiers).find((t) => t.sort > current.sort) ?? null;
  if (!next) return { current, next: null, remaining: 0, pct: 100 };
  const remaining = Math.max(0, next.minClosedDeals - closedDeals);
  const span = next.minClosedDeals - current.minClosedDeals;
  const pct = span <= 0 ? 100 : Math.round(Math.min(1, Math.max(0, (closedDeals - current.minClosedDeals) / span)) * 100);
  return { current, next, remaining, pct: remaining === 0 ? 100 : pct };
}

const isShare = (v: number) => Number.isFinite(v) && v >= 0 && v <= 100;

/** CRM settings validation (English messages). Empty array = valid. */
export function validateTierConfig(rows: TierConfig[]): string[] {
  const errors: string[] = [];
  const keys = new Set<string>();
  for (const r of rows) {
    const label = r.name?.trim() || r.key;
    if (!r.key || keys.has(r.key)) errors.push(`Duplicate or missing tier key "${r.key}".`);
    keys.add(r.key);
    const name = (r.name ?? "").trim();
    if (name.length < 1 || name.length > 40) errors.push(`Tier "${r.key}": the name must be 1–40 characters.`);
    if (!Number.isInteger(r.sort)) errors.push(`Tier "${label}": the sort order must be a whole number.`);
    if (!Number.isInteger(r.minClosedDeals) || r.minClosedDeals < 0) errors.push(`Tier "${label}": the threshold must be a whole number of 0 or more.`);
    if (!isShare(r.handoverShare)) errors.push(`Tier "${label}": the handover share must be between 0 and 100.`);
    if (!isShare(r.fixShare)) errors.push(`Tier "${label}": the fix share must be between 0 and 100.`);
  }
  const active = activeSorted(rows);
  if (!active.length) errors.push("At least one tier must be active.");
  else if (!active.some((t) => t.minClosedDeals === 0)) errors.push("One active tier must have a threshold of 0 closed deals.");
  for (let i = 1; i < active.length; i++) {
    if (active[i].sort === active[i - 1].sort) errors.push(`Tiers "${active[i - 1].name}" and "${active[i].name}" have the same sort order.`);
    if (!(active[i].minClosedDeals > active[i - 1].minClosedDeals)) {
      errors.push(`Tier "${active[i].name}" needs a higher threshold than "${active[i - 1].name}".`);
    }
  }
  return errors;
}
