import { prisma } from "@/lib/prisma";
import type { LeadStatusValue, LostReasonValue } from "@/lib/crm/leadStatus";
import { isLeadStatus } from "@/lib/crm/leadStatus";
import { leadHints, type LeadHints } from "@/lib/crm/leadHints";
import { callWindowFromEnv, leadTimeSummary, type LeadTimeSummary } from "@/lib/crm/leadLocalTime";
import { REAL_CONTACT_TYPES } from "@/lib/partner/claims";
import { activeSince, effectiveClaimState } from "@/lib/partner/claimState";
import { effectiveStateOf } from "@/lib/partner/claimFacts";
import { messagesWhere, visibleName } from "@/lib/partner/clientDto";
import { myClientPresentations, type MyPresentation } from "@/lib/partner/scope";
import { claimEligible, ourTeamOf, partnerMayAct } from "./rules";
import { partnerTimeline, scopeTimeline, type TimelineEntry } from "./timeline";

// The partner's own pipeline, read side (partner pipeline, 2026-11-05): the list of
// his ACTIVE FIX clients and one client's detail. Everything is scoped to the
// partner id from the session. The detail carries the lead fields the partner may
// edit and nothing internal: no staff notes, owner, bucket or source.

export const PIPELINE_CAP = 500;
const TIMELINE_ROWS = 300;
const MESSAGE_ROWS = 100;

export type PipelineCard = {
  claimId: string;
  leadId: string;
  /** The name the partner submitted, as the rest of the portal shows it. */
  name: string;
  status: LeadStatusValue;
  /** When the claim became active. */
  since: Date;
  nextFollowUpAt: Date | null;
  overdue: boolean;
  localTime: LeadTimeSummary;
  /** The lead is no longer partner-worked (staff took over, or it is not his): read-only. */
  handedOver: boolean;
  /** Read-only without a handover of his: our team worked it from the start (or took it over), so "Worked by our team". */
  ourTeam: boolean;
  /** Still partner-worked, but the claim's protection has lapsed: the partner may not act on it any more. */
  expired: boolean;
  /** The newest entry written by one of this partner's users, or null. */
  lastEntryAt: Date | null;
};

export type PipelineClient = {
  claimId: string;
  leadId: string;
  name: string;
  status: LeadStatusValue;
  lostReason: LostReasonValue | null;
  since: Date;
  nextFollowUpAt: Date | null;
  overdue: boolean;
  viewingScheduledAt: Date | null;
  lead: {
    firstName: string; lastName: string | null; email: string | null; phone: string | null; salutation: string | null;
    languagePreference: string | null; budgetMin: number | null; budgetMax: number | null; timeline: string | null;
    financing: string | null; nationality: string | null; countryOfResidence: string | null; message: string | null;
  };
  /** The hint flags only: the English `messages` (and the raw bounce reason inside them) never reach the portal. */
  hints: PartnerHints;
  localTime: LeadTimeSummary;
  /** The lead has a deal that is not cancelled (a move to RESERVED/CLOSED then needs no new deal). */
  hasLiveDeal: boolean;
  presentations: MyPresentation[];
  timeline: TimelineEntry[];
  handedOver: boolean;
  /** See PipelineCard.ourTeam. */
  ourTeam: boolean;
  expired: boolean;
  /** The partner may act now (partnerMayAct: his ACTIVE FIX claim, effectively active, lead partner-worked). */
  canWork: boolean;
  /** The partner's handover request waiting for the manager, or null. */
  openHandover: { id: string; createdAt: Date; downgrade: boolean } | null;
};

export type PartnerHints = Omit<LeadHints, "messages">;

const statusOf = (s: string): LeadStatusValue => (isLeadStatus(s) ? s : "NEW");

// The hint flags without the English messages (they also carry the raw bounce reason).
function partnerHints(l: Parameters<typeof leadHints>[0]): PartnerHints {
  const { messages: _m, ...flags } = leadHints(l);
  return flags;
}

// Partner-authored rows of this partner's own users only.
const ownEntry = (partnerId: string) => ({ createdByPartnerUser: { partnerId } });

/** Whether the partner has at least one ACTIVE FIX claim (the portal shows "Pipeline" then). */
export async function hasPipeline(partnerId: string): Promise<boolean> {
  const one = await prisma.partnerClaim.findFirst({ where: { partnerId, mode: "FIX", state: "ACTIVE" }, select: { id: true } });
  return !!one;
}

/** ACTIVE FIX claims of the partner (stored state), newest first, at most PIPELINE_CAP. */
export async function listPipeline(partnerId: string, now: Date): Promise<PipelineCard[]> {
  const claims = await prisma.partnerClaim.findMany({
    where: { partnerId, mode: "FIX", state: "ACTIVE" },
    select: { id: true, leadId: true, createdAt: true, reviewedAt: true, submission: true },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: PIPELINE_CAP,
  });
  if (!claims.length) return [];
  const leadIds = claims.map((c) => c.leadId);
  const [leads, deals, contacts, entries, accepted] = await Promise.all([
    prisma.lead.findMany({
      where: { id: { in: leadIds }, deletedAt: null },
      select: {
        id: true, status: true, partnerId: true, workedByPartner: true, deletedAt: true, nextFollowUpAt: true,
        timeZone: true, countryOfResidence: true, phone: true,
      },
    }),
    prisma.deal.groupBy({ by: ["leadId"], where: { leadId: { in: leadIds }, commissionStatus: { not: "CANCELLED" } }, _count: { _all: true } }),
    prisma.leadInteraction.groupBy({
      by: ["leadId"], where: { leadId: { in: leadIds }, type: { in: [...REAL_CONTACT_TYPES] } }, _max: { occurredAt: true },
    }),
    prisma.leadInteraction.groupBy({
      by: ["leadId"], where: { leadId: { in: leadIds }, ...ownEntry(partnerId) }, _max: { occurredAt: true },
    }),
    prisma.partnerHandoverRequest.findMany({
      where: { partnerId, claimId: { in: claims.map((c) => c.id) }, state: "ACCEPTED" }, select: { claimId: true },
    }),
  ]);
  const handedOverClaims = new Set(accepted.map((a) => a.claimId));
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const liveDeals = new Set(deals.map((d) => d.leadId));
  const lastContact = new Map(contacts.map((c) => [c.leadId, c._max.occurredAt ?? null]));
  const lastEntry = new Map(entries.map((e) => [e.leadId, e._max.occurredAt ?? null]));
  const window = callWindowFromEnv();
  const cards: PipelineCard[] = [];
  for (const c of claims) {
    const lead = leadById.get(c.leadId);
    if (!lead) continue; // trashed or gone
    const effective = effectiveClaimState({
      state: "ACTIVE", activeSince: activeSince(c), lastRealContactAt: lastContact.get(c.leadId) ?? null, now,
      leadDeleted: false, leadStatus: lead.status, hasLiveDeal: liveDeals.has(c.leadId),
    });
    const handedOver = !(lead.partnerId === partnerId && lead.workedByPartner);
    cards.push({
      claimId: c.id, leadId: c.leadId, name: visibleName(c), status: statusOf(lead.status), since: activeSince(c),
      nextFollowUpAt: lead.nextFollowUpAt, overdue: !!lead.nextFollowUpAt && lead.nextFollowUpAt.getTime() < now.getTime(),
      localTime: leadTimeSummary(lead, now, window), handedOver, ourTeam: ourTeamOf(handedOver, handedOverClaims.has(c.id)),
      expired: !handedOver && effective !== "ACTIVE",
      lastEntryAt: lastEntry.get(c.leadId) ?? null,
    });
  }
  return cards;
}

/** One client of the partner's pipeline, or null when the claim is not his ACTIVE FIX claim (or the lead is gone). */
export async function getPipelineClient(partnerId: string, claimId: string, now: Date): Promise<PipelineClient | null> {
  if (typeof claimId !== "string" || claimId.length > 64) return null;
  const claim = await prisma.partnerClaim.findUnique({
    where: { id: claimId },
    select: { id: true, partnerId: true, mode: true, state: true, leadId: true, createdAt: true, reviewedAt: true, submission: true },
  });
  if (!claim || !claimEligible(claim, partnerId)) return null;
  const lead = await prisma.lead.findUnique({
    where: { id: claim.leadId },
    select: {
      status: true, lostReason: true, partnerId: true, workedByPartner: true, deletedAt: true, nextFollowUpAt: true, viewingScheduledAt: true,
      timeZone: true, source: true, emailInvalidAt: true, emailInvalidReason: true,
      firstName: true, lastName: true, email: true, phone: true, salutation: true, languagePreference: true,
      budgetMin: true, budgetMax: true, timeline: true, financing: true, nationality: true, countryOfResidence: true, message: true,
    },
  });
  if (!lead || lead.deletedAt || lead.partnerId !== partnerId) return null;
  // The history starts when the claim became active, as everywhere else in the portal (clientDto's scoped()).
  const since = activeSince(claim);
  const [effective, rows, messages, presentations, liveDeal, openHandover, ownPresentations, accepted] = await Promise.all([
    effectiveStateOf(prisma, claim, now),
    prisma.leadInteraction.findMany({
      where: {
        leadId: claim.leadId,
        occurredAt: { gte: since },
        OR: [ownEntry(partnerId), { type: { in: ["STATUS_CHANGE", "PRESENTATION_EVENT"] } }],
      },
      select: {
        id: true, type: true, direction: true, subject: true, body: true, occurredAt: true,
        createdByUserId: true, createdByPartnerUserId: true, createdByName: true, metadata: true,
      },
      orderBy: { occurredAt: "desc" },
      take: TIMELINE_ROWS,
    }),
    prisma.partnerMessage.findMany({
      where: { ...messagesWhere(partnerId, [claim.leadId]), createdAt: { gte: since } },
      select: { id: true, leadId: true, partnerId: true, createdAt: true, body: true },
      orderBy: { createdAt: "desc" },
      take: MESSAGE_ROWS,
    }),
    myClientPresentations(partnerId, claimId),
    prisma.deal.findFirst({ where: { leadId: claim.leadId, commissionStatus: { not: "CANCELLED" } }, select: { id: true } }),
    prisma.partnerHandoverRequest.findFirst({
      where: { leadId: claim.leadId, partnerId, state: "OPEN" },
      select: { id: true, createdAt: true, downgrade: true },
    }),
    // Presentation events only of the partner's own presentations (any state, also revoked ones).
    prisma.clientPresentation.findMany({ where: { partnerId, leadId: claim.leadId }, select: { id: true } }),
    prisma.partnerHandoverRequest.findFirst({ where: { partnerId, claimId: claim.id, state: "ACCEPTED" }, select: { id: true } }),
  ]);
  const scoped = scopeTimeline(rows, messages, { since, ownPresentationIds: new Set(ownPresentations.map((p) => p.id)) });
  const handedOver = !lead.workedByPartner;
  const { source, emailInvalidAt, emailInvalidReason, status, lostReason, partnerId: _p, workedByPartner: _w, deletedAt: _d, ...fields } = lead;
  const { nextFollowUpAt, viewingScheduledAt, timeZone, ...edit } = fields;
  return {
    claimId: claim.id, leadId: claim.leadId, name: visibleName(claim), status: statusOf(status),
    lostReason: (lostReason ?? null) as LostReasonValue | null, since: activeSince(claim),
    nextFollowUpAt, overdue: !!nextFollowUpAt && nextFollowUpAt.getTime() < now.getTime(), viewingScheduledAt,
    lead: edit,
    hints: partnerHints({ source, emailInvalidAt, emailInvalidReason, countryOfResidence: edit.countryOfResidence, lastName: edit.lastName, email: edit.email, phone: edit.phone, budgetMin: edit.budgetMin, budgetMax: edit.budgetMax }),
    localTime: leadTimeSummary({ timeZone, countryOfResidence: edit.countryOfResidence, phone: edit.phone }, now, callWindowFromEnv()),
    hasLiveDeal: !!liveDeal,
    presentations,
    timeline: partnerTimeline(scoped.rows, scoped.messages),
    handedOver,
    ourTeam: ourTeamOf(handedOver, !!accepted),
    expired: !handedOver && effective !== "ACTIVE",
    canWork: partnerMayAct(claim, effective, lead, partnerId),
    openHandover,
  };
}
