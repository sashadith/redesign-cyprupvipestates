// Rating seasons — DB side (partner portal phase 4b, Task 4): seasons, the per-season ranking aggregate
// (one groupBy per season), the partner-scoped portal view, and the daily points run.
// Pure parts: ratingFlow.ts / rating.ts. Cron entry: src/app/api/cron/partner-points.
import type { RatingSeason } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { REAL_CONTACT_TYPES } from "./claims";
import { activeSince, COMMITTED_LEAD_STATUSES, effectiveClaimState, type ClaimStateValue } from "./claimState";
import { truncateError } from "./notify";
import {
  crmRanking, currentSeason, pastSeasons, pointRulesFromJson, pointsRunSeasonWhere, portalRanking, prizesFromJson, seasonTotals,
  statusChangesByLead, type CrmRankingRow, type KindAggregate, type PartnerSeasonTotal, type PortalRanking,
} from "./ratingFlow";
import { pointEventsFor, type ClaimPointFacts, type PointRules, type SeasonPrizes } from "./rating";

export type SeasonRow = { id: string; name: string; startsAt: Date; endsAt: Date; pointRules: PointRules; prizes: SeasonPrizes };

const toSeason = (s: Pick<RatingSeason, "id" | "name" | "startsAt" | "endsAt" | "pointRules" | "prizes">): SeasonRow => ({
  id: s.id, name: s.name, startsAt: s.startsAt, endsAt: s.endsAt, pointRules: pointRulesFromJson(s.pointRules), prizes: prizesFromJson(s.prizes),
});
const SEASON_SELECT = { id: true, name: true, startsAt: true, endsAt: true, pointRules: true, prizes: true } as const;
export const SEASONS_LIST_CAP = 200;

/** Every season (latest start first, capped). */
export async function loadSeasons(): Promise<SeasonRow[]> {
  const rows = await prisma.ratingSeason.findMany({ orderBy: [{ startsAt: "desc" }, { id: "asc" }], take: SEASONS_LIST_CAP, select: SEASON_SELECT });
  return rows.map(toSeason);
}

/** One aggregate query: per (partner, kind) the sum of points and the latest point time of a season. */
async function seasonAggregate(seasonId: string): Promise<PartnerSeasonTotal[]> {
  const rows = await prisma.partnerPointEvent.groupBy({
    by: ["partnerId", "kind"],
    where: { seasonId },
    _sum: { points: true },
    _max: { createdAt: true },
  });
  const agg: KindAggregate[] = rows.map((r) => ({ partnerId: r.partnerId, kind: r.kind, points: r._sum.points ?? 0, lastAt: r._max.createdAt ?? null }));
  return seasonTotals(agg);
}

/** The CRM's full ranking of a season, with names (all partner statuses). Managers only — the caller guards. */
export async function crmSeasonRanking(seasonId: string): Promise<CrmRankingRow[]> {
  const totals = await seasonAggregate(seasonId);
  if (!totals.length) return [];
  const partners = await prisma.partner.findMany({
    where: { id: { in: totals.map((t) => t.partnerId) } },
    select: { id: true, status: true, country: true, firstName: true, lastName: true, company: true },
  });
  return crmRanking(totals, partners);
}

/** Season totals + only the status and country of the partners in it (never names) — for the portal. */
async function portalSeasonRanking(seasonId: string, meId: string, meCountry: string, top?: number): Promise<PortalRanking> {
  const totals = await seasonAggregate(seasonId);
  const partners = totals.length
    ? await prisma.partner.findMany({ where: { id: { in: totals.map((t) => t.partnerId) } }, select: { id: true, status: true, country: true } })
    : [];
  return portalRanking({ seasonId, meId, meCountry, totals, partners, top });
}

export type MyRatingView = {
  current: (SeasonRow & { ranking: PortalRanking }) | null;
  past: { id: string; name: string; startsAt: Date; endsAt: Date; rank: number | null; points: number; total: number }[];
};

/** The partner's /rating page: the current season with the anonymised ranking, and the last ended seasons. */
export async function myRatingView(partnerId: string, now: Date = new Date()): Promise<MyRatingView> {
  if (typeof partnerId !== "string" || !partnerId.trim()) throw new Error("rating scope: partnerId required");
  const [me, seasonRows] = await Promise.all([
    prisma.partner.findUnique({ where: { id: partnerId }, select: { country: true } }),
    prisma.ratingSeason.findMany({
      where: { startsAt: { lte: now } },
      orderBy: [{ endsAt: "desc" }, { id: "asc" }],
      take: 50,
      select: SEASON_SELECT,
    }),
  ]);
  const seasons = seasonRows.map(toSeason);
  const meCountry = me?.country ?? "";
  const cur = currentSeason(seasons, now);
  const past = pastSeasons(seasons, now);
  const [ranking, pastRankings] = await Promise.all([
    cur ? portalSeasonRanking(cur.id, partnerId, meCountry) : Promise.resolve(null),
    Promise.all(past.map((s) => portalSeasonRanking(s.id, partnerId, meCountry, 0))),
  ]);
  return {
    current: cur && ranking ? { ...cur, ranking } : null,
    past: past.map((s, i) => ({
      id: s.id, name: s.name, startsAt: s.startsAt, endsAt: s.endsAt,
      rank: pastRankings[i].myRank, points: pastRankings[i].myPoints, total: pastRankings[i].total,
    })),
  };
}

// ── Daily points run ────────────────────────────────────────────────────────

/** Advisory-lock key of the partner-points run ("PPTS"). */
const POINTS_LOCK_KEY = 0x50505453;
const LOCK_HOLD_MS = 10 * 60_000;
export const POINTS_CLAIM_CAP = 5000;
const ID_CHUNK = 1000;

/** Runs fn while holding the partner-points advisory lock (pinned-transaction pattern of withTiersLock); null when taken. */
export async function withPointsLock<T>(fn: () => Promise<T>): Promise<T | null> {
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${POINTS_LOCK_KEY}::bigint) AS locked`;
      if (!rows[0]?.locked) return null;
      return fn();
    },
    { maxWait: 10_000, timeout: LOCK_HOLD_MS },
  );
}

const chunk = <T,>(xs: T[], n: number): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

export type PointsSeasonResult = { seasonId: string; claims: number; truncated: boolean; events: number; inserted: number };
export type PointsRunResult = { seasons: PointsSeasonResult[]; skipped: string | null; errors: string[] };

/**
 * The claims that may earn points in a season: ACTIVE, created by the season end, on a lead that is not
 * trashed, and effectively ACTIVE now (committed, or protection not run out) — capped, newest first.
 */
async function effectivelyActiveClaims(season: SeasonRow, now: Date) {
  const rows = await prisma.partnerClaim.findMany({
    where: { state: "ACTIVE", createdAt: { lte: season.endsAt }, lead: { deletedAt: null } },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: POINTS_CLAIM_CAP + 1,
    select: { id: true, partnerId: true, leadId: true, state: true, createdAt: true, reviewedAt: true, lead: { select: { status: true, deletedAt: true } } },
  });
  const truncated = rows.length > POINTS_CLAIM_CAP;
  const claims = truncated ? rows.slice(0, POINTS_CLAIM_CAP) : rows;
  if (!claims.length) return { claims, truncated };
  const leadIds = Array.from(new Set(claims.map((c) => c.leadId)));
  const live = new Set<string>();
  for (const part of chunk(leadIds, ID_CHUNK)) {
    const deals = await prisma.deal.groupBy({ by: ["leadId"], where: { leadId: { in: part }, commissionStatus: { not: "CANCELLED" } }, _count: { _all: true } });
    for (const d of deals) live.add(d.leadId);
  }
  const uncommitted = Array.from(new Set(
    claims.filter((c) => !live.has(c.leadId) && !(COMMITTED_LEAD_STATUSES as readonly string[]).includes(c.lead.status)).map((c) => c.leadId),
  ));
  const lastContact = new Map<string, Date | null>();
  for (const part of chunk(uncommitted, ID_CHUNK)) {
    const rows2 = await prisma.leadInteraction.groupBy({
      by: ["leadId"], where: { leadId: { in: part }, type: { in: [...REAL_CONTACT_TYPES] } }, _max: { occurredAt: true },
    });
    for (const r of rows2) lastContact.set(r.leadId, r._max.occurredAt ?? null);
  }
  const active = claims.filter(
    (c) =>
      effectiveClaimState({
        state: c.state as ClaimStateValue, activeSince: activeSince(c), lastRealContactAt: lastContact.get(c.leadId) ?? null, now,
        leadDeleted: !!c.lead.deletedAt, leadStatus: c.lead.status, hasLiveDeal: live.has(c.leadId),
      }) === "ACTIVE",
  );
  return { claims: active, truncated };
}

/** Points of one season: claim facts (activeSince, STATUS_CHANGE history up to the season end) → pointEventsFor → ledger. */
async function pointsForSeason(season: SeasonRow, now: Date): Promise<PointsSeasonResult> {
  const { claims, truncated } = await effectivelyActiveClaims(season, now);
  const result: PointsSeasonResult = { seasonId: season.id, claims: claims.length, truncated, events: 0, inserted: 0 };
  if (!claims.length) return result;

  // History only up to the season end, and never before the earliest activeSince (pointEventsFor gates per claim).
  // No lower bound at the season start: a milestone first reached before the season must not count on re-entry.
  const earliest = new Date(Math.min(...claims.map((c) => activeSince(c).getTime())));
  const leadIds = Array.from(new Set(claims.map((c) => c.leadId)));
  const history: { leadId: string; occurredAt: Date; metadata: unknown }[] = [];
  for (const part of chunk(leadIds, ID_CHUNK)) {
    history.push(...(await prisma.leadInteraction.findMany({
      where: { leadId: { in: part }, type: "STATUS_CHANGE", occurredAt: { gte: earliest, lte: season.endsAt } },
      select: { leadId: true, occurredAt: true, metadata: true },
    })));
  }
  const byLead = statusChangesByLead(history);
  const facts: ClaimPointFacts[] = claims.map((c) => {
    const since = activeSince(c);
    // The client counts as accepted when the claim became active (a reviewed known contact, or a new lead at submission).
    return { claimId: c.id, partnerId: c.partnerId, acceptedAt: since, activeSince: since, statusChanges: byLead.get(c.leadId) ?? [] };
  });
  const events = pointEventsFor(facts, season);
  result.events = events.length;
  for (const part of chunk(events, ID_CHUNK)) {
    const r = await prisma.partnerPointEvent.createMany({
      // createdAt = the event's own date: the ranking's tie-break ("who got there first") reads it.
      data: part.map((e) => ({ seasonId: e.seasonId, partnerId: e.partnerId, kind: e.kind, refKey: e.refKey, points: e.points, createdAt: e.at })),
      skipDuplicates: true,
    });
    result.inserted += r.count;
  }
  return result;
}

/** One run over every season started and not more than 3 days past its end; nothing before `start`. */
export async function runPointsRun(now: Date, start: Date): Promise<PointsRunResult> {
  const result: PointsRunResult = { seasons: [], skipped: null, errors: [] };
  if (now.getTime() < start.getTime()) {
    result.skipped = "before start";
    return result;
  }
  const seasons = (await prisma.ratingSeason.findMany({ where: pointsRunSeasonWhere(now), orderBy: [{ startsAt: "asc" }, { id: "asc" }], select: SEASON_SELECT })).map(toSeason);
  for (const s of seasons) {
    try {
      result.seasons.push(await pointsForSeason(s, now));
    } catch (e) {
      result.errors.push(`${s.id}: ${truncateError(e)}`);
    }
  }
  return result;
}
