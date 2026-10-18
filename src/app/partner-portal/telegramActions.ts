"use server";
/**
 * Phase 3e: connect / disconnect the partner Telegram bot. Scoped to the session's own partner
 * (requirePartner({ active: true })) — never an id from the form. The link code is returned once and
 * stored only as a hash; the chat id never leaves the server.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writePartnerAudit } from "@/lib/partner/audit";
import { partnerLimits as L } from "@/lib/partner/limits";
import { requirePartner } from "@/lib/partner/session";
import { LINK_CODE_TTL_MINUTES, newLinkCode } from "@/lib/partner/telegram";
import { partnerBotConfig } from "@/lib/partner/telegramApi";
import { telegramDeepLink } from "@/lib/partner/telegramBot";
import type { TelegramCodeState } from "./formState";

export async function createTelegramCodeAction(_prev: TelegramCodeState, _fd: FormData): Promise<TelegramCodeState> {
  const me = await requirePartner({ active: true });
  const cfg = partnerBotConfig();
  if (!cfg) return { error: "telegram.card.notAvailable" };
  if (!L.telegramCode.hit(me.partner.id)) return { error: "err.rateLimited" };
  const { code, hash } = newLinkCode();
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    // Only the newest code works: older unused ones expire now.
    await tx.partnerTelegramCode.updateMany({ where: { partnerId: me.partner.id, usedAt: null, expiresAt: { gt: now } }, data: { expiresAt: now } });
    await tx.partnerTelegramCode.create({
      data: { partnerId: me.partner.id, codeHash: hash, expiresAt: new Date(now.getTime() + LINK_CODE_TTL_MINUTES * 60_000) },
    });
  });
  return { ok: true, code, link: telegramDeepLink(cfg.username, code) };
}

export async function disconnectTelegramAction(): Promise<void> {
  const me = await requirePartner({ active: true });
  await prisma.$transaction(async (tx) => {
    await tx.partner.update({
      where: { id: me.partner.id },
      data: { telegramChatId: null, telegramLinkedAt: null, notifyChannel: "EMAIL" },
    });
    await tx.partnerTelegramCode.updateMany({ where: { partnerId: me.partner.id, usedAt: null }, data: { expiresAt: new Date() } });
    await writePartnerAudit(me.partner, me.user, "partner_telegram_unlinked", {}, tx);
  });
  revalidatePath("/partner-portal/profile");
}
