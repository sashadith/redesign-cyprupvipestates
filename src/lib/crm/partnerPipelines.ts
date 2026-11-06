import { prisma } from "@/lib/prisma";
import type { SessionCrmUser } from "./session";
import { canAssignLeads } from "./access";
import { listPipeline, type PipelineCard } from "@/lib/partner/pipeline/store";
import { partnerDisplayName } from "@/lib/partner/bankFlow";
import { takeOverReason, type TakeOverReason } from "./handoverReviewRules";

// The managers' read-only view of the partners' FIX pipelines (partner pipeline, 2026-11-05):
// one traffic light per client, from the follow-up date and the partner's last entry.

const DAY_MS = 86_400_000;

export type LightThresholds = { amberOverdueDays: number; amberQuietDays: number; redOverdueDays: number; redQuietDays: number };
export type Light = "green" | "amber" | "red";

const DEFAULTS: LightThresholds = { amberOverdueDays: 1, amberQuietDays: 7, redOverdueDays: 3, redQuietDays: 14 };

// "overdue days,quiet days": two positive integers, else null.
function pair(raw: string | undefined): [number, number] | null {
  const m = /^\s*(\d{1,4})\s*,\s*(\d{1,4})\s*$/.exec(raw ?? "");
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a >= 1 && b >= 1 ? [a, b] : null;
}

/** PARTNER_PIPELINE_AMBER="1,7" and PARTNER_PIPELINE_RED="3,14" (overdue days, quiet days). Junk or red below amber: defaults. */
export function thresholdsFromEnv(env: Record<string, string | undefined> = process.env): LightThresholds {
  const amber = pair(env.PARTNER_PIPELINE_AMBER);
  const red = pair(env.PARTNER_PIPELINE_RED);
  if (!amber || !red || red[0] < amber[0] || red[1] < amber[1]) return { ...DEFAULTS };
  return { amberOverdueDays: amber[0], amberQuietDays: amber[1], redOverdueDays: red[0], redQuietDays: red[1] };
}

/** Red: follow-up overdue by the red days or quiet that long; amber likewise. "Quiet" counts from the last partner entry, else createdAt. */
export function partnerLeadLight(
  l: { nextFollowUpAt: Date | null; lastEntryAt: Date | null; createdAt: Date },
  now: Date,
  t: LightThresholds,
): Light {
  const overdue = l.nextFollowUpAt ? (now.getTime() - l.nextFollowUpAt.getTime()) / DAY_MS : 0;
  const quiet = (now.getTime() - (l.lastEntryAt ?? l.createdAt).getTime()) / DAY_MS;
  if (overdue >= t.redOverdueDays || quiet >= t.redQuietDays) return "red";
  if (overdue >= t.amberOverdueDays || quiet >= t.amberQuietDays) return "amber";
  return "green";
}

/** "in stage 5 d" (whole days, "< 1 d" on the first day). */
export function stageAgeText(stageSince: Date, now: Date): string {
  const days = Math.floor((now.getTime() - stageSince.getTime()) / DAY_MS);
  return days < 1 ? "in stage < 1 d" : `in stage ${days} d`;
}

/** The newest status move of the lead, else when the claim became active. */
export function stageSinceOf(lastStatusChangeAt: Date | null | undefined, claimSince: Date): Date {
  return lastStatusChangeAt ?? claimSince;
}

/**
 * Splits the partner's still partner-worked cards: the ones he works now, and the ones he can no longer act
 * on (protection lapsed or his account not ACTIVE), which nobody could work without an explicit take-over.
 * Handed-over cards are normal staff leads and are left out.
 */
export function splitPartnerCards<C extends Pick<PipelineCard, "handedOver" | "expired">>(
  cards: C[], partnerStatus: string,
): { working: C[]; stuck: (C & { stuckReason: TakeOverReason })[] } {
  const working: C[] = [];
  const stuck: (C & { stuckReason: TakeOverReason })[] = [];
  for (const c of cards) {
    if (c.handedOver) continue;
    const reason = takeOverReason({ claimEffective: c.expired ? "EXPIRED" : "ACTIVE", partnerStatus });
    if (reason) stuck.push({ ...c, stuckReason: reason });
    else working.push(c);
  }
  return { working, stuck };
}

export type PipelineViewCard = PipelineCard & {
  light: Light;
  /** The newest status move of the lead (fallback: claim active since): "in stage 5 d". */
  stageSince: Date;
  /** Short text of the partner's newest entry ("Call: ..."), or null. */
  lastPartnerEntry: string | null;
  presentationViews: number;
  lastOpenedAt: Date | null;
};

export type PartnerPipelineGroup = {
  partner: { id: string; name: string; managerName: string | null; language: string };
  cards: PipelineViewCard[];
  /** Still partner-worked, but the partner can no longer act: shown flagged, with "Take over". */
  stuck: (PipelineViewCard & { stuckReason: TakeOverReason })[];
};

const ENTRY_TEXT_MAX = 140;

function entryText(r: { type: string; subject: string | null; body: string | null }): string {
  const text = (r.subject || r.body || "").replace(/\s+/g, " ").trim();
  const clipped = text.length > ENTRY_TEXT_MAX ? `${text.slice(0, ENTRY_TEXT_MAX - 1)}…` : text;
  const type = r.type.charAt(0) + r.type.slice(1).toLowerCase().replace(/_/g, " ");
  return clipped ? `${type}: ${clipped}` : type;
}

/**
 * The partners the viewer may watch, with the cards the partner is working right now and, apart, the
 * partner-worked cards he can no longer act on (lapsed protection, account not ACTIVE). Handed-over
 * clients are normal staff leads, not part of this view. Admins/owner: all partners; others: partners
 * they manage. Partners without a card are left out.
 */
export async function loadPartnerPipelines(
  user: SessionCrmUser,
  filter: { partnerId?: string },
  now: Date = new Date(),
): Promise<PartnerPipelineGroup[]> {
  if (!user.isActive) return [];
  const partners = await prisma.partner.findMany({
    where: {
      claims: { some: { mode: "FIX", state: "ACTIVE" } },
      ...(canAssignLeads(user) ? {} : { managerUserId: user.id }),
      ...(filter.partnerId ? { id: filter.partnerId } : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, status: true, language: true, firstName: true, lastName: true, company: true, manager: { select: { name: true } } },
  });
  const thresholds = thresholdsFromEnv();
  const groups: PartnerPipelineGroup[] = [];
  for (const p of partners) {
    const all = await listPipeline(p.id, now);
    const { working, stuck } = splitPartnerCards(all, p.status);
    if (!working.length && !stuck.length) continue;
    const leadIds = [...working, ...stuck].map((c) => c.leadId);
    const [entries, presentations, moves] = await Promise.all([
      prisma.leadInteraction.findMany({
        where: { leadId: { in: leadIds }, createdByPartnerUser: { partnerId: p.id } },
        distinct: ["leadId"],
        orderBy: [{ leadId: "asc" }, { occurredAt: "desc" }],
        select: { leadId: true, type: true, subject: true, body: true },
      }),
      prisma.clientPresentation.findMany({ where: { partnerId: p.id, leadId: { in: leadIds } }, select: { id: true, leadId: true } }),
      prisma.leadInteraction.groupBy({ by: ["leadId"], where: { leadId: { in: leadIds }, type: "STATUS_CHANGE" }, _max: { occurredAt: true } }),
    ]);
    const views = presentations.length
      ? await prisma.presentationView.groupBy({
          by: ["presentationId"],
          where: { presentationId: { in: presentations.map((x) => x.id) }, developmentId: null },
          _count: { _all: true },
          _max: { createdAt: true },
        })
      : [];
    const leadOf = new Map(presentations.map((x) => [x.id, x.leadId]));
    const stats = new Map<string, { views: number; last: Date | null }>();
    for (const g of views) {
      const leadId = leadOf.get(g.presentationId);
      if (!leadId) continue;
      const s = stats.get(leadId) ?? { views: 0, last: null };
      s.views += g._count._all;
      const last = g._max.createdAt ?? null;
      if (last && (!s.last || last > s.last)) s.last = last;
      stats.set(leadId, s);
    }
    const lastEntry = new Map(entries.map((e) => [e.leadId, entryText(e)]));
    const lastMove = new Map(moves.map((m) => [m.leadId, m._max.occurredAt ?? null]));
    const view = <C extends PipelineCard>(c: C): C & Omit<PipelineViewCard, keyof PipelineCard> => ({
      ...c,
      light: partnerLeadLight({ nextFollowUpAt: c.nextFollowUpAt, lastEntryAt: c.lastEntryAt, createdAt: c.since }, now, thresholds),
      stageSince: stageSinceOf(lastMove.get(c.leadId), c.since),
      lastPartnerEntry: lastEntry.get(c.leadId) ?? null,
      presentationViews: stats.get(c.leadId)?.views ?? 0,
      lastOpenedAt: stats.get(c.leadId)?.last ?? null,
    });
    groups.push({
      partner: { id: p.id, name: partnerDisplayName(p), managerName: p.manager?.name ?? null, language: p.language },
      cards: working.map(view),
      stuck: stuck.map(view),
    });
  }
  return groups;
}

/** Whether the nav link shows: admins always, others when they manage at least one partner. */
export async function managesPartners(user: SessionCrmUser): Promise<boolean> {
  if (canAssignLeads(user)) return true;
  if (!user.isActive) return false;
  return (await prisma.partner.count({ where: { managerUserId: user.id } })) > 0;
}
