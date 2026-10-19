// Partner tiers — DB side: tier config, closed-deal counts (batched), the portal tier status (partner-scoped)
// and the daily proposal run. Pure decisions: tierFlow.ts / tiers.ts. Cron entry: src/app/api/cron/partner-tiers.
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { truncateError } from "./notify";
import {
  closedDealClaimsWhere, closedDealsByPartner, proposalEligibility, tierFromRow, tierLabel, tierProposalTelegram, type NewProposal,
} from "./tierFlow";
import { proposeTier, tierProgress, type TierConfig, type TierProgress } from "./tiers";

type Db = Prisma.TransactionClient | PrismaClient;

const TIER_SELECT = { key: true, name: true, sort: true, minClosedDeals: true, handoverShare: true, fixShare: true, active: true } as const;

/** Every configured tier (active or not), lowest first. */
export async function loadTiers(db: Db = prisma): Promise<TierConfig[]> {
  const rows = await db.partnerTier.findMany({ orderBy: [{ sort: "asc" }, { key: "asc" }], select: TIER_SELECT });
  return rows.map(tierFromRow);
}

/** Closed deals of the last 12 months for each given partner (0 when none): one query for all of them. */
export async function closedDealCounts(partnerIds: string[], now: Date): Promise<Map<string, number>> {
  if (!partnerIds.length) return new Map();
  const claims = await prisma.partnerClaim.findMany({
    where: closedDealClaimsWhere(partnerIds, now),
    select: {
      partnerId: true, createdAt: true, reviewedAt: true,
      lead: { select: { deletedAt: true, deals: { select: { id: true, commissionStatus: true, earnedAt: true, createdAt: true } } } },
    },
  });
  return closedDealsByPartner(claims, now, partnerIds);
}

export type MyTierStatus = { progress: TierProgress; closedDeals: number; handoverShare: number; fixShare: number };

/**
 * The partner's own tier card: the tier (unset → lowest active), the partner's actual shares (an unset tier
 * keeps the individually agreed ones), closed deals and the progress to the next tier. Partner-scoped reads
 * only; null when no tier is configured.
 */
export async function myTierStatus(partnerId: string, now: Date = new Date()): Promise<MyTierStatus | null> {
  if (typeof partnerId !== "string" || !partnerId.trim()) throw new Error("tier scope: partnerId required");
  const [partner, tiers, counts] = await Promise.all([
    prisma.partner.findUnique({ where: { id: partnerId }, select: { tierKey: true, handoverShare: true, fixShare: true } }),
    loadTiers(),
    closedDealCounts([partnerId], now),
  ]);
  if (!partner || !tiers.some((t) => t.active)) return null;
  const closedDeals = counts.get(partnerId) ?? 0;
  return {
    progress: tierProgress(partner.tierKey, closedDeals, tiers),
    closedDeals,
    handoverShare: Number(partner.handoverShare),
    fixShare: Number(partner.fixShare),
  };
}

// ── Daily proposal run ──────────────────────────────────────────────────────

/** Advisory-lock key of the partner-tiers run ("PTIR"). */
const TIERS_LOCK_KEY = 0x50544952;
const LOCK_HOLD_MS = 10 * 60_000;
export const TIERS_PARTNER_CAP = 2000;

/** Runs fn while holding the partner-tiers advisory lock (same pinned-transaction pattern as withDigestLock); null when taken. */
export async function withTiersLock<T>(fn: () => Promise<T>): Promise<T | null> {
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${TIERS_LOCK_KEY}::bigint) AS locked`;
      if (!rows[0]?.locked) return null;
      return fn();
    },
    { maxWait: 10_000, timeout: LOCK_HOLD_MS },
  );
}

export type TiersRunResult = {
  partners: number;
  created: number;
  skipped: Record<string, number>;
  telegram: "sent" | "not configured" | "failed" | "none";
  errors: string[];
};

const isUniqueViolation = (e: unknown) => !!e && typeof e === "object" && (e as { code?: unknown }).code === "P2002";

/**
 * Opens a tier proposal for every ACTIVE partner (max TIERS_PARTNER_CAP) who reached a higher tier, unless
 * one is open or the latest decided proposal was declined at the same or a higher closed-deal count. A
 * concurrent insert (P2002 on the one-open-per-partner index) counts as "open proposal". Then one English
 * office Telegram lists the new proposals; a Telegram failure is logged, never fatal.
 */
export async function runTierProposals(now: Date, start: Date, crmBase: string): Promise<TiersRunResult> {
  const result: TiersRunResult = { partners: 0, created: 0, skipped: {}, telegram: "none", errors: [] };
  const skip = (reason: string) => (result.skipped[reason] = (result.skipped[reason] ?? 0) + 1);
  if (now.getTime() < start.getTime()) {
    skip("before start");
    return result;
  }
  const [partners, tiers] = await Promise.all([
    prisma.partner.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: TIERS_PARTNER_CAP,
      select: { id: true, firstName: true, lastName: true, company: true, tierKey: true },
    }),
    loadTiers(),
  ]);
  result.partners = partners.length;
  if (!partners.length || !tiers.some((t) => t.active)) return result;

  const counts = await closedDealCounts(partners.map((p) => p.id), now);
  const upgrades = partners.flatMap((p) => {
    const closedDeals = counts.get(p.id) ?? 0;
    const proposed = proposeTier(p.tierKey, closedDeals, tiers);
    if (!proposed) {
      skip("no upgrade");
      return [];
    }
    return [{ p, closedDeals, proposed }];
  });
  if (!upgrades.length) return result;

  const ids = upgrades.map((u) => u.p.id);
  const [open, decided] = await Promise.all([
    prisma.partnerTierProposal.findMany({ where: { partnerId: { in: ids }, decidedAt: null }, select: { partnerId: true } }),
    prisma.partnerTierProposal.findMany({
      where: { partnerId: { in: ids }, decidedAt: { not: null } },
      orderBy: [{ partnerId: "asc" }, { decidedAt: "desc" }],
      distinct: ["partnerId"],
      select: { partnerId: true, decision: true, closedDeals: true },
    }),
  ]);
  const openSet = new Set(open.map((o) => o.partnerId));
  const lastDecided = new Map(decided.map((d) => [d.partnerId, d]));

  const created: NewProposal[] = [];
  for (const u of upgrades) {
    const check = proposalEligibility({
      proposed: u.proposed, openProposal: openSet.has(u.p.id), lastDecided: lastDecided.get(u.p.id) ?? null, closedDeals: u.closedDeals,
    });
    if ("skip" in check) {
      skip(check.skip);
      continue;
    }
    try {
      await prisma.partnerTierProposal.create({
        data: { partnerId: u.p.id, fromTier: u.p.tierKey, toTier: check.tier.key, closedDeals: u.closedDeals },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        skip("open proposal");
        continue;
      }
      result.errors.push(`${u.p.id}: ${truncateError(e)}`);
      continue;
    }
    result.created++;
    created.push({
      partnerName: `${u.p.firstName} ${u.p.lastName}`.trim(), company: u.p.company,
      fromLabel: tierLabel(u.p.tierKey, tiers), toName: check.tier.name, closedDeals: u.closedDeals,
    });
  }

  if (created.length) {
    try {
      const sent = await sendTelegramMessage(tierProposalTelegram(created, `${crmBase.replace(/\/+$/, "")}/crm/partners`));
      result.telegram = sent ? "sent" : "not configured";
    } catch (e) {
      result.telegram = "failed";
      result.errors.push(`office telegram: ${truncateError(e)}`);
    }
  }
  return result;
}
