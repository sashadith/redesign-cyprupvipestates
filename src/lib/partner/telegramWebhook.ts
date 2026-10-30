// Partner Telegram bot — command dispatch for the webhook route (phase 3e, Task 3). Server-only.
// The partner is identified ONLY by the chat the message came from (Partner.telegramChatId); nothing in
// the message text can select another partner. Replies carry only the linked partner's own data.
import "server-only";
import { prisma } from "@/lib/prisma";
import { writePartnerAudit } from "./audit";
import { COMMISSION_STAGES } from "./clientDto";
import { partnerCreditNotesWhere } from "./commissions";
import { dict, fmt, pickPartnerLocale, type PartnerLocale } from "./i18n";
import { newProjectUrl } from "./digest";
import { partnerBaseUrl } from "./mail";
import { formatPayoutAmount, formatShare, partnerDate } from "./notify";
import { quietWindow } from "./notifyPrefs";
import { getMyClient, listMyClients, myCommissions, myOverview, projectRates, recentlyPublishedProjects } from "./scope";
import { STATUS_LIST_MAX, buildBotReply, normalizeLinkCode, parseBotCommand, type BotReplyData, type BotReplyKind } from "./telegram";
import { answerPartnerCallback, editPartnerTelegram, sendPartnerTelegram } from "./telegramApi";
import {
  CLIENTS_PER_PAGE, CLIENT_PAGES_MAX, channelScreen, clientScreen, clientsScreen, commissionScreen, keyboardAction, keyboardMessage, languageScreen,
  linkScreen, mainMenu, notifyScreen, overviewScreen, parseMenuAction, projectsScreen, quietScreen, settingsScreen, type KeyboardAction, type MenuAction,
  type MenuScreen, type SettingsData,
} from "./telegramMenu";
import { myTierStatus } from "./tierStore";
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
      if (!linkedLocale) return reply(chatId, locale, "invalidCode");
      await reply(chatId, linkedLocale, "linked");
      return sendMenu(chatId, linkedLocale);
    }
    return linked && linked.status === "ACTIVE" ? sendMenu(chatId, locale) : reply(chatId, "en", "notLinked");
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
    case "menu":
      return sendMenu(chatId, locale);
    case "status":
      return reply(chatId, locale, "status", await statusData(linked.id));
    case "commission":
      return reply(chatId, locale, "commission", await commissionData(linked.id, locale));
    default: {
      // A press on the persistent menu arrives as its label text.
      const ka = cmd === "unknown" ? keyboardAction(text) : null;
      return ka ? handleKeyboard(chatId, ka, now) : reply(chatId, locale, "help");
    }
  }
}

// ── Menu (notifications v2) ─────────────────────────────────────────────────

/** Installs (or refreshes) the persistent menu under the message field. */
async function sendMenu(chatId: string, locale: PartnerLocale): Promise<void> {
  const m = keyboardMessage(locale);
  const r = await sendPartnerTelegram(chatId, m.html, m.keyboard);
  if (!r.ok) console.error("[partner-telegram] menu failed", r.status, r.description);
}

const KEYBOARD_SCREEN: Record<Exclude<KeyboardAction, "submit" | "portal">, MenuAction> = {
  overview: { a: "overview" }, clients: { a: "clients", page: 1 }, commission: { a: "commission" }, projects: { a: "projects" }, settings: { a: "settings" },
};

/** A persistent-menu press: the screen goes out as a new message (its own buttons then edit that message). */
async function handleKeyboard(chatId: string, action: KeyboardAction, now: Date): Promise<void> {
  const p = await loadMenuPartner(chatId);
  if (!p || p.status !== "ACTIVE") return reply(chatId, "en", "notLinked");
  const locale = pickPartnerLocale({ partnerLanguage: String(p.language) });
  const screen = action === "submit" || action === "portal"
    ? linkScreen(locale, action, portalUrl())
    : await screenFor(p, locale, KEYBOARD_SCREEN[action], now);
  const r = await sendPartnerTelegram(chatId, screen.html, screen.keyboard);
  if (!r.ok) console.error("[partner-telegram] menu screen failed", r.status, r.description);
}

const MENU_PARTNER_SELECT = {
  id: true, status: true, language: true, notifyChannel: true, quietFrom: true, quietTo: true, digestOptIn: true,
  notifyClients: true, notifyNewProjects: true, notifyProjectUpdates: true, notifyReminders: true,
  handoverShare: true, fixShare: true,
} as const;

type MenuPartner = NonNullable<Awaited<ReturnType<typeof loadMenuPartner>>>;

function loadMenuPartner(chatId: string) {
  return prisma.partner.findUnique({ where: { telegramChatId: chatId }, select: MENU_PARTNER_SELECT });
}

function settingsOf(p: MenuPartner, locale: PartnerLocale): SettingsData {
  return {
    language: locale,
    quiet: quietWindow(p.quietFrom, p.quietTo),
    channel: p.notifyChannel,
    switches: {
      notifyClients: p.notifyClients, notifyNewProjects: p.notifyNewProjects, notifyProjectUpdates: p.notifyProjectUpdates,
      notifyReminders: p.notifyReminders, digestOptIn: p.digestOptIn,
    },
  };
}

/** Applies a settings change for the chat's own partner; returns the partner as stored afterwards. */
async function applySetting(p: MenuPartner, action: MenuAction): Promise<MenuPartner> {
  const where = { id: p.id };
  switch (action.a) {
    case "setLang":
      return prisma.partner.update({ where, data: { language: action.locale }, select: MENU_PARTNER_SELECT });
    case "setQuiet":
      return prisma.partner.update({
        where, data: { quietFrom: action.window?.[0] ?? null, quietTo: action.window?.[1] ?? null }, select: MENU_PARTNER_SELECT,
      });
    case "toggle":
      return prisma.partner.update({ where, data: { [action.key]: !p[action.key] }, select: MENU_PARTNER_SELECT });
    case "setChannel":
      return prisma.partner.update({ where, data: { notifyChannel: action.channel }, select: MENU_PARTNER_SELECT });
    default:
      return p;
  }
}

async function screenFor(p: MenuPartner, locale: PartnerLocale, action: MenuAction, now: Date): Promise<MenuScreen> {
  const portal = portalUrl();
  switch (action.a) {
    case "main":
      return mainMenu(locale, portal);
    case "overview": {
      const [ov, tier] = await Promise.all([myOverview(p.id), myTierStatus(p.id, now).catch(() => null)]);
      return overviewScreen(locale, {
        counts: ov.counts,
        commission: Object.entries(ov.commission).filter(([, v]) => v > 0).map(([stage, v]) => ({ stage, amount: formatPayoutAmount(locale, v) })),
        tier: tier
          ? {
              name: tier.progress.current.name,
              next: tier.progress.next && tier.progress.remaining > 0 ? { name: tier.progress.next.name, remaining: tier.progress.remaining } : null,
            }
          : null,
      });
    }
    case "clients": {
      const list = await listMyClients(p.id, { filter: "active" });
      const active = list.items.filter((c) => c.state === "ACTIVE");
      const pages = Math.max(1, Math.min(CLIENT_PAGES_MAX, Math.ceil(active.length / CLIENTS_PER_PAGE)));
      const page = Math.min(action.page, pages);
      return clientsScreen(locale, {
        items: active.slice((page - 1) * CLIENTS_PER_PAGE, page * CLIENTS_PER_PAGE).map((c) => ({ id: c.id, name: c.name, stageKey: c.chipKey })),
        page, pages,
        more: list.pages > 1 || active.length > CLIENT_PAGES_MAX * CLIENTS_PER_PAGE,
      });
    }
    case "client": {
      // getMyClient is scoped to this partner: another partner's claim id reads as missing.
      const c = await getMyClient(p.id, action.id);
      if (!c) return clientsScreen(locale, { items: [], page: 1, pages: 1, more: false });
      return clientScreen(locale, {
        name: c.name, stageKey: c.chipKey,
        protectedUntil: c.kind === "active" && !c.protection.expired ? partnerDate(locale, c.protection.until) : null,
        url: portal ? `${portal}/clients/${encodeURIComponent(c.id)}` : "",
      });
    }
    case "commission": {
      const d = await commissionData(p.id, locale);
      const b = dict(locale).telegram.bot;
      return commissionScreen(locale, {
        totals: d.totals ?? [],
        lastPayout: d.lastPayout ? fmt(b.lastPayout, { amount: d.lastPayout.amount, number: d.lastPayout.creditNoteNumber }) : null,
      });
    }
    case "projects": {
      const pub = await recentlyPublishedProjects(now, new Date(now.getTime() - 30 * 86_400_000), 5);
      const rates = projectRates(pub.rows, pub.rates, { handoverShare: Number(p.handoverShare), fixShare: Number(p.fixShare), trustMode: false });
      const t = dict(locale).digest;
      const byId = new Map(rates.map((r) => [r.id, r]));
      return projectsScreen(locale, {
        items: pub.rows.flatMap((r) => {
          const pr = byId.get(r.id);
          if (!pr || !r.slug) return [];
          return [{
            name: pr.name, town: pr.town, url: newProjectUrl(locale, r.slug),
            detail: pr.handoverRate == null ? t.onRequest : fmt(t.rate, { rate: formatShare(locale, pr.handoverRate) }),
          }];
        }),
      });
    }
    case "settings":
    case "setLang":
    case "setQuiet":
    case "setChannel":
      return settingsScreen(locale, settingsOf(p, locale), action.a !== "settings");
    case "lang":
      return languageScreen(locale, locale);
    case "quiet":
      return quietScreen(locale, quietWindow(p.quietFrom, p.quietTo));
    case "notify":
    case "toggle":
      return notifyScreen(locale, settingsOf(p, locale).switches);
    case "channel":
      return channelScreen(locale, p.notifyChannel);
    default:
      return mainMenu(locale, portal);
  }
}

/**
 * Handles one menu button press (already authenticated and rate-limited by the route). The partner is the
 * chat's linked partner only; the menu message is edited in place (a new one is sent if it cannot be).
 */
export async function handlePartnerBotCallback(cb: { id: string; chatId: string; messageId: number; data: string }, now: Date = new Date()): Promise<void> {
  const found = await loadMenuPartner(cb.chatId);
  if (!found || found.status !== "ACTIVE") {
    await answerPartnerCallback(cb.id);
    return reply(cb.chatId, "en", "notLinked");
  }
  let p: MenuPartner = found;
  const action = parseMenuAction(cb.data);
  if (!action) {
    await answerPartnerCallback(cb.id, dict(pickPartnerLocale({ partnerLanguage: String(p.language) })).telegram.menu.expired);
    return;
  }
  p = await applySetting(p, action);
  const locale = pickPartnerLocale({ partnerLanguage: String(p.language) });
  const changed = action.a === "setLang" || action.a === "setQuiet" || action.a === "toggle" || action.a === "setChannel";
  await answerPartnerCallback(cb.id, changed ? dict(locale).telegram.menu.saved : undefined);
  const screen = await screenFor(p, locale, action, now);
  if (!(await editPartnerTelegram(cb.chatId, cb.messageId, screen.html, screen.keyboard))) {
    const r = await sendPartnerTelegram(cb.chatId, screen.html, screen.keyboard);
    if (!r.ok) console.error("[partner-telegram] menu screen failed", r.status, r.description);
  }
  // A new language relabels the persistent menu.
  if (action.a === "setLang") await sendMenu(cb.chatId, locale);
}
