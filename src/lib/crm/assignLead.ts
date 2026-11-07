import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { leadLabel } from "@/lib/chatPrivacy";
import { sendEmail } from "@/lib/sendEmail";
import { canAssignLeads, PARTNER_WORKED_READONLY } from "./access";
import { EXCLUDE_NEWSLETTER } from "./leadBucket";
import type { SessionCrmUser } from "./session";
import type { AssignResult } from "./assignMessage";

export const DOWNLOAD_NOT_ASSIGNABLE = "This is a download, not a lead. Use \"Take over as lead\" first (Inbox → Downloads).";

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

// Same base URL as src/lib/leadNotify.ts and metaLeadgen/notify.ts (not
// imported: notify.ts pulls the WhatsApp stack), but the link opens the lead in
// the new CRM cockpit: restricted employees are kept out of the old CRM.
const leadUrl = (leadId: string) => `${process.env.NEXT_PUBLIC_SITE_URL || "http://72.60.89.239"}/crm/leads/${leadId}`;

export async function assignLead(actor: SessionCrmUser, leadId: string, userId: string): Promise<AssignResult> {
  if (!canAssignLeads(actor)) return { error: "Only admins can assign leads." };
  const [lead, owner] = await Promise.all([
    // Deleted and newsletter leads never appear in the inbox; refuse them here too.
    prisma.lead.findFirst({ where: { id: leadId, deletedAt: null, ...EXCLUDE_NEWSLETTER }, select: { id: true, firstName: true, lastName: true, assignedToId: true, workedByPartner: true, source: true } }),
    prisma.user.findFirst({ where: { id: userId, isActive: true }, select: { id: true, name: true, email: true } }),
  ]);
  if (!lead) return { error: "Lead not found." };
  // The partner works this client until the handover: no new owner meanwhile.
  if (lead.workedByPartner) return { error: PARTNER_WORKED_READONLY };
  // Downloads get no owner (operator, 2026-11-07): take one over as a lead first.
  if (lead.source === "GUIDE_DOWNLOAD") return { error: DOWNLOAD_NOT_ASSIGNABLE };
  if (!owner) return { error: "That employee is not active." };
  if (lead.assignedToId === owner.id) return { ok: true, notified: { telegram: false, email: false }, changed: false };

  // Compare-and-set on the owner we read: if someone assigned the lead in the
  // meantime nothing is written and nobody is notified.
  const { count } = await prisma.lead.updateMany({ where: { id: leadId, assignedToId: lead.assignedToId }, data: { assignedToId: owner.id } });
  if (count === 0) return { error: "Someone else assigned this lead a moment ago — reload." };
  await prisma.leadInteraction.create({
    data: {
      leadId, type: "SYSTEM", channel: "SYSTEM",
      body: `Assigned to ${owner.name}`,
      metadata: { assignedToId: owner.id, assignedById: actor.id, via: "crm-v2" },
      createdByUserId: actor.id, createdByName: actor.name,
    },
  });

  const leadName = `${lead.firstName} ${lead.lastName}`.trim();
  const url = leadUrl(lead.id);
  // Notifications must never undo the assignment: failures are logged, not thrown.
  const [tg, mail] = await Promise.allSettled([
    sendTelegramMessage(`👤 <b>${esc(owner.name)}</b> takes <b>${esc(leadLabel(lead, lead.id))}</b> (assigned by ${esc(actor.name)})\n${esc(url)}`),
    sendEmail({ to: owner.email, subject: `New lead for you: ${leadName}`, text: `${actor.name} assigned ${leadName} to you.\n\nOpen the lead: ${url}` }),
  ]);
  for (const r of [tg, mail]) if (r.status === "rejected") console.error("[crm assign notify]", r.reason);
  // sendTelegramMessage resolves null when Telegram is not configured: not sent.
  return {
    ok: true,
    notified: { telegram: tg.status === "fulfilled" && tg.value != null, email: mail.status === "fulfilled" },
    changed: true,
  };
}
