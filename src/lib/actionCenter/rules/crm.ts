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

// Status-plausibility split (2026-08-09, Konstantin Brenngold incident): a
// lead can sit at NEW or CONTACTED purely because an admin flipped the
// dropdown — no real conversation required, so "no contact logged yet" is
// still plausibly true and stays URGENT there. COMMUNICATING/
// VIEWING_SCHEDULED/OFFER structurally imply prior real engagement (you
// don't reach an ongoing dialogue, a scheduled viewing, or an offer without
// having actually talked to the lead) — Konstantin sat at VIEWING_SCHEDULED
// while flagged "New lead, no contact logged yet" for 3380+ hours; the real
// contact existed (a WhatsApp message) but was logged as a NOTE before the
// proper WhatsApp-logging tool existed (built 2026-07-23, see
// logWhatsAppSentAction). For these three statuses "no REAL_CONTACT_TYPES
// row" is far more likely a logging gap than a genuinely untouched lead, so
// it never reaches URGENT: recent activity of ANY kind (a note, a status
// change — not just a real-contact type) suppresses the item entirely;
// once that goes stale too, it's ACTION with honest wording, never URGENT.
const ELEVATED_NO_CONTACT_STATUSES = ["COMMUNICATING", "VIEWING_SCHEDULED", "OFFER"] as const;
type ElevatedStatus = (typeof ELEVATED_NO_CONTACT_STATUSES)[number];
const isElevatedStatus = (s: string): s is ElevatedStatus => (ELEVATED_NO_CONTACT_STATUSES as readonly string[]).includes(s);

// The "recent activity of any kind" anchor (below) must stay restricted to
// REAL_CONTACT_TYPES + NOTE. STATUS_CHANGE/SYSTEM rows are written purely by
// admin actions (updateLeadStatus, updateLead, updateAssignment, mergeLeads,
// soft-delete/restore) — an admin editing a lead is not customer contact, and
// counting it would let routine admin housekeeping permanently silence a
// stale-contact warning just by touching the lead every few days.
const RECENT_ACTIVITY_TYPES = [...REAL_CONTACT_TYPES, "NOTE"] as const;

// Human-readable status for the item text — was hard-coded to "New lead"
// regardless of actual status (misleading for e.g. a VIEWING_SCHEDULED lead
// like Konstantin); now always names the real status.
const STATUS_LABEL: Record<string, string> = {
  NEW: "New", CONTACTED: "Contacted", COMMUNICATING: "Communicating",
  VIEWING_SCHEDULED: "Viewing scheduled", OFFER: "Offer",
};

async function noFollowUp(): Promise<ActionItem[]> {
  const leads = await prisma.lead.findMany({
    where: { status: { in: [...ACTIVE_LEAD_STATUSES] }, deletedAt: null },
    select: {
      id: true, firstName: true, lastName: true, createdAt: true, status: true,
      interactions: { where: { type: { in: [...REAL_CONTACT_TYPES] } }, orderBy: { occurredAt: "desc" }, take: 1, select: { occurredAt: true } },
    },
  });

  // Second pass, only for elevated-status leads with no real contact: their
  // most recent activity of ANY type decides suppress-vs-ACTION. Batched
  // into one groupBy rather than N+1 per-lead queries.
  const elevatedNoContactIds = leads
    .filter((l) => isElevatedStatus(l.status) && !l.interactions[0])
    .map((l) => l.id);
  const lastAnyActivity = new Map<string, Date>();
  if (elevatedNoContactIds.length) {
    const rows = await prisma.leadInteraction.groupBy({
      by: ["leadId"],
      where: { leadId: { in: elevatedNoContactIds }, type: { in: [...RECENT_ACTIVITY_TYPES] } },
      _max: { occurredAt: true },
    });
    for (const r of rows) if (r._max.occurredAt) lastAnyActivity.set(r.leadId, r._max.occurredAt);
  }

  const items: ActionItem[] = [];
  for (const l of leads) {
    const lastContact = l.interactions[0]?.occurredAt;
    const statusLabel = STATUS_LABEL[l.status] ?? l.status;
    if (!lastContact) {
      if (isElevatedStatus(l.status)) {
        const anchor = lastAnyActivity.get(l.id) ?? l.createdAt;
        const cutoff = Date.now() - STALE_FOLLOWUP_DAYS * DAY;
        if (anchor.getTime() > cutoff) continue; // recent activity of any kind — suppressed entirely
        const days = Math.floor((Date.now() - anchor.getTime()) / DAY);
        items.push({
          id: `lead-followup:${l.id}`, severity: "ACTION", category: "CRM",
          title: `No follow-up on ${leadName(l)} for ${days} days`,
          description: `${statusLabel}, but no contact logged in ${days} days.`,
          deepLink: `/admin/crm/${l.id}`, since: anchor,
        });
        continue;
      }
      const cutoff = Date.now() - NEW_LEAD_URGENT_HOURS * 3_600_000;
      if (l.createdAt.getTime() > cutoff) continue;
      const hours = Math.floor((Date.now() - l.createdAt.getTime()) / 3_600_000);
      items.push({
        id: `lead-followup:${l.id}`, severity: "URGENT", category: "CRM",
        title: `${leadName(l)} is waiting for a first response since ${hours}h`,
        description: `${statusLabel}, no contact logged yet.`,
        deepLink: `/admin/crm/${l.id}`, since: l.createdAt,
      });
    } else {
      const cutoff = Date.now() - STALE_FOLLOWUP_DAYS * DAY;
      if (lastContact.getTime() > cutoff) continue;
      const days = Math.floor((Date.now() - lastContact.getTime()) / DAY);
      items.push({
        id: `lead-followup:${l.id}`, severity: "ACTION", category: "CRM",
        title: `No follow-up on ${leadName(l)} for ${days} days`,
        description: `${statusLabel}. Last contact ${days} days ago.`,
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
