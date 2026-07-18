import { prisma } from "@/lib/prisma";
import type { ActionItem } from "../types";

const DAY = 86_400_000;
const NEW_LEAD_URGENT_HOURS = 24;
const STALE_FOLLOWUP_DAYS = 7;
const ENGAGED_VIEW_THRESHOLD = 3;
const EXPIRING_SOON_DAYS = 7;

const leadName = (l: { firstName: string; lastName: string }) => `${l.firstName} ${l.lastName}`.trim();

// (f) Lead in status NEW for more than 24h.
async function newLeadNoResponse(): Promise<ActionItem[]> {
  const cutoff = new Date(Date.now() - NEW_LEAD_URGENT_HOURS * 3_600_000);
  const leads = await prisma.lead.findMany({
    where: { status: "NEW", deletedAt: null, createdAt: { lte: cutoff } },
    select: { id: true, firstName: true, lastName: true, createdAt: true },
  });
  return leads.map((l) => {
    const hours = Math.floor((Date.now() - l.createdAt.getTime()) / 3_600_000);
    return {
      id: `lead-new:${l.id}`, severity: "URGENT" as const, category: "CRM" as const,
      title: `${leadName(l)} is waiting for a first response since ${hours}h`,
      description: "New lead, no status change yet.",
      deepLink: `/admin/crm/${l.id}`, since: l.createdAt,
    };
  });
}

// (g) Lead in CONTACTED/QUALIFIED with no activity for 7+ days. "No activity"
// = no LeadActivity row (activity inserts don't bump Lead.updatedAt — confirmed
// in src/app/api/c/[token]/view/route.ts) — falls back to Lead.createdAt when
// there are zero activity rows at all.
async function staleFollowUp(): Promise<ActionItem[]> {
  const leads = await prisma.lead.findMany({
    where: { status: { in: ["CONTACTED", "QUALIFIED"] }, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, createdAt: true, activities: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const cutoff = Date.now() - STALE_FOLLOWUP_DAYS * DAY;
  const items: ActionItem[] = [];
  for (const l of leads) {
    const lastActivity = l.activities[0]?.createdAt ?? l.createdAt;
    if (lastActivity.getTime() > cutoff) continue;
    const days = Math.floor((Date.now() - lastActivity.getTime()) / DAY);
    items.push({
      id: `lead-stale:${l.id}`, severity: "ACTION", category: "CRM",
      title: `No follow-up on ${leadName(l)} for ${days} days`,
      description: `Status: ${l.activities.length ? "last activity" : "no activity logged"} ${days} days ago.`,
      deepLink: `/admin/crm/${l.id}`, since: lastActivity,
    });
  }
  return items;
}

// (h) Presentation viewed 3+ times but no lead activity since the last view —
// reuses the same page-level view rows (developmentId=null) the return-visit
// Telegram alert already tracks (src/app/api/c/[token]/view/route.ts).
async function engagedNoFollowUp(): Promise<ActionItem[]> {
  const presentations = await prisma.clientPresentation.findMany({
    where: { status: "active" },
    select: {
      id: true, leadId: true,
      lead: { select: { firstName: true, lastName: true, status: true, deletedAt: true, activities: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 } } },
      views: { where: { developmentId: null }, select: { createdAt: true }, orderBy: { createdAt: "desc" } },
    },
  });
  const items: ActionItem[] = [];
  for (const p of presentations) {
    if (!p.lead || p.lead.deletedAt || ["CLOSED", "LOST"].includes(p.lead.status)) continue;
    if (p.views.length < ENGAGED_VIEW_THRESHOLD) continue;
    const lastView = p.views[0].createdAt;
    const lastActivity = p.lead.activities[0]?.createdAt ?? null;
    if (lastActivity && lastActivity > lastView) continue; // already followed up after the latest view
    items.push({
      id: `presentation-engaged:${p.id}`, severity: "ACTION", category: "CRM",
      title: `${leadName(p.lead)} keeps viewing their presentation — call them`,
      description: `${p.views.length} visits, most recent ${lastView.toLocaleDateString("en-GB")}.`,
      deepLink: `/admin/crm/${p.leadId}`, since: lastView,
    });
  }
  return items;
}

// (i) Presentation expiring within 7 days, for a lead that's still active
// (not CLOSED/LOST).
async function expiringSoon(): Promise<ActionItem[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + EXPIRING_SOON_DAYS * DAY);
  const presentations = await prisma.clientPresentation.findMany({
    where: { status: "active", expiresAt: { gte: now, lte: horizon } },
    select: { id: true, leadId: true, expiresAt: true, lead: { select: { firstName: true, lastName: true, status: true, deletedAt: true } } },
  });
  return presentations
    .filter((p) => p.lead && !p.lead.deletedAt && !["CLOSED", "LOST"].includes(p.lead.status))
    .map((p) => {
      const days = Math.ceil((p.expiresAt!.getTime() - now.getTime()) / DAY);
      return {
        id: `presentation-expiring:${p.id}`, severity: "INFO" as const, category: "CRM" as const,
        title: `${leadName(p.lead!)}'s presentation expires in ${days} day${days === 1 ? "" : "s"}`,
        description: "Extend it from the presentation editor if the lead is still active.",
        deepLink: `/admin/crm/${p.leadId}`, since: now,
      };
    });
}

export async function crmRules(): Promise<ActionItem[]> {
  const [f, g, h, i] = await Promise.all([newLeadNoResponse(), staleFollowUp(), engagedNoFollowUp(), expiringSoon()]);
  return [...f, ...g, ...h, ...i];
}
