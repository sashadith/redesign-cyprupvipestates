// Auto-follow-up cadence — Lead Cockpit correction batch. Sets Lead.nextFollowUpAt
// automatically after specific events so a lead doesn't silently go cold, using
// a single counter (Lead.autoFollowUpCount) shared across ALL trigger types,
// capped at 3.
//
// The cap is per "follow-up chain", not a lifetime limit: it resets to 0 —
// starting a fresh chain of 3 — whenever an interaction is logged with
// metadata.leadReacted (the "Lead reacted" checkbox on the manual
// Note/Call/Email/WhatsApp forms, default off; automatic reset on inbound
// email is Phase 3, not this batch), or via the manual "Reset" control in
// the Cockpit (resetFollowUpCadence below). A leadReacted-flagged entry
// resets the counter FIRST, then still applies its own trigger's cadence
// rule against the now-reset counter — it becomes the fresh chain's 1st
// auto-trigger, not a skipped no-op.
//
// A plain manual edit to nextFollowUpAt (updateLeadFollowUp in
// admin/actions.ts) does NOT touch this counter — only resetFollowUpCadence
// does.
import { prisma } from "@/lib/prisma";

export type FollowUpTrigger = "presentation_sent" | "presentation_viewed" | "manual_contact";

const DAY_MS = 86_400_000;
const MAX_AUTO_FOLLOWUPS = 3;

/* A logged call, email or WhatsApp means the lead has been contacted, so NEW
   is no longer true. Set here rather than at each of the four call sites
   (addCallLog, addEmailLog and the two in crm/[id]/emailActions) because this
   is the one function every one of them already goes through, and a fifth
   contact channel added later would otherwise quietly skip it.

   Only NEW is promoted. Every other status is a decision someone made —
   VIEWING_SCHEDULED, NEGOTIATING, KEEP_CONTACT — and logging a call must never
   walk one of those backwards to CONTACTED.

   NOTE deliberately does not reach here: addLeadNote writes no cadence trigger,
   and an internal note is work on the lead, not contact with it. The same
   distinction the rest of the CRM already draws (LAST_CONTACT_TYPES excludes
   NOTE, so does REAL_CONTACT_TYPES in actionCenter/rules/crm.ts).

   Writes the same two timeline rows updateLeadStatus does, with the same
   metadata.toStatus the Action Center reads — a status that changed itself
   must be as visible and as machine-readable as one a human clicked. */
async function promoteNewToContacted(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { status: true } });
  if (lead?.status !== "NEW") return;
  const content = "Status changed to CONTACTED (contact logged)";
  await prisma.lead.update({ where: { id: leadId }, data: { status: "CONTACTED" } });
  await prisma.leadActivity.create({
    data: { leadId, type: "STATUS_CHANGE", content, createdBy: "system" },
  });
  await prisma.leadInteraction.create({
    data: {
      leadId,
      type: "STATUS_CHANGE",
      channel: "SYSTEM",
      body: content,
      metadata: { toStatus: "CONTACTED", automatic: true },
      createdByName: "system",
    },
  });
}

export async function applyFollowUpCadence(
  leadId: string,
  trigger: FollowUpTrigger,
  opts?: { leadReacted?: boolean },
): Promise<void> {
  // Before the early returns below: the cap and the leadReacted branches both
  // return without touching the lead, and a contact still happened either way.
  if (trigger === "manual_contact") await promoteNewToContacted(leadId);

  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { autoFollowUpCount: true } });
  if (!lead) return;

  let count = lead.autoFollowUpCount;
  if (opts?.leadReacted) count = 0; // fresh chain starts here

  if (count >= MAX_AUTO_FOLLOWUPS) {
    // Cap reached — automation stays silent. Still persist a leadReacted
    // reset even though this particular trigger won't itself set a date,
    // so the NEXT trigger after this one starts the fresh chain instead.
    if (opts?.leadReacted) {
      await prisma.lead.update({ where: { id: leadId }, data: { autoFollowUpCount: 0 } });
    }
    return;
  }

  const days =
    trigger === "presentation_sent" ? 3
    : trigger === "presentation_viewed" ? 2
    // manual_contact: 1st automatic trigger in the chain = 7 days, every
    // subsequent one (2nd, 3rd) = 14 days.
    : count === 0 ? 7 : 14;

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      nextFollowUpAt: new Date(Date.now() + days * DAY_MS),
      autoFollowUpCount: count + 1,
    },
  });
}

// The Cockpit's manual "Reset" control — clears the chain without touching
// nextFollowUpAt itself (an admin might want to keep whatever date is
// currently set while still declaring "give this lead a fresh chain of 3").
export async function resetFollowUpCadence(leadId: string): Promise<void> {
  await prisma.lead.update({ where: { id: leadId }, data: { autoFollowUpCount: 0 } });
}
