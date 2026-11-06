import "server-only";
import { prisma } from "@/lib/prisma";
import { dealAlertChat } from "./dealAlert";

// Where the office hears about a partner's pipeline (deal alert, handover request):
// the partner's manager when linked to the office bot, else the owner, else nobody.

export const crmLeadUrl = (leadId: string) =>
  `${(process.env.NEXT_PUBLIC_SITE_URL || "https://cyprusvipestates.com").replace(/\/+$/, "")}/crm/leads/${encodeURIComponent(leadId)}`;

export async function managerChatId(partnerId: string): Promise<string | null> {
  const [partner, owner] = await Promise.all([
    prisma.partner.findUnique({ where: { id: partnerId }, select: { manager: { select: { telegramChatId: true, isActive: true } } } }),
    prisma.user.findFirst({ where: { isOwner: true, isActive: true, telegramChatId: { not: null } }, select: { telegramChatId: true } }),
  ]);
  return dealAlertChat(partner?.manager ?? null, owner);
}
