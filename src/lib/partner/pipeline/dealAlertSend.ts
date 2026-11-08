import "server-only";
import { prisma } from "@/lib/prisma";
import { sendOfficeMessage } from "@/lib/crm/officeBot";
import type { PartnerActor } from "@/lib/crm/leadActor";
import type { LeadStatusValue } from "@/lib/crm/leadStatus";
import { dealAlertHtml } from "./dealAlert";
import { crmLeadUrl, managerChatId } from "./managerChat";

// Tells the manager (fallback: the owner) that the partner set RESERVED/CLOSED, with the
// lead's newest live deal. Best effort: never throws, so the move it follows never fails on it.
export async function sendDealAlert(actor: PartnerActor, leadId: string, stage: LeadStatusValue): Promise<void> {
  try {
    const [chatId, lead, deal] = await Promise.all([
      managerChatId(actor.partnerId),
      prisma.lead.findUnique({ where: { id: leadId }, select: { firstName: true, lastName: true } }),
      prisma.deal.findFirst({
        where: { leadId, commissionStatus: { not: "CANCELLED" } },
        orderBy: { createdAt: "desc" },
        select: { price: true, unitLabel: true, projectName: true, development: { select: { publicName: true } } },
      }),
    ]);
    if (!chatId) {
      console.warn("[partner deal alert] no manager or owner chat linked; skipped", { leadId });
      return;
    }
    const project = deal ? [deal.development?.publicName ?? deal.projectName, deal.unitLabel].filter(Boolean).join(" ") || null : null;
    const html = dealAlertHtml({
      partnerName: actor.userName,
      client: `${lead?.firstName ?? ""} ${lead?.lastName ?? ""}`.trim() || "a client",
      stage,
      project,
      price: deal ? Number(deal.price) : null,
      url: crmLeadUrl(leadId),
    });
    const r = await sendOfficeMessage(chatId, html);
    if (!r.ok) console.warn("[partner deal alert] send failed", { leadId, status: r.status, description: r.description });
  } catch (e) {
    console.error("[partner deal alert]", e);
  }
}
