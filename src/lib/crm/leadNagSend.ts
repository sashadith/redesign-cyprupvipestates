// Lead reminders — DB and Telegram side (the pure rules are in leadNag.ts). Cron entry:
// src/app/api/cron/lead-nag/route.ts (hourly; sends only at the NAG_HOURS, once per Cyprus day and hour).
// Button presses and account linking arrive at src/app/api/webhooks/office-telegram/route.ts.
import "server-only";
import { prisma } from "@/lib/prisma";
import { logCronRun } from "@/lib/cronLog";
import { CONTACT_TYPES } from "@/lib/mcp/leadRow";
import { hashToken, newToken } from "@/lib/partner/tokens";
import { ACTIVE_LEAD_STATUSES } from "./leadStatus";
import { dayKey } from "./today";
import {
  NAG_EXCLUDED_SOURCES, buildNagMessage, maySnooze, nagCounts, nagItems, routeNag, snoozeUntil, withoutLeadRow,
  type InlineButton, type NagLead, type NagUser,
} from "./leadNag";
import { answerOfficeCallback, editOfficeKeyboard, officeBotConfig, sendOfficeMessage } from "./officeBot";

const LEAD_CAP = 3000;
/** A link code is valid this long. */
export const LINK_CODE_TTL_MS = 30 * 60_000;

const crmBase = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://cyprusvipestates.com").replace(/\/+$/, "");

/** Active-funnel leads (not deleted) with the fields the urgency rule reads. */
async function loadNagLeads(where: { assignedToId?: string | null | { in: string[] } } | { OR: object[] } = {}): Promise<NagLead[]> {
  const rows = await prisma.lead.findMany({
    where: { deletedAt: null, status: { in: [...ACTIVE_LEAD_STATUSES] }, source: { notIn: [...NAG_EXCLUDED_SOURCES] }, ...where },
    take: LEAD_CAP,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, firstName: true, lastName: true, status: true, createdAt: true, nextFollowUpAt: true, viewingScheduledAt: true, assignedToId: true,
      interactions: { where: { type: { in: CONTACT_TYPES } }, orderBy: { occurredAt: "desc" }, take: 1, select: { occurredAt: true } },
    },
  });
  return rows.map(({ interactions, ...r }) => ({ ...r, lastContactAt: interactions[0]?.occurredAt ?? null }));
}

const loadUsers = (): Promise<NagUser[]> =>
  prisma.user.findMany({ select: { id: true, name: true, isOwner: true, isActive: true, telegramChatId: true } });

export type NagRunResult = { slot: number; chats: number; leads: number; sent: number; skipped?: string; errors: string[] };

/** One reminder round for `slot` (a NAG_HOURS hour). Runs at most once per Cyprus day and slot unless `force`. */
export async function runLeadNag(now: Date, slot: number, opts: { force?: boolean } = {}): Promise<NagRunResult> {
  const result: NagRunResult = { slot, chats: 0, leads: 0, sent: 0, errors: [] };
  const job = `lead-nag:${dayKey(now)}:${slot}`;
  if (!opts.force && (await prisma.cronRunLog.findFirst({ where: { job, ok: true }, select: { id: true } }))) {
    return { ...result, skipped: "already sent" };
  }
  const cfg = officeBotConfig();
  if (!cfg) return { ...result, skipped: "office bot not configured" };
  const [leads, users] = await Promise.all([loadNagLeads(), loadUsers()]);
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  const routed = routeNag(leads, users, cfg.officeChatId);
  for (const [chatId, box] of Array.from(routed)) {
    const items = nagItems(box.leads, now, () => null).map((i) => {
      const lead = box.leads.find((l) => l.id === i.leadId);
      return box.foreign.has(i.leadId) ? { ...i, ownerName: nameOf.get(lead?.assignedToId ?? "") ?? null } : i;
    });
    const msg = buildNagMessage(items, { slot, crmBase: crmBase() });
    if (!msg) continue;
    result.chats++;
    result.leads += items.length;
    const r = await sendOfficeMessage(chatId, msg.text, msg.keyboard);
    if (r.ok) result.sent++;
    else result.errors.push(`chat …${chatId.slice(-4)}: ${r.status} ${r.description}`);
  }
  await logCronRun(job, result.errors.length === 0, `${result.sent}/${result.chats} chats, ${result.leads} leads`);
  return result;
}

/** Banner and tab counts for a CRM user: their own leads; the owner also sees unassigned ones. Never throws. */
export async function nagCountsFor(user: { id: string; isOwner: boolean }, now: Date): Promise<{ overdue: number; now: number }> {
  try {
    const leads = await loadNagLeads(user.isOwner ? { OR: [{ assignedToId: user.id }, { assignedToId: null }] } : { assignedToId: user.id });
    return nagCounts(nagItems(leads, now));
  } catch (err) {
    console.error("[crm nag counts]", err);
    return { overdue: 0, now: 0 };
  }
}

// ── Buttons ─────────────────────────────────────────────────────────────────

/** "Tomorrow" / "+3 days": moves the follow-up, logs who did it, removes the lead's buttons from the message. */
export async function handleNagSnooze(input: {
  callbackId: string; chatId: string; messageId: number; keyboard: InlineButton[][]; leadId: string; days: number; byName: string; now: Date;
}): Promise<void> {
  const cfg = officeBotConfig();
  const [lead, chatUser] = await Promise.all([
    prisma.lead.findFirst({ where: { id: input.leadId, deletedAt: null }, select: { id: true, firstName: true, lastName: true, assignedToId: true } }),
    prisma.user.findUnique({ where: { telegramChatId: input.chatId }, select: { id: true, name: true, isOwner: true, isActive: true, telegramChatId: true } }),
  ]);
  if (!lead || !maySnooze({ chatId: input.chatId, officeChatId: cfg?.officeChatId ?? null, chatUser, leadAssignedToId: lead.assignedToId })) {
    await answerOfficeCallback(input.callbackId, "Not possible for this lead.");
    return;
  }
  const until = snoozeUntil(input.now, input.days);
  const label = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Nicosia" }).format(until);
  const who = chatUser?.name ?? input.byName;
  await prisma.lead.update({ where: { id: lead.id }, data: { nextFollowUpAt: until } });
  await prisma.leadActivity.create({
    data: { leadId: lead.id, type: "EDIT", content: `Follow-up moved to ${label} from the Telegram reminder`, createdBy: who.slice(0, 120), createdById: chatUser?.id ?? null },
  });
  await answerOfficeCallback(input.callbackId, `${`${lead.firstName} ${lead.lastName}`.trim()}: follow-up ${label}.`);
  await editOfficeKeyboard(input.chatId, input.messageId, withoutLeadRow(input.keyboard, lead.id));
}

// ── Linking a private chat to a CRM user ────────────────────────────────────

/** A fresh single-use link code for the user (the hash is stored, the code shown once). */
export async function createTelegramLinkCode(userId: string, now: Date): Promise<string> {
  const { token, hash } = newToken();
  await prisma.user.update({ where: { id: userId }, data: { telegramLinkHash: hash, telegramLinkExpiresAt: new Date(now.getTime() + LINK_CODE_TTL_MS) } });
  return token;
}

/** /start <code> in a private chat: links the chat to the code's user (moving it off anyone else). */
export async function linkTelegramChat(code: string, chatId: string, now: Date): Promise<{ name: string } | null> {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(code)) return null;
  const user = await prisma.user.findUnique({ where: { telegramLinkHash: hashToken(code) }, select: { id: true, name: true, isActive: true, telegramLinkExpiresAt: true } });
  if (!user || !user.isActive || !user.telegramLinkExpiresAt || user.telegramLinkExpiresAt <= now) return null;
  await prisma.$transaction([
    prisma.user.updateMany({ where: { telegramChatId: chatId, id: { not: user.id } }, data: { telegramChatId: null, telegramLinkedAt: null } }),
    prisma.user.update({ where: { id: user.id }, data: { telegramChatId: chatId, telegramLinkedAt: now, telegramLinkHash: null, telegramLinkExpiresAt: null } }),
  ]);
  return { name: user.name };
}

/** /stop in a private chat, or "Disconnect" in the CRM. */
export async function unlinkTelegram(where: { chatId: string } | { userId: string }): Promise<boolean> {
  const r = await prisma.user.updateMany({
    where: "chatId" in where ? { telegramChatId: where.chatId } : { id: where.userId },
    data: { telegramChatId: null, telegramLinkedAt: null, telegramLinkHash: null, telegramLinkExpiresAt: null },
  });
  return r.count > 0;
}
