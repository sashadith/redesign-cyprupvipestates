// Partner scope (partner portal phase 3b): the only place portal pages read CRM-side data.
// Every function takes the session's partnerId (from requirePartner({ active: true })) and
// returns DTOs — never raw Prisma rows, never data of other partners.
import { prisma } from "@/lib/prisma";
import { resolveRate, type RateRow } from "@/lib/crm/commission";
import { officeContact } from "./accounts";
import { REAL_CONTACT_TYPES } from "./claims";
import { COMMITTED_LEAD_STATUSES, activeSince } from "./claimState";
import {
  COMMISSIONS_CAP, commissionClaimsWhere, commissionRowTotals, commissionRows, paidClaimsWhere, partnerCreditNotesWhere,
  type CommissionRow, type CreditNoteRef, type Period,
} from "./commissions";
import {
  CLIENT_SEARCH_SCAN, CLIENTS_PAGE_SIZE, OUTBOUND_CONTACT_TYPES, activeClaimsWhere, claimWhere, clientsWhere, commissionTotals,
  dealsForClaims, displayStateOf, latestMilestones, matchesQuery, messagesWhere, overviewCountWheres, toClientDetail, toListItem, visibleName,
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

// Lead fields a claim row may load: never email/phone/notes/message, not even the lead's name
// (the partner always sees the name they submitted).
const CLAIM_SELECT = {
  id: true,
  partnerId: true,
  leadId: true,
  state: true,
  createdAt: true,
  reviewedAt: true,
  submission: true,
  lead: { select: { status: true, deletedAt: true, assignedTo: { select: { name: true } } } },
} as const;

type ClaimLite = { leadId: string; createdAt: Date; reviewedAt?: Date | null };

/**
 * Stage/booking events and first/last real contact per lead, restricted to occurredAt >= the claim's
 * activeSince (an accepted known contact's history before the review is not the partner's), plus the
 * first outbound contact since submission (createdAt — the response-time metric). Two queries, a third
 * only when some claim was accepted after review; bodies are never selected. Callers pass ACTIVE claims
 * only (at most one per lead, enforced by a partial unique index).
 */
async function loadActivity(claims: ClaimLite[]): Promise<Map<string, Activity>> {
  const map = new Map<string, Activity>();
  if (!claims.length) return map;
  const or = claims.map((c) => ({ leadId: c.leadId, occurredAt: { gte: activeSince(c) } }));
  const reviewed = claims.filter((c) => activeSince(c).getTime() !== c.createdAt.getTime());
  const reviewedLeads = new Set(reviewed.map((c) => c.leadId));
  const [events, contacts, outbound] = await Promise.all([
    prisma.leadInteraction.findMany({
      where: { OR: or, type: { in: ["STATUS_CHANGE", "BOOKING_EVENT"] } },
      select: { leadId: true, type: true, occurredAt: true, metadata: true },
      orderBy: { occurredAt: "desc" },
      take: 5000,
    }),
    prisma.leadInteraction.groupBy({
      by: ["leadId", "type"],
      where: { OR: or, type: { in: [...REAL_CONTACT_TYPES] } },
      _min: { occurredAt: true },
      _max: { occurredAt: true },
    }),
    reviewed.length
      ? prisma.leadInteraction.groupBy({
          by: ["leadId"],
          where: { OR: reviewed.map((c) => ({ leadId: c.leadId, occurredAt: { gte: c.createdAt } })), type: { in: [...OUTBOUND_CONTACT_TYPES] } },
          _min: { occurredAt: true },
        })
      : Promise.resolve([]),
  ]);
  const get = (leadId: string) => {
    let a = map.get(leadId);
    if (!a) map.set(leadId, (a = { events: [], firstRealContactAt: null, lastRealContactAt: null, firstOutboundAt: null }));
    return a;
  };
  const earlier = (x: Date | null | undefined, y: Date | null | undefined) => (!x ? y ?? null : !y ? x : x < y ? x : y);
  const later = (x: Date | null | undefined, y: Date | null | undefined) => (!x ? y ?? null : !y ? x : x > y ? x : y);
  for (const e of events) get(e.leadId).events.push({ type: e.type, occurredAt: e.occurredAt, metadata: e.metadata });
  for (const r of contacts) {
    const a = get(r.leadId);
    a.firstRealContactAt = earlier(a.firstRealContactAt, r._min.occurredAt);
    a.lastRealContactAt = later(a.lastRealContactAt, r._max.occurredAt);
    if (!reviewedLeads.has(r.leadId) && (OUTBOUND_CONTACT_TYPES as readonly string[]).includes(r.type)) {
      a.firstOutboundAt = earlier(a.firstOutboundAt, r._min.occurredAt);
    }
  }
  for (const r of outbound) get(r.leadId).firstOutboundAt = r._min.occurredAt ?? null;
  return map;
}

/**
 * Deals on these leads — partner-facing columns only (never ourCommission / ourRatePercent).
 * Capped at the 2000 newest deals as a safety bound: callers pass at most one page of claims or the
 * overview's (capped) active claims, and a lead rarely has more than a few deals, so the cap is
 * not reached in practice; beyond it the oldest deals would be missing from the totals.
 */
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

/** Claims of this partner (all states), newest first, 50 per page; search on the submitted name. */
export async function listMyClients(
  partnerId: string,
  opts: { filter: ClientFilter; q?: string; page?: number },
): Promise<MyClients> {
  const now = new Date();
  const where = clientsWhere(partnerId, opts.filter, now);
  const q = opts.q?.trim() ?? "";
  let page = Math.max(1, Math.floor(opts.page ?? 1));
  let rows: RawClaim[];
  let total: number;
  if (q) {
    // Names live in JSON (submission), so the match runs in memory over a bounded scan.
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
  // Activity + deals decide the display state (protection, committed); messages only for claims still ACTIVE.
  const active = rows.filter((r) => r.state === "ACTIVE" && r.lead && !r.lead.deletedAt);
  const [activity, deals] = await Promise.all([loadActivity(active), loadDeals(active.map((r) => r.leadId))]);
  const live = active.filter((r) => displayStateOf(r, { activity, now, deals }) === "ACTIVE").map((r) => r.leadId);
  const messages = await loadMessages(partnerId, live, false);
  const ctx = { partnerId, now, activity, deals, messages };
  return { items: rows.map((r) => toListItem(r, ctx)), total, page, pages: Math.max(1, Math.ceil(total / CLIENTS_PAGE_SIZE)) };
}

/**
 * One claim of this partner, or null (→ notFound()). Non-ACTIVE claims load no CRM data at all;
 * ACTIVE claims on a trashed lead or with expired protection (and nothing committed) show no deals or messages.
 */
export async function getMyClient(partnerId: string, claimId: string): Promise<ClientDetail | null> {
  if (typeof claimId !== "string" || claimId.length > 64) return null;
  const claim = await prisma.partnerClaim.findFirst({
    where: claimWhere(partnerId, claimId),
    select: { id: true, partnerId: true, leadId: true, state: true, createdAt: true, reviewedAt: true, submission: true },
  });
  if (!claim) return null;
  const office = officeContact();
  const now = new Date();
  if (claim.state !== "ACTIVE") {
    return toClientDetail({ ...claim, lead: null }, { partnerId, now, deals: [], messages: [], office });
  }
  const [lead, activity, deals] = await Promise.all([
    prisma.lead.findUnique({
      where: { id: claim.leadId },
      select: { status: true, lostReason: true, deletedAt: true, assignedTo: { select: { name: true, email: true, phone: true, isActive: true } } },
    }),
    loadActivity([claim]),
    loadDeals([claim.leadId]),
  ]);
  const row: RawClaim = { ...claim, lead };
  if (displayStateOf(row, { activity, now, deals }) !== "ACTIVE") {
    return toClientDetail(row, { partnerId, now, activity, deals: [], messages: [], office });
  }
  const messages = await loadMessages(partnerId, [claim.leadId], true);
  return toClientDetail(row, { partnerId, now, activity, deals, messages, office });
}

export type MyOverview = {
  counts: { active: number; inReview: number; viewings: number; closed: number };
  commission: Record<CommissionStage, number>;
  latest: OverviewMilestone[];
};

const OVERVIEW_CLAIM_SCAN = 2000;
const OVERVIEW_MILESTONE_CLAIMS = 20;

/**
 * KPIs, commission totals per stage and the 5 latest milestones. Claims on a trashed lead, and claims
 * with expired protection and nothing committed (no RESERVED/CLOSED status, no non-CANCELLED deal), are left out. Milestones scan the 20 live claims whose lead changed most recently.
 */
export async function myOverview(partnerId: string): Promise<MyOverview> {
  const now = new Date();
  const w = overviewCountWheres(partnerId, now);
  const live = activeClaimsWhere(partnerId, now);
  const [active, inReview, viewings, closed, claims, recent] = await Promise.all([
    prisma.partnerClaim.count({ where: w.active }),
    prisma.partnerClaim.count({ where: w.inReview }),
    prisma.partnerClaim.count({ where: w.viewings }),
    prisma.partnerClaim.count({ where: w.closed }),
    prisma.partnerClaim.findMany({
      where: live, select: { leadId: true, createdAt: true, reviewedAt: true }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: OVERVIEW_CLAIM_SCAN,
    }),
    prisma.partnerClaim.findMany({
      where: live, select: CLAIM_SELECT, orderBy: [{ lead: { updatedAt: "desc" } }, { id: "asc" }], take: OVERVIEW_MILESTONE_CLAIMS,
    }) as Promise<RawClaim[]>,
  ]);
  const recentLeadIds = recent.map((c) => c.leadId);
  const [deals, activity, messages] = await Promise.all([
    loadDeals(Array.from(new Set([...claims.map((c) => c.leadId), ...recentLeadIds]))),
    loadActivity(recent),
    loadMessages(partnerId, recentLeadIds, false),
  ]);
  const mine = dealsForClaims(claims, deals);
  return {
    counts: { active, inReview, viewings, closed },
    commission: commissionTotals(mine),
    // All deals of the leads: the committed check looks at any deal; milestones still only use deals after the claim.
    latest: latestMilestones(recent, { partnerId, now, activity, deals, messages }, 5),
  };
}

const DIGEST_MILESTONE_CLAIMS = 50;

/**
 * Weekly digest: this partner's milestones in [since, now] on effectively ACTIVE claims (the overview
 * rule, latestMilestones), newest first, at most `limit`. Scans the 50 live claims whose lead changed
 * most recently. No message bodies, no lead contact data.
 */
export async function myRecentMilestones(partnerId: string, now: Date, since: Date, limit = 10): Promise<OverviewMilestone[]> {
  const recent = (await prisma.partnerClaim.findMany({
    where: activeClaimsWhere(partnerId, now),
    select: CLAIM_SELECT,
    orderBy: [{ lead: { updatedAt: "desc" } }, { id: "asc" }],
    take: DIGEST_MILESTONE_CLAIMS,
  })) as RawClaim[];
  if (!recent.length) return [];
  const leadIds = recent.map((c) => c.leadId);
  const [deals, activity, messages] = await Promise.all([loadDeals(leadIds), loadActivity(recent), loadMessages(partnerId, leadIds, false)]);
  return latestMilestones(recent, { partnerId, now, activity, deals, messages }, Number.MAX_SAFE_INTEGER)
    .filter((m) => m.at.getTime() >= since.getTime() && m.at.getTime() <= now.getTime())
    .slice(0, limit);
}

/** A published development with the rows projectRates needs (shared by all partners of one digest run). */
export type PublishedProjects = { rows: (ProjectRow & { publishedAt: Date })[]; rates: RateRow[] };

/**
 * Developments published in [since, now] with a slug, newest first (at most `limit`), plus their
 * developers' rate rows. `publishedAt` is stamped on every transition into "published" (admin publish
 * action) and cleared on archive, so a re-published project counts again. Partner-neutral: the
 * partner's rates are applied per recipient with projectRates.
 */
export async function recentlyPublishedProjects(now: Date, since: Date, limit = 5): Promise<PublishedProjects> {
  const devs = await prisma.development.findMany({
    where: { publishStatus: "published", slug: { not: null }, publishedAt: { gte: since, lte: now } },
    select: {
      id: true, publicName: true, town: true, slug: true, developerAccountId: true, publishedAt: true,
      override: { select: { alias: true, town: true } },
    },
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    take: limit,
  });
  if (!devs.length) return { rows: [], rates: [] };
  const rateRows = await prisma.commissionRate.findMany({
    where: { developerAccountId: { in: Array.from(new Set(devs.map((d) => d.developerAccountId))) } },
    select: { developerAccountId: true, developmentId: true, ratePercent: true },
  });
  return {
    rows: devs.map((d) => ({
      id: d.id,
      name: d.override?.alias?.trim() || d.publicName,
      town: d.override?.town?.trim() || d.town || null,
      slug: d.slug,
      developerAccountId: d.developerAccountId,
      publishedAt: d.publishedAt ?? now, // never null here: the filter requires publishedAt in [since, now]
    })),
    rates: rateRows.map((r) => ({ developerAccountId: r.developerAccountId, developmentId: r.developmentId, ratePercent: Number(r.ratePercent) })),
  };
}

// ── Commissions ─────────────────────────────────────────────────────────────

export type MyCommissions = {
  rows: CommissionRow[];
  totals: Record<CommissionStage, number>;
  /** The claim or deal scan hit COMMISSIONS_CAP: older deals may be missing. */
  truncated: boolean;
};

/**
 * Deals of this partner's effectively-active claims (the client-detail rule, see commissionRows), plus
 * every deal this partner holds a credit note for (paid money never disappears — claim state, trash and
 * activeSince do not matter for those), inside the period (inclusive Cyprus days on the current stage
 * date) and totals per stage (CANCELLED listed, not counted). Bounded: at most COMMISSIONS_CAP claims,
 * credit notes and deals (newest first); `truncated` tells the page. No lead contact data, no bodies.
 */
export async function myCommissions(partnerId: string, period: Pick<Period, "from" | "to">): Promise<MyCommissions> {
  const now = new Date();
  const [claims, notes] = await Promise.all([
    prisma.partnerClaim.findMany({
      where: commissionClaimsWhere(partnerId),
      select: {
        id: true, partnerId: true, leadId: true, state: true, createdAt: true, reviewedAt: true, submission: true,
        lead: { select: { status: true, deletedAt: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: COMMISSIONS_CAP,
    }) as Promise<RawClaim[]>,
    prisma.creditNote.findMany({
      where: partnerCreditNotesWhere(partnerId),
      select: { id: true, number: true, dealId: true, partnerId: true, vatAmount: true, totalAmount: true, deal: { select: { leadId: true } } },
      orderBy: { issuedAt: "desc" },
      take: COMMISSIONS_CAP,
    }),
  ]);
  if (!claims.length && !notes.length) return { rows: [], totals: commissionRowTotals([]), truncated: false };
  const creditNotes: CreditNoteRef[] = notes.map(({ deal: _deal, ...n }) => n);
  const paidLeadIds = Array.from(new Set(notes.map((n) => n.deal.leadId)));
  const [deals, paidClaims] = await Promise.all([
    loadDeals(Array.from(new Set([...claims.map((c) => c.leadId), ...paidLeadIds]))),
    paidLeadIds.length
      ? prisma.partnerClaim.findMany({
          where: paidClaimsWhere(partnerId, paidLeadIds),
          select: { partnerId: true, leadId: true, createdAt: true, submission: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);
  // Protection only matters for claims that are not committed (no live deal, lead not RESERVED/CLOSED):
  // for those, the last real contact since activeSince decides; nothing else of the activity is needed.
  const live = new Set(deals.filter((d) => d.commissionStatus !== "CANCELLED").map((d) => d.leadId));
  const uncommitted = claims.filter(
    (c) => !live.has(c.leadId) && !(COMMITTED_LEAD_STATUSES as readonly string[]).includes(c.lead?.status ?? ""),
  );
  const contacts = uncommitted.length
    ? await prisma.leadInteraction.groupBy({
        by: ["leadId"],
        where: { OR: uncommitted.map((c) => ({ leadId: c.leadId, occurredAt: { gte: activeSince(c) } })), type: { in: [...REAL_CONTACT_TYPES] } },
        _max: { occurredAt: true },
      })
    : [];
  const activity = new Map<string, Activity>(
    contacts.map((r) => [r.leadId, { events: [], firstRealContactAt: null, lastRealContactAt: r._max.occurredAt ?? null }]),
  );
  const rows = commissionRows(claims, { partnerId, now, activity, deals, creditNotes, paidClaims }, period);
  return {
    rows,
    totals: commissionRowTotals(rows),
    truncated: claims.length >= COMMISSIONS_CAP || deals.length >= COMMISSIONS_CAP || notes.length >= COMMISSIONS_CAP,
  };
}

