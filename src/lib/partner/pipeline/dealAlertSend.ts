import "server-only";
import { prisma } from "@/lib/prisma";
import { sendOfficeMessage } from "@/lib/crm/officeBot";
import type { PartnerActor } from "@/lib/crm/leadActor";
import type { LeadStatusValue } from "@/lib/crm/leadStatus";
import { dealAlertChat, dealAlertHtml } from "./dealAlert";

const crmBase = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://cyprusvipestates.com").replace(/\/+$/, "");

// Tells the manager (fallback: the owner) that the partner set RESERVED/CLOSED, with the
// lead's newest live deal. Best effort: never throws, so the move it follows never fails on it.
export async function sendDealAlert(actor: PartnerActor, leadId: string, stage: LeadStatusValue): Promise<void> {
  try {
    const [partner, lead, deal, owner] = await Promise.all([
      prisma.partner.findUnique({ where: { id: actor.partnerId }, select: { manager: { select: { telegramChatId: true, isActive: true } } } }),
      prisma.lead.findUnique({ where: { id: leadId }, select: { firstName: true, lastName: true } }),
      prisma.deal.findFirst({
        where: { leadId, commissionStatus: { not: "CANCELLED" } },
        orderBy: { createdAt: "desc" },
        select: { price: true, unitLabel: true, development: { select: { publicName: true } } },
      }),
      prisma.user.findFirst({ where: { isOwner: true, isActive: true, telegramChatId: { not: null } }, select: { telegramChatId: true } }),
    ]);
    const chatId = dealAlertChat(partner?.manager ?? null, owner);
    if (!chatId) {
      console.warn("[partner deal alert] no manager or owner chat linked; skipped", { leadId });
      return;
    }
    const project = deal ? [deal.development?.publicName, deal.unitLabel].filter(Boolean).join(" ") || null : null;
    const html = dealAlertHtml({
      partnerName: actor.userName,
      client: `${lead?.firstName ?? ""} ${lead?.lastName ?? ""}`.trim() || "a client",
      stage,
      project,
      price: deal ? Number(deal.price) : null,
      url: `${crmBase()}/crm/leads/${encodeURIComponent(leadId)}`,
    });
    const r = await sendOfficeMessage(chatId, html);
    if (!r.ok) console.warn("[partner deal alert] send failed", { leadId, status: r.status, description: r.description });
  } catch (e) {
    console.error("[partner deal alert]", e);
  }
}
