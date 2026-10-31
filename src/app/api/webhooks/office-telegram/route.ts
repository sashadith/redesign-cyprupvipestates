// Office bot webhook (lead reminders, 2026-10-31). Registered with setWebhook + secret token
// (OFFICE_TELEGRAM_WEBHOOK_SECRET); Telegram sends it back in X-Telegram-Bot-Api-Secret-Token.
//  - bot or secret missing → 404; wrong/missing secret → 401 (constant-time compare);
//  - after auth always 200 (Telegram would otherwise retry), errors logged without message text;
//  - handles: the "Tomorrow" / "+3 days" buttons (private chats and the office group), and in private chats
//    /start <code> (link to a CRM user, code from /crm/settings/telegram) and /stop. Everything else is ignored.
import { NextRequest, NextResponse } from "next/server";
import { makeChatLimiter } from "@/lib/partner/telegram";
import { MAX_UPDATE_BYTES, extractPrivateText, secretMatches } from "@/lib/partner/telegramBot";
import { extractNagCallback, parseNagCallback, parseOfficeCommand } from "@/lib/crm/leadNag";
import { handleNagSnooze, linkTelegramChat, unlinkTelegram } from "@/lib/crm/leadNagSend";
import { answerOfficeCallback, officeBotConfig, sendOfficeMessage } from "@/lib/crm/officeBot";

export const dynamic = "force-dynamic";

const chatLimiter = makeChatLimiter();
const ok = () => NextResponse.json({ ok: true });

const LINK_HELP = "To get lead reminders here, open CVE Office → your name (top right) → Telegram reminders, and press Connect.";

export async function POST(req: NextRequest) {
  const cfg = officeBotConfig();
  if (!cfg?.secret) return NextResponse.json({ ok: false }, { status: 404 });
  if (!secretMatches(req.headers.get("x-telegram-bot-api-secret-token"), cfg.secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const declared = Number(req.headers.get("content-length") ?? "");
    if (Number.isFinite(declared) && declared > MAX_UPDATE_BYTES) return ok();
    const raw = await req.text();
    if (raw.length > MAX_UPDATE_BYTES) return ok();
    let update: unknown;
    try {
      update = JSON.parse(raw);
    } catch {
      return ok();
    }
    const now = new Date();
    const cb = extractNagCallback(update);
    if (cb) {
      if (!chatLimiter.hit(cb.chatId)) return ok();
      const snooze = parseNagCallback(cb.data);
      if (!snooze) {
        await answerOfficeCallback(cb.id, "");
        return ok();
      }
      await handleNagSnooze({
        callbackId: cb.id, chatId: cb.chatId, messageId: cb.messageId, keyboard: cb.keyboard,
        leadId: snooze.leadId, days: snooze.days, byName: cb.fromName, now,
      });
      return ok();
    }
    const msg = extractPrivateText(update);
    if (!msg || !chatLimiter.hit(msg.chatId)) return ok();
    const cmd = parseOfficeCommand(msg.text);
    if (cmd.stop) {
      const was = await unlinkTelegram({ chatId: msg.chatId });
      await sendOfficeMessage(msg.chatId, was ? "Disconnected. You will get no more lead reminders here." : LINK_HELP);
    } else if (cmd.start) {
      const linked = await linkTelegramChat(cmd.start, msg.chatId, now);
      await sendOfficeMessage(
        msg.chatId,
        linked
          ? `✅ Connected to CVE Office as <b>${linked.name.replace(/[<>&]/g, "")}</b>.\nYour lead reminders come here at 10:00, 12:00, 15:00 and 18:00. Send /stop to disconnect.`
          : "This link has expired or was already used. Create a new one in CVE Office → Telegram reminders.",
      );
    } else {
      await sendOfficeMessage(msg.chatId, LINK_HELP);
    }
  } catch (err) {
    console.error("[office telegram webhook]", err instanceof Error ? err.name : "error");
  }
  return ok();
}
