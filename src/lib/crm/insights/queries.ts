// Server queries for /crm/insights (CRM v2 phase 4a, Task 3). Read-only, bounded and batched;
// the pure modules (channels / outlook / partnerQuality) do the arithmetic.
// Never selects lead contact data: only ids, source, mode, timestamps, statuses and amounts.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EXCLUDE_NEWSLETTER } from "@/lib/crm/leadBucket";
import { REAL_CONTACT_TYPES } from "@/lib/partner/claims";
import { OUTBOUND_CONTACT_TYPES } from "@/lib/partner/clientDto";
import type { ClaimStateValue } from "@/lib/partner/claimState";
import { chunk } from "./temperatureWiring";
import { channelRows, type ChannelRow, type FirstContact, type ChannelDeal } from "./channels";
import { commissionOutlook, lastMonthKeys, type CommissionOutlook } from "./outlook";
import { partnerQualityRows, type PartnerClaimFact, type PartnerQualityRow } from "./partnerQuality";

export const COHORT_CAP = 20_000;
export const PARTNER_CAP = 500;
export const CLAIM_CAP = 20_000;
export const OUTLOOK_DEAL_CAP = 20_000;
/** Ids per IN (...) list: well under Postgres' 32,767 bind parameters. */
const ID_CHUNK = 5_000;
const VIEWING_OR_LATER = ["VIEWING_SCHEDULED", "OFFER", "RESERVED", "CLOSED"];

type Period = { from: Date; to: Date };

async function inChunks<T>(ids: string[], run: (part: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (const part of chunk(ids, ID_CHUNK)) out.push(...(await run(part)));
  return out;
}

/** First real OUTBOUND contact (call / email out / WhatsApp out) per lead, any date. */
async function firstOutboundByLead(leadIds: string[]): Promise<FirstContact[]> {
  if (leadIds.length === 0) return [];
  const rows = await inChunks(leadIds, (part) =>
    prisma.leadInteraction.groupBy({
      by: ["leadId"],
      where: { leadId: { in: part }, type: { in: [...OUTBOUND_CONTACT_TYPES] } },
      _min: { occurredAt: true },
    }),
  );
  return rows.flatMap((r) => (r._min.occurredAt ? [{ leadId: r.leadId, at: r._min.occurredAt }] : []));
}

/** Leads that were ever moved to VIEWING_SCHEDULED or a later stage (STATUS_CHANGE metadata.toStatus). */
async function viewingLeadIds(leadIds: string[]): Promise<string[]> {
  if (leadIds.length === 0) return [];
  const rows = await inChunks(leadIds, (part) =>
    prisma.$queryRaw<{ leadId: string }[]>(Prisma.sql`
      SELECT DISTINCT i."leadId" AS "leadId"
        FROM lead_interactions i
       WHERE i."leadId" IN (${Prisma.join(part)})
         AND i.type::text = 'STATUS_CHANGE'
         AND i.metadata->>'toStatus' IN (${Prisma.join(VIEWING_OR_LATER)})`),
  );
  return rows.map((r) => r.leadId);
}

/** Channel performance for leads created in the period (NEWSLETTER and trashed leads excluded). */
export async function channelData(period: Period): Promise<{ rows: ChannelRow[]; truncated: boolean }> {
  const leads = await prisma.lead.findMany({
    where: { ...EXCLUDE_NEWSLETTER, deletedAt: null, createdAt: { gte: period.from, lt: period.to } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: COHORT_CAP + 1,
    select: { id: true, source: true, partnerMode: true, status: true, createdAt: true },
  });
  const truncated = leads.length > COHORT_CAP;
  const cohort = truncated ? leads.slice(0, COHORT_CAP) : leads;
  const ids = cohort.map((l) => l.id);

  const [firstContacts, viewings, dealSums] = await Promise.all([
    firstOutboundByLead(ids),
    viewingLeadIds(ids),
    ids.length === 0
      ? Promise.resolve([])
      : inChunks(ids, (part) =>
          prisma.deal.groupBy({
            by: ["leadId", "commissionStatus"],
            where: { leadId: { in: part }, commissionStatus: { in: ["EARNED", "DEVELOPER_PAID", "PAID_OUT"] } },
            _sum: { ourCommission: true },
          }),
        ),
  ]);
  const deals: ChannelDeal[] = dealSums.map((d) => ({ leadId: d.leadId, status: d.commissionStatus, ourCommission: d._sum.ourCommission ?? 0 }));

  return {
    rows: channelRows({
      leads: cohort.map((l) => ({ id: l.id, source: l.source, partnerMode: l.partnerMode, status: l.status, createdAt: l.createdAt })),
      firstContacts,
      viewings,
      deals,
    }),
    truncated,
  };
}

/** First day of the oldest chart month, minus a day of slack for the Cyprus offset (buckets filter exactly). */
function outlookWindowStart(now: Date): Date {
  const [y, m] = lastMonthKeys(now)[0].split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1) - 86_400_000);
}

/** Commission outlook: open stage totals, paid out in the period, and the 12-month history. */
export async function outlookData(now: Date, period: Period): Promise<CommissionOutlook & { truncated: boolean }> {
  const windowStart = outlookWindowStart(now);
  const deals = await prisma.deal.findMany({
    where: {
      commissionStatus: { not: "CANCELLED" },
      OR: [
        { commissionStatus: { in: ["EXPECTED", "EARNED", "DEVELOPER_PAID"] } },
        { paidOutAt: { gte: period.from, lt: period.to } },
        { earnedAt: { gte: windowStart } },
        { developerPaidAt: { gte: windowStart } },
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: OUTLOOK_DEAL_CAP + 1,
    select: { commissionStatus: true, ourCommission: true, partnerCommission: true, earnedAt: true, developerPaidAt: true, paidOutAt: true },
  });
  const truncated = deals.length > OUTLOOK_DEAL_CAP;
  const outlook = commissionOutlook({
    deals: (truncated ? deals.slice(0, OUTLOOK_DEAL_CAP) : deals).map((d) => ({
      status: d.commissionStatus, ourCommission: d.ourCommission, partnerCommission: d.partnerCommission,
      earnedAt: d.earnedAt, developerPaidAt: d.developerPaidAt, paidOutAt: d.paidOutAt,
    })),
    now,
    period,
  });
  return { ...outlook, truncated };
}

const partnerName = (p: { firstName: string; lastName: string; company: string | null }) => {
  const person = `${p.firstName} ${p.lastName}`.trim();
  return p.company ? `${person} (${p.company})` : person || "Unnamed partner";
};

/** Partner quality over the claims created in the period (ACTIVE + SUSPENDED partners). */
export async function partnerQualityData(period: Period, now: Date): Promise<{ rows: PartnerQualityRow[]; truncated: boolean }> {
  const partnersRaw = await prisma.partner.findMany({
    where: { status: { in: ["ACTIVE", "SUSPENDED"] } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: PARTNER_CAP + 1,
    select: { id: true, status: true, firstName: true, lastName: true, company: true },
  });
  const partnersCut = partnersRaw.length > PARTNER_CAP;
  const partners = (partnersCut ? partnersRaw.slice(0, PARTNER_CAP) : partnersRaw).map((p) => ({ id: p.id, status: p.status, name: partnerName(p) }));
  if (partners.length === 0) return { rows: [], truncated: partnersCut };

  const claims = await prisma.partnerClaim.findMany({
    where: { partnerId: { in: partners.map((p) => p.id) }, createdAt: { gte: period.from, lt: period.to } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: CLAIM_CAP + 1,
    select: {
      id: true, partnerId: true, leadId: true, state: true, createdAt: true, reviewedAt: true,
      lead: { select: { status: true, deletedAt: true, lostReason: true } },
    },
  });
  const claimsCut = claims.length > CLAIM_CAP;
  const shown = claimsCut ? claims.slice(0, CLAIM_CAP) : claims;
  const leadIds = Array.from(new Set(shown.map((c) => c.leadId)));
  // A rejected claim was a known contact: the team's contact with that lead says nothing about the referral.
  const responseClaimIds = shown.filter((c) => c.state !== "REJECTED").map((c) => c.id);

  const [lastContacts, liveDeals, viewings, firstResponses] = await Promise.all([
    leadIds.length === 0 ? Promise.resolve([]) : inChunks(leadIds, (part) =>
      prisma.leadInteraction.groupBy({ by: ["leadId"], where: { leadId: { in: part }, type: { in: [...REAL_CONTACT_TYPES] } }, _max: { occurredAt: true } })),
    leadIds.length === 0 ? Promise.resolve([]) : inChunks(leadIds, (part) =>
      prisma.deal.groupBy({ by: ["leadId"], where: { leadId: { in: part }, commissionStatus: { not: "CANCELLED" } }, _count: { _all: true } })),
    viewingLeadIds(leadIds),
    // First outbound contact on the claim's lead at or after the claim was submitted.
    responseClaimIds.length === 0 ? Promise.resolve([]) : inChunks(responseClaimIds, (part) =>
      prisma.$queryRaw<{ claimId: string; at: Date | null }[]>(Prisma.sql`
        SELECT c.id AS "claimId", MIN(i."occurredAt") AS at
          FROM partner_claims c
          JOIN lead_interactions i ON i."leadId" = c."leadId" AND i."occurredAt" >= c."createdAt"
         WHERE c.id IN (${Prisma.join(part)})
           AND i.type::text IN (${Prisma.join([...OUTBOUND_CONTACT_TYPES])})
         GROUP BY c.id`)),
  ]);

  const lastContactBy = new Map(lastContacts.map((r) => [r.leadId, r._max.occurredAt ?? null]));
  const liveDealBy = new Set(liveDeals.filter((r) => r._count._all > 0).map((r) => r.leadId));
  const viewed = new Set(viewings);
  const responseBy = new Map(firstResponses.flatMap((r) => (r.at ? [[r.claimId, r.at] as const] : [])));

  const facts: PartnerClaimFact[] = shown.map((c) => {
    const first = responseBy.get(c.id);
    return {
      partnerId: c.partnerId,
      state: c.state as ClaimStateValue,
      createdAt: c.createdAt,
      reviewedAt: c.reviewedAt,
      lastRealContactAt: lastContactBy.get(c.leadId) ?? null,
      leadDeleted: !!c.lead.deletedAt,
      leadStatus: c.lead.status,
      leadLostReason: c.lead.lostReason,
      hasLiveDeal: liveDealBy.has(c.leadId),
      reachedViewing: viewed.has(c.leadId),
      responseMinutes: first ? Math.max(0, Math.round((first.getTime() - c.createdAt.getTime()) / 60_000)) : null,
    };
  });

  return { rows: partnerQualityRows({ partners, claims: facts, now }), truncated: partnersCut || claimsCut };
}
