import type { ParsedMail } from "mailparser";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { leadLabel } from "@/lib/chatPrivacy";
import { canonicalizeEmail } from "./matchLead";
import type { Bounce } from "./bounce";

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* A hard bounce found by the inbound poller (2026-11-04). The lead is the one our original message
   went to (by its Message-ID), else the one lead whose address is the dead one. Only the lead's
   CURRENT address is marked: a bounce for an address that has since been changed is ignored.
   Writes a NOTE (with the bounce's Message-ID, so a re-poll never doubles it), sets emailInvalidAt
   and, from the live poll, sends a Telegram. */
export async function handleBounce(
  bounce: Bounce, parsed: ParsedMail, internalDate: Date | null, ctx: { notify: boolean },
): Promise<{ status: "filed"; leadId: string; ambiguous: false } | { status: "skipped" }> {
  let leadId: string | null = null;
  if (bounce.originalMessageId) {
    const sent = await prisma.leadInteraction.findFirst({ where: { messageId: bounce.originalMessageId, type: "EMAIL_OUT" }, select: { leadId: true } });
    leadId = sent?.leadId ?? null;
  }
  if (!leadId && bounce.recipient) {
    const rows = await prisma.lead.findMany({ where: { email: { equals: bounce.recipient, mode: "insensitive" }, deletedAt: null }, select: { id: true }, take: 2 });
    if (rows.length === 1) leadId = rows[0].id;
  }
  if (!leadId) return { status: "skipped" };
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, email: true, firstName: true, lastName: true, emailInvalidAt: true } });
  if (!lead?.email) return { status: "skipped" };
  const dead = bounce.recipient ?? lead.email;
  if (canonicalizeEmail(dead) !== canonicalizeEmail(lead.email)) return { status: "skipped" };

  const reason = bounce.reason;
  await prisma.$transaction([
    prisma.leadInteraction.create({
      data: {
        leadId: lead.id, type: "NOTE", channel: null, direction: null,
        body: `Email bounced: ${dead} could not be delivered (${reason}). The address is marked invalid; nothing more is sent to it until it is changed.`,
        occurredAt: parsed.date ?? internalDate ?? new Date(),
        messageId: parsed.messageId || null,
        createdByName: "system",
        metadata: { kind: "email_bounce", recipient: dead, status: bounce.status, originalMessageId: bounce.originalMessageId },
      },
    }),
    prisma.lead.update({ where: { id: lead.id }, data: { emailInvalidAt: lead.emailInvalidAt ?? new Date(), emailInvalidReason: reason } }),
  ]);

  if (ctx.notify) {
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://72.60.89.239";
      await sendTelegramMessage(
        `<b>📭 Email bounced: ${esc(leadLabel(lead, lead.id))}</b>\n${esc(dead)}\n${esc(reason)}\n\nAddress marked invalid. <a href="${siteUrl}/crm/leads/${lead.id}">Open in CRM</a>`,
      );
    } catch (e) {
      console.error("email-inbound: bounce Telegram failed:", e);
    }
  }
  return { status: "filed", leadId: lead.id, ambiguous: false };
}
