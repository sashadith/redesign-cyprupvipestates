// Partner notifications v2 — the daily partner-alerts run, DB side. Cron entry:
// src/app/api/cron/partner-alerts/route.ts. Pure planners: alerts.ts. Writes PartnerNotification rows only
// (refKey unique → a rerun never doubles them); the partner-notify sender delivers them by e-mail and/or
// Telegram and re-checks every row at send time (notifySend.ts).
import { prisma } from "@/lib/prisma";
import { inventoryChanges } from "@/lib/crm/inventoryChanges";
import { REAL_CONTACT_TYPES } from "./claims";
import { COMMITTED_LEAD_STATUSES, activeSince, effectiveClaimState, type ClaimStateValue } from "./claimState";
import { publicProjectUrl } from "./clientDto";
import { absoluteProjectUrl } from "./matchGlue";
import { projectRates } from "./scope";
import { closedDealCounts, loadTiers } from "./tierStore";
import { tierProgress } from "./tiers";
import {
  cyDate, planBankMissing, planProjectNews, planProtectionReminders, planQuietClients, planTierNear, planWatch, protectionEnd,
  type PlannedAlert, type WatchEvent,
} from "./alerts";

export { alertsStartFromEnv } from "./alerts";

const DAY = 86_400_000;
const PARTNER_CAP = 2000;
const CLAIM_CAP = 5000;
const DEAL_CAP = 2000;
const CHANGE_CAP = 500;
/** Lead statuses that are not "waiting for news": parked, finished or committed. */
const NOT_QUIET_STATUSES = ["KEEP_CONTACT", "LOST", "CLOSED", "RESERVED"] as const;
const WATCH_TYPES = ["new_units", "price_from_changed", "unit_price_changed", "back_on_market", "availability_changed"] as const;

export type AlertsRunResult = {
  today: string;
  partners: number;
  planned: Record<string, number>;
  inserted: number;
  errors: string[];
};

/** Advisory-lock key of the partner-alerts run ("PALR"). */
const ALERTS_LOCK_KEY = 0x50414c52;
const LOCK_HOLD_MS = 15 * 60_000;

/** Runs fn while holding the partner-alerts advisory lock (same pinned-transaction pattern as withMatchLock); null when taken. */
export async function withAlertsLock<T>(fn: () => Promise<T>): Promise<T | null> {
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${ALERTS_LOCK_KEY}::bigint) AS locked`;
      if (!rows[0]?.locked) return null;
      return fn();
    },
    { maxWait: 10_000, timeout: LOCK_HOLD_MS },
  );
}

const latest = (...ds: (Date | null | undefined)[]): Date | null =>
  ds.reduce<Date | null>((m, d) => (d && (!m || d > m) ? d : m), null);

/**
 * Last activity on a client: the claim becoming active, a status change, a real contact or a portal message
 * (either direction). Shared by the planner (batch) and the sender's re-check (one lead).
 */
export async function lastClientActivity(leadId: string, since: Date): Promise<Date> {
  const [status, contact, msg] = await Promise.all([
    prisma.leadInteraction.aggregate({ where: { leadId, type: "STATUS_CHANGE" }, _max: { occurredAt: true } }),
    prisma.leadInteraction.aggregate({ where: { leadId, type: { in: [...REAL_CONTACT_TYPES] } }, _max: { occurredAt: true } }),
    prisma.partnerMessage.aggregate({ where: { leadId }, _max: { createdAt: true } }),
  ]);
  return latest(since, status._max.occurredAt, contact._max.occurredAt, msg._max.createdAt) ?? since;
}

type OpenClaim = {
  claimId: string; partnerId: string; leadId: string; leadStatus: string; activeSince: Date;
  lastContactAt: Date | null; lastStatusAt: Date | null; lastMessageAt: Date | null;
};

/** Effectively ACTIVE, uncommitted claims of reminder-enabled ACTIVE partners, with the lead's activity dates (batch). */
async function loadOpenClaims(now: Date, partnerIds: string[]): Promise<OpenClaim[]> {
  if (!partnerIds.length) return [];
  const rows = await prisma.partnerClaim.findMany({
    where: { state: "ACTIVE", partnerId: { in: partnerIds }, lead: { deletedAt: null } },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: CLAIM_CAP,
    select: { id: true, partnerId: true, leadId: true, state: true, createdAt: true, reviewedAt: true, lead: { select: { status: true, deletedAt: true } } },
  });
  if (!rows.length) return [];
  const leadIds = Array.from(new Set(rows.map((r) => r.leadId)));
  const [liveDeals, contacts, statuses, messages] = await Promise.all([
    prisma.deal.groupBy({ by: ["leadId"], where: { leadId: { in: leadIds }, commissionStatus: { not: "CANCELLED" } }, _count: { _all: true } }),
    prisma.leadInteraction.groupBy({ by: ["leadId"], where: { leadId: { in: leadIds }, type: { in: [...REAL_CONTACT_TYPES] } }, _max: { occurredAt: true } }),
    prisma.leadInteraction.groupBy({ by: ["leadId"], where: { leadId: { in: leadIds }, type: "STATUS_CHANGE" }, _max: { occurredAt: true } }),
    prisma.partnerMessage.groupBy({ by: ["leadId"], where: { leadId: { in: leadIds } }, _max: { createdAt: true } }),
  ]);
  const live = new Set(liveDeals.map((d) => d.leadId));
  const contactAt = new Map(contacts.map((c) => [c.leadId, c._max.occurredAt ?? null]));
  const statusAt = new Map(statuses.map((c) => [c.leadId, c._max.occurredAt ?? null]));
  const messageAt = new Map(messages.map((c) => [c.leadId, c._max.createdAt ?? null]));
  return rows.flatMap((r) => {
    if (live.has(r.leadId) || (COMMITTED_LEAD_STATUSES as readonly string[]).includes(r.lead.status)) return [];
    const since = activeSince(r);
    const lastContactAt = contactAt.get(r.leadId) ?? null;
    const state = effectiveClaimState({
      state: r.state as ClaimStateValue, activeSince: since, lastRealContactAt: lastContactAt, now,
      leadDeleted: !!r.lead.deletedAt, leadStatus: r.lead.status, hasLiveDeal: false,
    });
    if (state !== "ACTIVE") return [];
    return [{
      claimId: r.id, partnerId: r.partnerId, leadId: r.leadId, leadStatus: r.lead.status, activeSince: since,
      lastContactAt, lastStatusAt: statusAt.get(r.leadId) ?? null, lastMessageAt: messageAt.get(r.leadId) ?? null,
    }];
  });
}

/**
 * One run: plans today's (Cyprus date) v2 rows for every ACTIVE partner and writes them to the outbox.
 * Nothing before `start` (PARTNER_ALERTS_START). Profile switches are applied here (no row for a partner
 * who switched the kind off) and again at send time.
 */
export async function runPartnerAlerts(now: Date, start: Date): Promise<AlertsRunResult> {
  const today = cyDate(now);
  const result: AlertsRunResult = { today, partners: 0, planned: {}, inserted: 0, errors: [] };
  if (now.getTime() < start.getTime()) return result;

  const partners = await prisma.partner.findMany({
    where: { status: "ACTIVE", createdAt: { lt: now } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: PARTNER_CAP,
    select: { id: true, handoverShare: true, fixShare: true, marketAlerts: true, reminders: true, tierKey: true, bankDetailsEnc: true },
  });
  result.partners = partners.length;
  if (!partners.length) return result;
  const market = partners.filter((p) => p.marketAlerts);
  const reminded = partners.filter((p) => p.reminders);
  const planned: PlannedAlert[] = [];
  const step = async (name: string, fn: () => Promise<PlannedAlert[]>) => {
    try {
      const rows = await fn();
      result.planned[name] = rows.length;
      planned.push(...rows);
    } catch (e) {
      result.errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 500));
    }
  };

  // 1 — projects published in the last 24 h, with each partner's own rate.
  await step("news", async () => {
    if (!market.length) return [];
    const devs = await prisma.development.findMany({
      where: { publishStatus: "published", slug: { not: null }, publishedAt: { gte: new Date(now.getTime() - DAY), lte: now } },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      take: 20,
      select: {
        id: true, publicName: true, slug: true, area: true, town: true, priceFrom: true, publishedAt: true, developerAccountId: true,
        override: { select: { alias: true, area: true, town: true } },
      },
    });
    if (!devs.length) return [];
    const rates = (await prisma.commissionRate.findMany({
      where: { developerAccountId: { in: Array.from(new Set(devs.map((d) => d.developerAccountId))) } },
      select: { developerAccountId: true, developmentId: true, ratePercent: true },
    })).map((r) => ({ developerAccountId: r.developerAccountId, developmentId: r.developmentId, ratePercent: Number(r.ratePercent) }));
    const rows = devs.map((d) => ({
      id: d.id, name: d.override?.alias?.trim() || d.publicName, town: d.override?.town?.trim() || d.town || null, slug: d.slug,
      developerAccountId: d.developerAccountId,
    }));
    const projects = devs.flatMap((d) => {
      const url = publicProjectUrl("en", d.slug);
      return url ? [{
        id: d.id, name: d.override?.alias?.trim() || d.publicName, area: d.override?.area?.trim() || d.area || d.override?.town?.trim() || d.town || null,
        priceFrom: d.priceFrom, url, publishedAt: d.publishedAt ?? now,
      }] : [];
    });
    return planProjectNews({
      partners: market.map((p) => ({
        id: p.id,
        rates: new Map(projectRates(rows, rates, { handoverShare: Number(p.handoverShare), fixShare: Number(p.fixShare), trustMode: false })
          .map((r) => [r.id, r.handoverRate])),
      })),
      projects,
      today,
    });
  });

  // 2+3 — changes on developments in the partner's own active presentations.
  await step("watch", async () => {
    if (!market.length) return [];
    const items = await prisma.clientPresentationItem.findMany({
      where: {
        presentation: {
          partnerId: { in: market.map((p) => p.id) }, status: "active",
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          lead: { deletedAt: null },
        },
      },
      take: 20_000,
      select: { developmentId: true, presentation: { select: { partnerId: true } } },
    });
    const watched = new Map<string, Set<string>>();
    for (const it of items) {
      const pid = it.presentation.partnerId;
      if (!pid) continue;
      const set = watched.get(pid) ?? new Set<string>();
      set.add(it.developmentId);
      watched.set(pid, set);
    }
    const devIds = Array.from(new Set(items.map((i) => i.developmentId)));
    if (!devIds.length) return [];
    const [changes, devs] = await Promise.all([
      inventoryChanges({ days: 1, now, developmentIds: devIds, types: [...WATCH_TYPES], limit: CHANGE_CAP }),
      prisma.development.findMany({ where: { id: { in: devIds } }, select: { id: true, priceFrom: true } }),
    ]);
    const events: WatchEvent[] = changes.events.map((e) => ({ ...e, url: absoluteProjectUrl(e.publicUrl) }));
    return planWatch({ watched, events, priceFrom: new Map(devs.map((d) => [d.id, d.priceFrom])), today });
  });

  // 4+5 — reminders on open claims.
  const open = await loadOpenClaims(now, reminded.map((p) => p.id)).catch((e) => {
    result.errors.push(`claims: ${e instanceof Error ? e.message : String(e)}`.slice(0, 500));
    return [] as OpenClaim[];
  });
  await step("protection", async () =>
    planProtectionReminders({
      claims: open.map((c) => ({ claimId: c.claimId, partnerId: c.partnerId, leadId: c.leadId, protectedUntil: protectionEnd(c.activeSince, c.lastContactAt) })),
      now,
    }));
  await step("quiet", async () =>
    planQuietClients({
      claims: open
        .filter((c) => !(NOT_QUIET_STATUSES as readonly string[]).includes(c.leadStatus))
        .map((c) => ({
          claimId: c.claimId, partnerId: c.partnerId, leadId: c.leadId,
          lastActivityAt: latest(c.activeSince, c.lastContactAt, c.lastStatusAt, c.lastMessageAt) ?? c.activeSince,
        })),
      now,
    }));

  // 8 — live deals of partners without bank details.
  await step("bank", async () => {
    const noBank = partners.filter((p) => !p.bankDetailsEnc).map((p) => p.id);
    if (!noBank.length) return [];
    const claims = await prisma.partnerClaim.findMany({
      where: { state: "ACTIVE", partnerId: { in: noBank }, lead: { deletedAt: null } },
      take: CLAIM_CAP,
      select: { id: true, partnerId: true, leadId: true },
    });
    if (!claims.length) return [];
    const claimByLead = new Map(claims.map((c) => [c.leadId, c]));
    const deals = await prisma.deal.findMany({
      where: { leadId: { in: Array.from(claimByLead.keys()) }, commissionStatus: { in: ["EXPECTED", "EARNED", "DEVELOPER_PAID"] }, partnerCommission: { gt: 0 } },
      take: DEAL_CAP,
      select: { id: true, leadId: true, commissionStatus: true, developerPaidAt: true },
    });
    return planBankMissing({
      deals: deals.flatMap((d) => {
        const c = claimByLead.get(d.leadId);
        return c ? [{
          dealId: d.id, partnerId: c.partnerId, leadId: d.leadId, claimId: c.id,
          developerPaid: d.commissionStatus === "DEVELOPER_PAID" || !!d.developerPaidAt,
        }] : [];
      }),
    });
  });

  // 10 — one closed deal to the next tier.
  await step("tier", async () => {
    const [tiers, counts] = await Promise.all([loadTiers(), closedDealCounts(partners.map((p) => p.id), now)]);
    if (!tiers.some((t) => t.active)) return [];
    return planTierNear({
      partners: partners.map((p) => {
        const prog = tierProgress(p.tierKey, counts.get(p.id) ?? 0, tiers);
        return {
          id: p.id,
          next: prog.next && prog.remaining === 1
            ? { key: prog.next.key, name: prog.next.name, handoverShare: prog.next.handoverShare, fixShare: prog.next.fixShare }
            : null,
        };
      }),
    });
  });

  if (planned.length) {
    try {
      const r = await prisma.partnerNotification.createMany({
        data: planned.map((a) => ({
          kind: a.kind, refKey: a.refKey, partnerId: a.partnerId, leadId: a.leadId, claimId: a.claimId,
          payload: a.payload as object,
        })),
        skipDuplicates: true,
      });
      result.inserted = r.count;
    } catch (e) {
      result.errors.push(`insert: ${e instanceof Error ? e.message : String(e)}`.slice(0, 500));
    }
  }
  return result;
}
