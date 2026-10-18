// Partner scope (partner portal phase 3b): the only place portal pages read CRM-side data.
// Every function takes the session's partnerId (from requirePartner({ active: true })) and
// returns DTOs — never raw Prisma rows, never data of other partners.
import { prisma } from "@/lib/prisma";
import { resolveRate, type RateRow } from "@/lib/crm/commission";
import { officeContact } from "./accounts";
import { REAL_CONTACT_TYPES } from "./claims";
import {
  CLIENT_SEARCH_SCAN, CLIENTS_PAGE_SIZE, activeClaimsWhere, claimWhere, clientsWhere, commissionTotals, dealsForClaims,
  latestMilestones, matchesQuery, messagesWhere, overviewCountWheres, toClientDetail, toListItem, visibleName,
  type Activity, type ClientDetail, type ClientFilter, type ClientListItem, type CommissionStage, type OverviewMilestone,
  type RawClaim, type RawDeal, type RawMessage,
} from "./clientDto";

export type MyProject = {
  id: string;
  name: string;
  town: string | null;
  slug: string | null;
  /** Partner's effective rate in % of the price (our rate × share / 100, 2 decimals); null = rate on request. */
  handoverRate: number | null;
  fixRate: number | null;
  /** Our rate — only for trust-mode partners, null otherwise or when missing. */
  ourRate: number | null;
};

export type MyProjects = { handoverShare: number; fixShare: number; trustMode: boolean; projects: MyProject[] };

/** our rate % × partner share % / 100, rounded to 2 decimals in integer basis points (5.55 × 33.33 → 1.85). */
export function effectiveRate(ourRatePercent: number | null, sharePercent: number): number | null {
  if (ourRatePercent == null) return null;
  return Math.round((Math.round(ourRatePercent * 100) * Math.round(sharePercent * 100)) / 10000) / 100;
}

export type ProjectRow = { id: string; name: string; town: string | null; slug: string | null; developerAccountId: string };

/** Pure: projects + all rate rows of their developer accounts → DTOs sorted by name. */
export function projectRates(
  devs: ProjectRow[],
  rates: RateRow[],
  p: { handoverShare: number; fixShare: number; trustMode: boolean },
): MyProject[] {
  return devs
    .map((d) => {
      const our = resolveRate(rates, d.developerAccountId, d.id).ratePercent;
      return {
        id: d.id,
        name: d.name,
        town: d.town,
        slug: d.slug,
        handoverRate: effectiveRate(our, p.handoverShare),
        fixRate: effectiveRate(our, p.fixShare),
        ourRate: p.trustMode ? our : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.id.localeCompare(b.id));
}

/** Published developments with the partner's rates. Three queries in total, no N+1. */
export async function myProjects(partnerId: string): Promise<MyProjects> {
  const [partner, devs] = await Promise.all([
    prisma.partner.findUnique({ where: { id: partnerId }, select: { handoverShare: true, fixShare: true, trustMode: true } }),
    prisma.development.findMany({
      where: { publishStatus: "published" },
      select: { id: true, publicName: true, town: true, slug: true, developerAccountId: true, override: { select: { alias: true, town: true } } },
    }),
  ]);
  if (!partner) return { handoverShare: 0, fixShare: 0, trustMode: false, projects: [] };
  const shares = { handoverShare: Number(partner.handoverShare), fixShare: Number(partner.fixShare), trustMode: partner.trustMode };
  const accountIds = Array.from(new Set(devs.map((d) => d.developerAccountId)));
  const rateRows = accountIds.length
    ? await prisma.commissionRate.findMany({
        where: { developerAccountId: { in: accountIds } },
        select: { developerAccountId: true, developmentId: true, ratePercent: true },
      })
    : [];
  const rates: RateRow[] = rateRows.map((r) => ({ developerAccountId: r.developerAccountId, developmentId: r.developmentId, ratePercent: Number(r.ratePercent) }));
  const rows: ProjectRow[] = devs.map((d) => ({
    id: d.id,
    name: d.override?.alias?.trim() || d.publicName,
    town: d.override?.town?.trim() || d.town || null,
    slug: d.slug,
    developerAccountId: d.developerAccountId,
  }));
  return { ...shares, projects: projectRates(rows, rates, shares) };
}

// ── My clients ──────────────────────────────────────────────────────────────

// Lead fields a claim row may load. Never email/phone/notes/message of the lead; the mappers
// additionally show lead names only for ACTIVE claims.
const CLAIM_SELECT = {
  id: true,
  partnerId: true,
  leadId: true,
  state: true,
  createdAt: true,
  submission: true,
  lead: { select: { status: true, firstName: true, lastName: true, assignedTo: { select: { name: true } } } },
} as const;

type ClaimLite = { leadId: string; createdAt: Date };

/**
 * Stage/booking events and first/last real contact per lead, each restricted to occurredAt >= that
 * lead's claim date. Two queries for any number of claims; bodies are never selected.
 * Callers pass ACTIVE claims only (at most one per lead, enforced by a partial unique index).
 */
async function loadActivity(claims: ClaimLite[]): Promise<Map<string, Activity>> {
  const map = new Map<string, Activity>();
  if (!claims.length) return map;
  const or = claims.map((c) => ({ leadId: c.leadId, occurredAt: { gte: c.createdAt } }));
  const [events, real] = await Promise.all([
    prisma.leadInteraction.findMany({
      where: { OR: or, type: { in: ["STATUS_CHANGE", "BOOKING_EVENT"] } },
      select: { leadId: true, type: true, occurredAt: true, metadata: true },
      orderBy: { occurredAt: "desc" },
      take: 5000,
    }),
    prisma.leadInteraction.groupBy({
      by: ["leadId"],
      where: { OR: or, type: { in: [...REAL_CONTACT_TYPES] } },
      _min: { occurredAt: true },
      _max: { occurredAt: true },
    }),
  ]);
  const get = (leadId: string) => {
    let a = map.get(leadId);
    if (!a) map.set(leadId, (a = { events: [], firstRealContactAt: null, lastRealContactAt: null }));
    return a;
  };
  for (const e of events) get(e.leadId).events.push({ type: e.type, occurredAt: e.occurredAt, metadata: e.metadata });
  for (const r of real) {
    const a = get(r.leadId);
    a.firstRealContactAt = r._min.occurredAt ?? null;
    a.lastRealContactAt = r._max.occurredAt ?? null;
  }
  return map;
}

/** Deals on these leads — partner-facing columns only (never ourCommission / ourRatePercent). */
async function loadDeals(leadIds: string[]): Promise<RawDeal[]> {
  if (!leadIds.length) return [];
  const rows = await prisma.deal.findMany({
    where: { leadId: { in: leadIds } },
    select: {
      id: true, leadId: true, createdAt: true, unitLabel: true, price: true, partnerCommission: true, rateSource: true,
      commissionStatus: true, expectedAt: true, earnedAt: true, developerPaidAt: true, paidOutAt: true, cancelledAt: true,
      development: { select: { publicName: true, override: { select: { alias: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });
  return rows.map(({ development, ...d }) => ({
    ...d,
    projectName: development ? development.override?.alias?.trim() || development.publicName : null,
  }));
}

async function loadMessages(partnerId: string, leadIds: string[], withBody: boolean): Promise<RawMessage[]> {
  if (!leadIds.length) return [];
  return prisma.partnerMessage.findMany({
    where: messagesWhere(partnerId, leadIds),
    select: { leadId: true, partnerId: true, createdAt: true, ...(withBody ? { body: true } : {}) },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

export type MyClients = { items: ClientListItem[]; total: number; page: number; pages: number };

/** Claims of this partner (all states), newest first, 50 per page; search on the partner-visible name. */
export async function listMyClients(
  partnerId: string,
  opts: { filter: ClientFilter; q?: string; page?: number },
): Promise<MyClients> {
  const where = clientsWhere(partnerId, opts.filter);
  const q = opts.q?.trim() ?? "";
  let page = Math.max(1, Math.floor(opts.page ?? 1));
  let rows: RawClaim[];
  let total: number;
  if (q) {
    // Names live partly in JSON (submission), so the match runs in memory over a bounded scan.
    const all = (await prisma.partnerClaim.findMany({
      where, select: CLAIM_SELECT, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: CLIENT_SEARCH_SCAN,
    })) as RawClaim[];
    const hits = all.filter((r) => matchesQuery(visibleName(r), q));
    total = hits.length;
    page = Math.min(page, Math.max(1, Math.ceil(total / CLIENTS_PAGE_SIZE)));
    rows = hits.slice((page - 1) * CLIENTS_PAGE_SIZE, page * CLIENTS_PAGE_SIZE);
  } else {
    total = await prisma.partnerClaim.count({ where });
    page = Math.min(page, Math.max(1, Math.ceil(total / CLIENTS_PAGE_SIZE)));
    rows = (await prisma.partnerClaim.findMany({
      where, select: CLAIM_SELECT, orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * CLIENTS_PAGE_SIZE, take: CLIENTS_PAGE_SIZE,
    })) as RawClaim[];
  }
  const active = rows.filter((r) => r.state === "ACTIVE");
  const leadIds = active.map((r) => r.leadId);
  const [activity, deals, messages] = await Promise.all([
    loadActivity(active), loadDeals(leadIds), loadMessages(partnerId, leadIds, false),
  ]);
  const ctx = { partnerId, activity, deals, messages };
  return { items: rows.map((r) => toListItem(r, ctx)), total, page, pages: Math.max(1, Math.ceil(total / CLIENTS_PAGE_SIZE)) };
}

/** One claim of this partner, or null (→ notFound()). Non-ACTIVE claims load no CRM data at all. */
export async function getMyClient(partnerId: string, claimId: string): Promise<ClientDetail | null> {
  if (typeof claimId !== "string" || claimId.length > 64) return null;
  const claim = await prisma.partnerClaim.findFirst({
    where: claimWhere(partnerId, claimId),
    select: { id: true, partnerId: true, leadId: true, state: true, createdAt: true, submission: true },
  });
  if (!claim) return null;
  const office = officeContact();
  if (claim.state !== "ACTIVE") {
    return toClientDetail({ ...claim, lead: null }, { partnerId, deals: [], messages: [], office, now: new Date() });
  }
  const [lead, activity, deals, messages] = await Promise.all([
    prisma.lead.findUnique({
      where: { id: claim.leadId },
      select: {
        status: true, lostReason: true, firstName: true, lastName: true,
        assignedTo: { select: { name: true, email: true, phone: true, isActive: true } },
      },
    }),
    loadActivity([claim]),
    loadDeals([claim.leadId]),
    loadMessages(partnerId, [claim.leadId], true),
  ]);
  return toClientDetail({ ...claim, lead }, { partnerId, activity, deals, messages, office, now: new Date() });
}

export type MyOverview = {
  counts: { active: number; inReview: number; viewings: number; closed: number };
  commission: Record<CommissionStage, number>;
  latest: OverviewMilestone[];
};

const OVERVIEW_CLAIM_SCAN = 2000;
const OVERVIEW_MILESTONE_CLAIMS = 20;

/** KPIs, commission totals per stage and the 5 latest milestones (scan capped at the last 20 active claims). */
export async function myOverview(partnerId: string): Promise<MyOverview> {
  const w = overviewCountWheres(partnerId);
  const [active, inReview, viewings, closed, claims] = await Promise.all([
    prisma.partnerClaim.count({ where: w.active }),
    prisma.partnerClaim.count({ where: w.inReview }),
    prisma.partnerClaim.count({ where: w.viewings }),
    prisma.partnerClaim.count({ where: w.closed }),
    prisma.partnerClaim.findMany({
      where: activeClaimsWhere(partnerId), select: CLAIM_SELECT, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: OVERVIEW_CLAIM_SCAN,
    }) as Promise<RawClaim[]>,
  ]);
  const recent = claims.slice(0, OVERVIEW_MILESTONE_CLAIMS);
  const recentLeadIds = recent.map((c) => c.leadId);
  const [deals, activity, messages] = await Promise.all([
    loadDeals(claims.map((c) => c.leadId)),
    loadActivity(recent),
    loadMessages(partnerId, recentLeadIds, false),
  ]);
  const mine = dealsForClaims(claims, deals);
  return {
    counts: { active, inReview, viewings, closed },
    commission: commissionTotals(mine),
    latest: latestMilestones(recent, { partnerId, activity, deals: mine, messages }, 5),
  };
}
