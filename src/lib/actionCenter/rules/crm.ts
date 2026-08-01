import { prisma } from "@/lib/prisma";
import type { ActionItem } from "../types";

const DAY = 86_400_000;
const NEW_LEAD_URGENT_HOURS = 24;
const STALE_FOLLOWUP_DAYS = 7;
const ENGAGED_VIEW_THRESHOLD = 3;
const EXPIRING_SOON_DAYS = 7;

const leadName = (l: { firstName: string; lastName: string }) => `${l.firstName} ${l.lastName}`.trim();

// (f+g) merged 2026-07-25 — was two rules with two different (and each
// broken) definitions of "has this lead been followed up on":
//   (f) newLeadNoResponse fired purely on status === NEW + time, completely
//       ignoring whether the lead had actually been contacted — a lead
//       Call-logged, Email-logged, or emailed via Compose today stayed
//       flagged "waiting for a first response" forever as long as no one
//       got around to flipping the status dropdown.
//   (g) staleFollowUp used LeadActivity for "last activity", but
//       addCallLog/addEmailLog/logWhatsAppSentAction only ever write
//       LeadInteraction, never LeadActivity — so even the leads (g) DID
//       cover went stale-looking despite real logged contact, for the
//       same underlying reason.
// Single source of truth now: LeadInteraction with a real human-contact
// type (CALL/EMAIL_OUT/EMAIL_IN/WHATSAPP_OUT/WHATSAPP_IN). Deliberately NOT
// the looser `direction != null` filter the Cockpit's "last contact"
// display uses — caught while verifying against a real lead: the
// automatic SYSTEM row logged when a lead first arrives via the public
// enquiry form also has `direction: "INBOUND"` set (it's how the intake
// itself gets timestamped in the timeline), so that filter alone would
// count "the lead just arrived" as if it were already a real contact,
// permanently masking the URGENT "never contacted" tier and misdating the
// ACTION tier to the lead's creation time instead of any actual outreach.
// A lead with zero real-contact rows is "never contacted" (severity
// URGENT, (f)'s old job); one with at least one is "contacted, is it going
// stale" (severity ACTION, (g)'s old job). Same STALE_FOLLOWUP_DAYS
// threshold as before — no new third number. One stable id per lead
// (`lead-followup:`) regardless of which tier it's in, so a snooze
// survives the lead moving between tiers; old `lead-new:`/`lead-stale:`
// snooze rows just go inert, never wrong.
//
// Batch B (2026-07-25): status flow rework — QUALIFIED is gone, COMMUNICATING
// is new. "Active" now means every non-terminal status (NEW/CONTACTED/
// COMMUNICATING/VIEWING_SCHEDULED/OFFER), not just NEW/CONTACTED/QUALIFIED —
// this closes a real pre-existing gap: a lead that reached VIEWING_SCHEDULED
// or OFFER previously fell out of this rule entirely and could go stale
// without ever triggering a follow-up nudge again.
const REAL_CONTACT_TYPES = ["CALL", "EMAIL_OUT", "EMAIL_IN", "WHATSAPP_OUT", "WHATSAPP_IN"] as const;
// Exported — reused by developers.ts's backInStockReminders() for its lead
// count, so "warm contact" has exactly one definition across the Action Center.
export const ACTIVE_LEAD_STATUSES = ["NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER"] as const;

async function noFollowUp(): Promise<ActionItem[]> {
  const leads = await prisma.lead.findMany({
    where: { status: { in: [...ACTIVE_LEAD_STATUSES] }, deletedAt: null },
    select: {
      id: true, firstName: true, lastName: true, createdAt: true,
      interactions: { where: { type: { in: [...REAL_CONTACT_TYPES] } }, orderBy: { occurredAt: "desc" }, take: 1, select: { occurredAt: true } },
    },
  });
  const items: ActionItem[] = [];
  for (const l of leads) {
    const lastContact = l.interactions[0]?.occurredAt;
    if (!lastContact) {
      const cutoff = Date.now() - NEW_LEAD_URGENT_HOURS * 3_600_000;
      if (l.createdAt.getTime() > cutoff) continue;
      const hours = Math.floor((Date.now() - l.createdAt.getTime()) / 3_600_000);
      items.push({
        id: `lead-followup:${l.id}`, severity: "URGENT", category: "CRM",
        title: `${leadName(l)} is waiting for a first response since ${hours}h`,
        description: "New lead, no contact logged yet.",
        deepLink: `/admin/crm/${l.id}`, since: l.createdAt,
      });
    } else {
      const cutoff = Date.now() - STALE_FOLLOWUP_DAYS * DAY;
      if (lastContact.getTime() > cutoff) continue;
      const days = Math.floor((Date.now() - lastContact.getTime()) / DAY);
      items.push({
        id: `lead-followup:${l.id}`, severity: "ACTION", category: "CRM",
        title: `No follow-up on ${leadName(l)} for ${days} days`,
        description: `Last contact ${days} days ago.`,
        deepLink: `/admin/crm/${l.id}`, since: lastContact,
      });
    }
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
  const [fg, h, i] = await Promise.all([noFollowUp(), engagedNoFollowUp(), expiringSoon()]);
  return [...fg, ...h, ...i];
}
