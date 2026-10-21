// Partner tiers — the glue between the pure rules (tiers.ts) and the DB side (tierStore.ts, CRM actions,
// the partner-tiers cron, the TIER_UP outbox row). Pure, no DB access, so every decision is testable.
import type { Prisma } from "@prisma/client";
import { activeSince } from "./claimState";
import { fmt, type PartnerDict, type PartnerLocale } from "./i18n";
import { escapeHtml } from "./mail";
import { CLOSED_DEAL_STATUSES, TIER_WINDOW_DAYS, closedDealsLast12Months, currentTier, type TierConfig, type TierProgress } from "./tiers";

const DAY = 86_400_000;

/** A PartnerTier row (Decimal shares) as the pure TierConfig. */
export function tierFromRow(row: {
  key: string; name: string; sort: number; minClosedDeals: number; handoverShare: unknown; fixShare: unknown; active: boolean;
}): TierConfig {
  return {
    key: row.key, name: row.name, sort: row.sort, minClosedDeals: row.minClosedDeals,
    handoverShare: Number(row.handoverShare), fixShare: Number(row.fixShare), active: row.active,
  };
}

export const sortTiers = (tiers: TierConfig[]) => [...tiers].sort((a, b) => a.sort - b.sort || a.key.localeCompare(b.key));

// ── Closed deals ────────────────────────────────────────────────────────────

/**
 * Candidate claims for the closed-deal count: the given partners' ACTIVE claims on a not-trashed lead with
 * at least one closed deal earned inside the window. A live deal commits the claim (claimState.ts), so an
 * ACTIVE claim with such a deal is effectively ACTIVE; no protection check is needed.
 */
export function closedDealClaimsWhere(partnerIds: string[], now: Date): Prisma.PartnerClaimWhereInput {
  const ids = partnerIds.filter((id) => typeof id === "string" && id.trim() !== "");
  if (!ids.length) throw new Error("tier scope: partnerId required");
  const from = new Date(now.getTime() - TIER_WINDOW_DAYS * DAY);
  return {
    partnerId: ids.length === 1 ? ids[0] : { in: ids },
    state: "ACTIVE",
    lead: { deletedAt: null, deals: { some: { commissionStatus: { in: [...CLOSED_DEAL_STATUSES] }, earnedAt: { gte: from, lte: now } } } },
  };
}

export type ClaimWithDeals = {
  partnerId: string;
  createdAt: Date;
  reviewedAt: Date | null;
  lead: { deletedAt: Date | null; deals: { id: string; commissionStatus: string; earnedAt: Date | null; createdAt: Date }[] } | null;
};

/**
 * Closed deals of the last 12 months per partner. A deal counts for the partner whose claim was active when
 * the deal was created (createdAt ≥ activeSince, the same rule as the partner's own deal view); each deal
 * once per partner. Partners without any appear with 0 when listed in `partnerIds`.
 */
export function closedDealsByPartner(claims: ClaimWithDeals[], now: Date, partnerIds: string[] = []): Map<string, number> {
  const deals = new Map<string, Map<string, { commissionStatus: string; earnedAt: Date | null }>>();
  for (const id of partnerIds) deals.set(id, new Map());
  for (const c of claims) {
    if (!c.lead || c.lead.deletedAt) continue;
    const since = activeSince(c).getTime();
    const own = deals.get(c.partnerId) ?? new Map();
    deals.set(c.partnerId, own);
    for (const d of c.lead.deals) if (d.createdAt.getTime() >= since) own.set(d.id, d);
  }
  return new Map(Array.from(deals, ([id, m]) => [id, closedDealsLast12Months(Array.from(m.values()), now)]));
}

// ── Proposals ───────────────────────────────────────────────────────────────

export type ProposalDecision = "ACCEPTED" | "DECLINED";

export type ProposalCheck = { ok: true; tier: TierConfig } | { skip: "no upgrade" | "open proposal" | "declined" };

/**
 * Whether the cron may open a proposal: an upgrade exists (proposeTier), no proposal is open, and the latest
 * decided proposal is not a decline at the same or a higher closed-deal count (after a decline the next
 * proposal needs more closed deals than that decline had).
 */
export function proposalEligibility(input: {
  proposed: TierConfig | null;
  openProposal: boolean;
  lastDecided: { decision: string | null; closedDeals: number } | null;
  closedDeals: number;
}): ProposalCheck {
  if (!input.proposed) return { skip: "no upgrade" };
  if (input.openProposal) return { skip: "open proposal" };
  const last = input.lastDecided;
  if (last && last.decision === "DECLINED" && last.closedDeals >= input.closedDeals) return { skip: "declined" };
  return { ok: true, tier: input.proposed };
}

export type Shares = { handoverShare: number; fixShare: number };

/**
 * What Accept writes on the partner: the tier and shares (new deals only; existing deals keep their share).
 * Accept never lowers a share: each one is max(the partner's current share, the tier's share), so an
 * individually agreed higher share survives the upgrade. The tier must still exist and be active, and must
 * rank above the partner's current tier (a manual change since the proposal may have made it stale;
 * accepting must never be a downgrade).
 */
export function tierAcceptData(
  tier: TierConfig | null,
  now: Date,
  current: TierConfig | null = null,
  shares: Shares | null = null,
): { error: string } | { data: { tierKey: string; tierSince: Date; handoverShare: number; fixShare: number } } {
  if (!tier) return { error: "The proposed tier no longer exists." };
  if (!tier.active) return { error: `The tier "${tier.name}" is inactive. Activate it or decline the proposal.` };
  if (current && current.sort >= tier.sort) return { error: `The partner is already ${current.name}. Decline this proposal.` };
  const handoverShare = shares ? Math.max(shares.handoverShare, tier.handoverShare) : tier.handoverShare;
  const fixShare = shares ? Math.max(shares.fixShare, tier.fixShare) : tier.fixShare;
  return { data: { tierKey: tier.key, tierSince: now, handoverShare, fixShare } };
}

export const tierUpRefKey = (proposalId: string) => `tierup:${proposalId}`;
/** TIER_UP refKey of a manual upgrade in the CRM (one per partner and moment). */
export const tierUpManualRefKey = (partnerId: string, now: Date) => `tierup:manual:${partnerId}:${now.toISOString()}`;

export type TierUpPayload = { tierKey: string; tierName: string; handoverShare: number; fixShare: number };

/** The TIER_UP payload: the tier and the shares the partner actually has after the change (default: the tier's). */
export const tierUpPayload = (tier: TierConfig, shares: Shares = tier): TierUpPayload => ({
  tierKey: tier.key, tierName: tier.name, handoverShare: shares.handoverShare, fixShare: shares.fixShare,
});

export type ManualTierChange =
  | { error: string }
  | { unchanged: true }
  | {
      data: { tierKey: string | null; tierSince?: Date | null; handoverShare?: number; fixShare?: number };
      /** Compared on the effective tier (unset = lowest active). Only "up" queues a TIER_UP notice. */
      direction: "up" | "down" | "same";
      tier: TierConfig | null;
    };

/**
 * A manager sets the tier by hand (CRM partners list). A chosen tier must exist and be active; the partner
 * then gets exactly the tier's shares (an explicit operator choice, so it may lower them) and tierSince =
 * now (kept when the tier itself does not change). "None" (null) clears tierKey and tierSince and leaves the
 * shares alone. Unchanged when nothing would change.
 */
export function manualTierChange(input: {
  currentKey: string | null;
  targetKey: string | null;
  shares: Shares;
  tiers: TierConfig[];
  now: Date;
}): ManualTierChange {
  const { currentKey, targetKey, shares, tiers, now } = input;
  const before = currentTier(currentKey, tiers);
  if (targetKey == null) {
    if (currentKey == null) return { unchanged: true };
    const after = currentTier(null, tiers);
    const direction = before && after && after.sort > before.sort ? "up" : before && after && after.sort === before.sort ? "same" : "down";
    return { data: { tierKey: null, tierSince: null }, direction, tier: null };
  }
  const tier = tiers.find((t) => t.key === targetKey) ?? null;
  if (!tier) return { error: "This tier does not exist." };
  if (!tier.active) return { error: `The tier "${tier.name}" is inactive.` };
  const sameKey = currentKey === tier.key;
  if (sameKey && shares.handoverShare === tier.handoverShare && shares.fixShare === tier.fixShare) return { unchanged: true };
  const direction = !before || tier.sort > before.sort ? "up" : tier.sort === before.sort ? "same" : "down";
  return {
    data: { tierKey: tier.key, ...(sameKey ? {} : { tierSince: now }), handoverShare: tier.handoverShare, fixShare: tier.fixShare },
    direction: sameKey ? "same" : direction,
    tier,
  };
}

/**
 * The portal tier card's progress line (null at the top tier). With an open proposal, or once the next
 * threshold is reached (remaining 0), it says the upgrade is being reviewed; otherwise "n more closed
 * deals" in the locale's plural form (Intl.PluralRules: EN/DE one/other, PL/RU one/few/many).
 */
export function tierProgressLine(T: PartnerDict["tiers"], locale: PartnerLocale, progress: TierProgress, reviewing: boolean): string | null {
  const next = progress.next;
  if (!next) return null;
  if (reviewing || progress.remaining <= 0) return fmt(T.reviewing, { tier: next.name });
  const cat = new Intl.PluralRules(locale).select(progress.remaining) as keyof PartnerDict["tiers"]["progress"];
  const template = T.progress[cat] ?? T.progress.other;
  return fmt(template, { n: progress.remaining, tier: next.name });
}

const share = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100 ? v : null);

/** The sender's view of a TIER_UP payload; null when anything is missing or out of range. */
export function parseTierUpPayload(payload: unknown): TierUpPayload | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const p = payload as Record<string, unknown>;
  const tierName = typeof p.tierName === "string" ? p.tierName.trim().slice(0, 40) : "";
  const tierKey = typeof p.tierKey === "string" ? p.tierKey : "";
  const handoverShare = share(p.handoverShare);
  const fixShare = share(p.fixShare);
  if (!tierName || !tierKey || handoverShare == null || fixShare == null) return null;
  return { tierKey, tierName, handoverShare, fixShare };
}

// ── Display ─────────────────────────────────────────────────────────────────

/** CRM badge text: the stored tier's name; no tier → "<lowest active tier> (default)"; an unknown key as is. */
export function tierLabel(tierKey: string | null, tiers: TierConfig[]): string {
  if (tierKey) return tiers.find((t) => t.key === tierKey)?.name ?? tierKey;
  const lowest = sortTiers(tiers).find((t) => t.active);
  return `${lowest?.name ?? "Silver"} (default)`;
}

// ── CRM settings form ───────────────────────────────────────────────────────

export type TierEdit = { key: string; name: string; minClosedDeals: number; handoverShare: number; fixShare: number; active: boolean };

const SHARE_RE = /^\d{1,3}(?:[.,]\d{1,2})?$/;
const INT_RE = /^\d{1,4}$/;

function num(v: unknown, re: RegExp): number | null {
  if (typeof v === "number") return Number.isFinite(v) && re.test(String(v)) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  return re.test(s) ? Number(s.replace(",", ".")) : null;
}

/**
 * Parses the settings card's rows (strings from inputs, decimal comma allowed, shares with at most two
 * decimals as stored). English messages; the full validation (thresholds, at least one active tier) is
 * validateTierConfig after merging with the stored sort order.
 */
export function parseTierEdits(raw: unknown): { ok: true; rows: TierEdit[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) return { error: "No tiers submitted." };
  const rows: TierEdit[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") return { error: "Invalid tier row." };
    const o = r as Record<string, unknown>;
    const key = typeof o.key === "string" ? o.key : "";
    if (!key) return { error: "Invalid tier row." };
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const label = name || key;
    const minClosedDeals = num(o.minClosedDeals, INT_RE);
    if (minClosedDeals == null) return { error: `Tier "${label}": the threshold must be a whole number of 0 or more.` };
    const handoverShare = num(o.handoverShare, SHARE_RE);
    if (handoverShare == null) return { error: `Tier "${label}": the handover share must be a number between 0 and 100 (two decimals at most).` };
    const fixShare = num(o.fixShare, SHARE_RE);
    if (fixShare == null) return { error: `Tier "${label}": the fix share must be a number between 0 and 100 (two decimals at most).` };
    rows.push({ key, name, minClosedDeals, handoverShare, fixShare, active: o.active === true });
  }
  return { ok: true, rows };
}

/** Applies the edits onto the stored tiers (sort order stays stored). Every stored tier must be submitted exactly once. */
export function mergeTierEdits(current: TierConfig[], edits: TierEdit[]): { ok: true; rows: TierConfig[] } | { error: string } {
  const byKey = new Map(edits.map((e) => [e.key, e]));
  if (byKey.size !== edits.length || edits.length !== current.length || current.some((t) => !byKey.has(t.key))) {
    return { error: "The tier list has changed. Reload the page and try again." };
  }
  return { ok: true, rows: current.map((t) => ({ ...t, ...byKey.get(t.key)!, key: t.key, sort: t.sort })) };
}

const FIELDS = ["name", "minClosedDeals", "handoverShare", "fixShare", "active"] as const;

/** Changed tiers only, as audit before/after keyed by tier key. */
export function tierConfigDiff(before: TierConfig[], after: TierConfig[]) {
  const b: Record<string, Partial<TierConfig>> = {};
  const a: Record<string, Partial<TierConfig>> = {};
  const changed: TierConfig[] = [];
  for (const t of after) {
    const old = before.find((x) => x.key === t.key);
    if (!old) continue;
    const keys = FIELDS.filter((k) => old[k] !== t[k]);
    if (!keys.length) continue;
    changed.push(t);
    b[t.key] = Object.fromEntries(keys.map((k) => [k, old[k]]));
    a[t.key] = Object.fromEntries(keys.map((k) => [k, t[k]]));
  }
  return { changed, before: b, after: a };
}

// ── Cron ────────────────────────────────────────────────────────────────────

export function tiersStartFromEnv(env: Record<string, string | undefined>): Date | null {
  const s = env.PARTNER_TIERS_START?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : new Date(ms);
}

export type NewProposal = { partnerName: string; company: string | null; fromLabel: string; toName: string; closedDeals: number };

const TELEGRAM_LIST_MAX = 30;

/** One English office Telegram (HTML, every value escaped) listing the new proposals, with the CRM link. */
export function tierProposalTelegram(items: NewProposal[], crmPartnersUrl: string): string {
  const lines = items.slice(0, TELEGRAM_LIST_MAX).map((p) => {
    const who = p.company ? `${escapeHtml(p.partnerName)} (${escapeHtml(p.company)})` : escapeHtml(p.partnerName);
    return `• ${who}: ${escapeHtml(p.fromLabel)} → <b>${escapeHtml(p.toName)}</b>, ${p.closedDeals} closed deal${p.closedDeals === 1 ? "" : "s"} in 12 months`;
  });
  if (items.length > TELEGRAM_LIST_MAX) lines.push(`…and ${items.length - TELEGRAM_LIST_MAX} more`);
  const head = `<b>Partner tier proposals: ${items.length} new</b>`;
  return `${head}\n\n${lines.join("\n")}\n\nReview: <a href="${escapeHtml(crmPartnersUrl)}">${escapeHtml(crmPartnersUrl)}</a>`;
}
