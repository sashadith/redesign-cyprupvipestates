// Partner notifications v2 — the daily partner-alerts run, DB side. Cron entry:
// src/app/api/cron/partner-alerts/route.ts. Pure planners: alerts.ts. Writes PartnerNotification rows only
// (refKey unique → a rerun never doubles them); the partner-notify sender delivers them by e-mail and/or
// Telegram and re-checks every row at send time (notifySend.ts).
import { prisma } from "@/lib/prisma";
import { inventoryChanges } from "@/lib/crm/inventoryChanges";
import { REAL_CONTACT_TYPES } from "./claims";
import { COMMITTED_LEAD_STATUSES, activeSince, effectiveClaimState, type ClaimStateValue } from "./claimState";
import { publicProjectUrl } from "./clientDto";
import { MATCH_EXCLUDED_LEAD_STATUSES, absoluteProjectUrl, claimProjectIds, submittedName } from "./matchGlue";
import { bedPrices, clientFits, newsPlace, shortBlurb, type NewsClient } from "./newsFacts";
import { PARTNER_LOCALES, type PartnerLocale } from "./i18n";
import { resolveDevelopmentPrice, resolveDevelopmentType } from "@/lib/developmentCard";
import { projectRates } from "./scope";
import { closedDealCounts, loadTiers } from "./tierStore";
import { tierProgress } from "./tiers";
import {
  NEWS_MAX_PROJECTS, cyDate, planBankMissing, planProjectNews, planProtectionReminders, planQuietClients, planTierNear, planWatch, protectionEnd,
  type NewsBlurbs, type PlannedAlert, type WatchEvent,
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
 * Clients a new project can be matched against, per partner: effectively ACTIVE claims whose lead is neither
 * closed nor lost, with the name the partner submitted, the lead's budget/type/saved search and the districts
 * of the projects chosen at submission.
 */
async function loadNewsClients(now: Date, partnerIds: string[]): Promise<Map<string, NewsClient[]>> {
  const out = new Map<string, NewsClient[]>();
  if (!partnerIds.length) return out;
  const rows = await prisma.partnerClaim.findMany({
    where: {
      state: "ACTIVE", partnerId: { in: partnerIds },
      lead: { deletedAt: null, status: { notIn: [...MATCH_EXCLUDED_LEAD_STATUSES] } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: CLAIM_CAP,
    select: {
      id: true, partnerId: true, leadId: true, state: true, createdAt: true, reviewedAt: true, submission: true,
      lead: { select: { status: true, deletedAt: true, budgetMin: true, budgetMax: true, propertyTypeInterest: true, lastMatchFilters: true } },
    },
  });
  if (!rows.length) return out;
  const leadIds = Array.from(new Set(rows.map((r) => r.leadId)));
  const contacts = await prisma.leadInteraction.groupBy({
    by: ["leadId"], where: { leadId: { in: leadIds }, type: { in: [...REAL_CONTACT_TYPES] } }, _max: { occurredAt: true },
  });
  const contactAt = new Map(contacts.map((c) => [c.leadId, c._max.occurredAt ?? null]));
  const chosenIds = Array.from(new Set(rows.flatMap((r) => claimProjectIds(r.submission))));
  const chosen = chosenIds.length
    ? await prisma.development.findMany({
        where: { id: { in: chosenIds } },
        select: { id: true, district: true, override: { select: { district: true } } },
      })
    : [];
  const districtOf = new Map(chosen.map((d) => [d.id, d.override?.district?.trim() || d.district || ""]));
  for (const r of rows) {
    const state = effectiveClaimState({
      state: r.state as ClaimStateValue, activeSince: activeSince(r), lastRealContactAt: contactAt.get(r.leadId) ?? null, now,
      leadDeleted: !!r.lead.deletedAt, leadStatus: r.lead.status, hasLiveDeal: false,
    });
    const name = submittedName(r.submission);
    if (state !== "ACTIVE" || !name) continue;
    const projectDistricts = Array.from(new Set(claimProjectIds(r.submission).map((id) => districtOf.get(id) ?? "").filter(Boolean)));
    const list = out.get(r.partnerId) ?? [];
    list.push({
      name, budgetMin: r.lead.budgetMin, budgetMax: r.lead.budgetMax, propertyTypeInterest: r.lead.propertyTypeInterest,
      lastMatchFilters: r.lead.lastMatchFilters, projectDistricts,
    });
    out.set(r.partnerId, list);
  }
  return out;
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
    select: {
      id: true, handoverShare: true, fixShare: true, notifyNewProjects: true, notifyProjectUpdates: true, notifyReminders: true, tierKey: true,
      bankDetailsEnc: true,
    },
  });
  result.partners = partners.length;
  if (!partners.length) return result;
  const newsTo = partners.filter((p) => p.notifyNewProjects);
  const watchTo = partners.filter((p) => p.notifyProjectUpdates);
  const reminded = partners.filter((p) => p.notifyReminders);
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

  // 1 — every project published in the last 24 h, with each partner's own rate, the prices per bedroom
  // count, a short selling line per locale and the partner's clients it fits (2026-10-31).
  await step("news", async () => {
    if (!newsTo.length) return [];
    const devs = await prisma.development.findMany({
      where: { publishStatus: "published", slug: { not: null }, publishedAt: { gte: new Date(now.getTime() - DAY), lte: now } },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      take: NEWS_MAX_PROJECTS,
      select: {
        id: true, publicName: true, slug: true, district: true, area: true, town: true, category: true, priceFrom: true, publishedAt: true,
        developerAccountId: true,
        description: true,
        override: { select: { alias: true, district: true, area: true, town: true, descriptionEN: true, descriptionDE: true, descriptionPL: true, descriptionRU: true } },
        units: { select: { status: true, beds: true, type: true, price: true } },
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
    // The first sentence(s) of the project's own description per locale is the selling line; a locale
    // without its own text is left out (the sender falls back to English).
    const blurbs = new Map<string, NewsBlurbs>();
    for (const d of devs) {
      const o = d.override;
      const texts: Record<PartnerLocale, string | null | undefined> = {
        en: o?.descriptionEN || d.description, de: o?.descriptionDE, pl: o?.descriptionPL, ru: o?.descriptionRU,
      };
      const b: NewsBlurbs = {};
      for (const lang of PARTNER_LOCALES) {
        const line = shortBlurb(texts[lang]);
        if (line) b[lang] = line;
      }
      blurbs.set(d.id, b);
    }
    const facts = devs.map((d) => ({
      id: d.id,
      district: d.override?.district?.trim() || d.district || null,
      town: d.override?.town?.trim() || d.town || null,
      area: d.override?.area?.trim() || d.area || null,
      units: d.units.filter((u) => u.status !== "unlisted"),
      priceFrom: d.priceFrom,
      category: d.category,
    }));
    const projects = devs.flatMap((d, i) => {
      const url = publicProjectUrl("en", d.slug);
      const f = facts[i];
      return url ? [{
        id: d.id, name: d.override?.alias?.trim() || d.publicName, area: newsPlace(f.town, f.area, f.district),
        priceFrom: resolveDevelopmentPrice(d.priceFrom, null, f.units).priceFrom, url, publishedAt: d.publishedAt ?? now,
        type: resolveDevelopmentType(d.category, f.units) || null, beds: bedPrices(f.units), blurb: blurbs.get(d.id) ?? {},
      }] : [];
    });
    const clients = await loadNewsClients(now, newsTo.map((p) => p.id));
    return planProjectNews({
      partners: newsTo.map((p) => ({
        id: p.id,
        rates: new Map(projectRates(rows, rates, { handoverShare: Number(p.handoverShare), fixShare: Number(p.fixShare), trustMode: false })
          .map((r) => [r.id, r.handoverRate])),
        clients: new Map(facts.map((f) => [f.id, (clients.get(p.id) ?? []).filter((c) => clientFits(f, c)).map((c) => c.name)])),
      })),
      projects,
      today,
    });
  });

  // 2+3 — changes on developments in the partner's own active presentations.
  await step("watch", async () => {
    if (!watchTo.length) return [];
    const items = await prisma.clientPresentationItem.findMany({
      where: {
        presentation: {
          partnerId: { in: watchTo.map((p) => p.id) }, status: "active",
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
    // 25 h, not 24: the snapshot diff needs YESTERDAY's nightly snapshot (04:50 UTC) as its base — with a
    // 24 h window at 05:30 it would pick today's 04:50 one and miss every price/availability change of the
    // nightly syncs. Dated events (new units, back on market) stay on the last 24 h so none is told twice.
    const [changes, devs] = await Promise.all([
      inventoryChanges({ days: 25 / 24, now, developmentIds: devIds, types: [...WATCH_TYPES], limit: CHANGE_CAP }),
      prisma.development.findMany({ where: { id: { in: devIds } }, select: { id: true, priceFrom: true } }),
    ]);
    const events: WatchEvent[] = changes.events
      .filter((e) => !e.at || e.at.getTime() >= now.getTime() - DAY)
      .map((e) => ({ ...e, url: absoluteProjectUrl(e.publicUrl) }));
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
        // The tier accept keeps the higher of the partner's own and the tier's share (tierAcceptData): announce
        // those, and nothing when the next tier would not raise either share (individually agreed shares).
        const own = { handover: Number(p.handoverShare), fix: Number(p.fixShare) };
        const next = prog.next && prog.remaining === 1 ? prog.next : null;
        const raises = !!next && (next.handoverShare > own.handover || next.fixShare > own.fix);
        return {
          id: p.id,
          next: next && raises
            ? { key: next.key, name: next.name, handoverShare: Math.max(own.handover, next.handoverShare), fixShare: Math.max(own.fix, next.fixShare) }
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
