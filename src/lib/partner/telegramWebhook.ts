// Partner Telegram bot — command dispatch for the webhook route (phase 3e, Task 3). Server-only.
// The partner is identified ONLY by the chat the message came from (Partner.telegramChatId); nothing in
// the message text can select another partner. Replies carry only the linked partner's own data.
import "server-only";
import { prisma } from "@/lib/prisma";
import { writePartnerAudit } from "./audit";
import { COMMISSION_STAGES } from "./clientDto";
import { partnerCreditNotesWhere } from "./commissions";
import { pickPartnerLocale, type PartnerLocale } from "./i18n";
import { partnerBaseUrl } from "./mail";
import { formatPayoutAmount } from "./notify";
import { listMyClients, myCommissions } from "./scope";
import { STATUS_LIST_MAX, buildBotReply, normalizeLinkCode, parseBotCommand, type BotReplyData, type BotReplyKind } from "./telegram";
import { sendPartnerTelegram } from "./telegramApi";
import { hashToken } from "./tokens";

const portalUrl = () => {
  try {
    return partnerBaseUrl();
  } catch {
    return "";
  }
};

type LinkedPartner = { id: string; status: string; language: string };

async function reply(chatId: string, locale: PartnerLocale, kind: BotReplyKind, data: BotReplyData = {}): Promise<void> {
  const r = await sendPartnerTelegram(chatId, buildBotReply(locale, { kind, data: { portalUrl: portalUrl(), ...data } }));
  if (!r.ok) console.error("[partner-telegram] reply failed", kind, r.status, r.description);
}

/** /start <code>: consumes the code atomically and links this chat to the code's (ACTIVE) partner. */
async function link(chatId: string, rawCode: string | undefined, now: Date): Promise<PartnerLocale | null> {
  const code = normalizeLinkCode(rawCode);
  if (!code) return null;
  const codeHash = hashToken(code);
  return prisma.$transaction(async (tx) => {
    // Single use: only one request can flip usedAt from null; an expired code is never consumed.
    const used = await tx.partnerTelegramCode.updateMany({ where: { codeHash, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (used.count !== 1) return null;
    const row = await tx.partnerTelegramCode.findUnique({ where: { codeHash }, select: { partnerId: true } });
    if (!row) return null;
    const partner = await tx.partner.findUnique({
      where: { id: row.partnerId },
      select: {
        id: true, status: true, language: true, company: true, firstName: true, lastName: true, notifyChannel: true,
        users: { orderBy: { createdAt: "asc" }, take: 1, select: { email: true } },
      },
    });
    if (!partner || partner.status !== "ACTIVE") return null;
    // One chat ↔ one partner: a chat linked elsewhere is moved (the old partner falls back to email).
    await tx.partner.updateMany({
      where: { telegramChatId: chatId, id: { not: partner.id } },
      data: { telegramChatId: null, telegramLinkedAt: null, notifyChannel: "EMAIL" },
    });
    // Linking switches Telegram on (notifications v2): EMAIL becomes BOTH; an explicit TELEGRAM/BOTH stays.
    await tx.partner.update({
      where: { id: partner.id },
      data: { telegramChatId: chatId, telegramLinkedAt: now, ...(partner.notifyChannel === "EMAIL" ? { notifyChannel: "BOTH" as const } : {}) },
    });
    // Any other code of this partner is spent now as well.
    await tx.partnerTelegramCode.updateMany({ where: { partnerId: partner.id, usedAt: null }, data: { expiresAt: now } });
    await writePartnerAudit(partner, { email: partner.users[0]?.email ?? "" }, "partner_telegram_linked", {}, tx);
    return pickPartnerLocale({ partnerLanguage: String(partner.language) });
  });
}

async function statusData(partnerId: string): Promise<BotReplyData> {
  const list = await listMyClients(partnerId, { filter: "active" });
  const active = list.items.filter((c) => c.state === "ACTIVE");
  // Clients on later pages are not loaded; they are counted (some may still be in review).
  const beyond = list.pages > 1 ? Math.max(0, list.total - list.items.length) : 0;
  return {
    clients: active.slice(0, STATUS_LIST_MAX).map((c) => ({ name: c.name, stageKey: c.chipKey })),
    more: Math.max(0, active.length - STATUS_LIST_MAX) + beyond,
  };
}

async function commissionData(partnerId: string, locale: PartnerLocale): Promise<BotReplyData> {
  const [mine, last] = await Promise.all([
    myCommissions(partnerId, { from: null, to: null }),
    prisma.creditNote.findFirst({
      where: partnerCreditNotesWhere(partnerId),
      orderBy: { issuedAt: "desc" },
      select: { number: true, totalAmount: true },
    }),
  ]);
  return {
    totals: COMMISSION_STAGES.filter((s) => mine.totals[s] > 0).map((s) => ({ stage: s, amount: formatPayoutAmount(locale, mine.totals[s]) })),
    lastPayout: last ? { amount: formatPayoutAmount(locale, last.totalAmount), creditNoteNumber: last.number } : null,
  };
}

/** Handles one private text message (already authenticated, validated and rate-limited by the route). */
export async function handlePartnerBotMessage(chatId: string, text: string, now: Date = new Date()): Promise<void> {
  const { cmd, arg } = parseBotCommand(text);
  const linked: LinkedPartner | null = await prisma.partner
    .findUnique({ where: { telegramChatId: chatId }, select: { id: true, status: true, language: true } })
    .then((p) => (p ? { id: p.id, status: p.status, language: String(p.language) } : null));
  const locale = linked ? pickPartnerLocale({ partnerLanguage: linked.language }) : "en";

  if (cmd === "start") {
    if (arg) {
      const linkedLocale = await link(chatId, arg, now);
      return linkedLocale ? reply(chatId, linkedLocale, "linked") : reply(chatId, locale, "invalidCode");
    }
    return linked && linked.status === "ACTIVE" ? reply(chatId, locale, "help") : reply(chatId, "en", "notLinked");
  }

  if (cmd === "stop") {
    if (!linked) return reply(chatId, "en", "notLinked");
    await prisma.partner.updateMany({
      where: { id: linked.id, telegramChatId: chatId },
      data: { telegramChatId: null, telegramLinkedAt: null, notifyChannel: "EMAIL" },
    });
    return reply(chatId, locale, "unlinked");
  }

  // Everything else needs a linked, ACTIVE partner (a suspended partner's chat gets the neutral reply).
  if (!linked || linked.status !== "ACTIVE") return reply(chatId, "en", "notLinked");
  switch (cmd) {
    case "status":
      return reply(chatId, locale, "status", await statusData(linked.id));
    case "commission":
      return reply(chatId, locale, "commission", await commissionData(linked.id, locale));
    default:
      return reply(chatId, locale, "help");
  }
}
