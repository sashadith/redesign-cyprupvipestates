import { prisma } from "@/lib/prisma";
import type { SessionCrmUser } from "./session";
import { canAssignLeads } from "./access";
import { listPipeline, type PipelineCard } from "@/lib/partner/pipeline/store";
import { partnerDisplayName } from "@/lib/partner/bankFlow";

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

export type PipelineViewCard = PipelineCard & {
  light: Light;
  /** Short text of the partner's newest entry ("Call: ..."), or null. */
  lastPartnerEntry: string | null;
  presentationViews: number;
  lastOpenedAt: Date | null;
};

export type PartnerPipelineGroup = {
  partner: { id: string; name: string; managerName: string | null };
  cards: PipelineViewCard[];
};

const ENTRY_TEXT_MAX = 140;

function entryText(r: { type: string; subject: string | null; body: string | null }): string {
  const text = (r.subject || r.body || "").replace(/\s+/g, " ").trim();
  const clipped = text.length > ENTRY_TEXT_MAX ? `${text.slice(0, ENTRY_TEXT_MAX - 1)}…` : text;
  const type = r.type.charAt(0) + r.type.slice(1).toLowerCase().replace(/_/g, " ");
  return clipped ? `${type}: ${clipped}` : type;
}

/**
 * The partners the viewer may watch, with the cards the partner is working right now (handed-over and
 * lapsed clients are normal staff leads, not part of this view). Admins/owner: all partners; others:
 * partners they manage. Partners without a card are left out.
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
    select: { id: true, firstName: true, lastName: true, company: true, manager: { select: { name: true } } },
  });
  const thresholds = thresholdsFromEnv();
  const groups: PartnerPipelineGroup[] = [];
  for (const p of partners) {
    const all = await listPipeline(p.id, now);
    const working = all.filter((c) => !c.handedOver && !c.expired);
    if (!working.length) continue;
    const leadIds = working.map((c) => c.leadId);
    const [entries, presentations] = await Promise.all([
      prisma.leadInteraction.findMany({
        where: { leadId: { in: leadIds }, createdByPartnerUser: { partnerId: p.id } },
        distinct: ["leadId"],
        orderBy: [{ leadId: "asc" }, { occurredAt: "desc" }],
        select: { leadId: true, type: true, subject: true, body: true },
      }),
      prisma.clientPresentation.findMany({ where: { partnerId: p.id, leadId: { in: leadIds } }, select: { id: true, leadId: true } }),
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
    groups.push({
      partner: { id: p.id, name: partnerDisplayName(p), managerName: p.manager?.name ?? null },
      cards: working.map((c) => ({
        ...c,
        light: partnerLeadLight({ nextFollowUpAt: c.nextFollowUpAt, lastEntryAt: c.lastEntryAt, createdAt: c.since }, now, thresholds),
        lastPartnerEntry: lastEntry.get(c.leadId) ?? null,
        presentationViews: stats.get(c.leadId)?.views ?? 0,
        lastOpenedAt: stats.get(c.leadId)?.last ?? null,
      })),
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
