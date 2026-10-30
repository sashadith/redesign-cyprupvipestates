// Partner Telegram bot webhook (partner portal phase 3e). Registered by the CRM owner panel via setWebhook
// with a secret token; Telegram sends it back in X-Telegram-Bot-Api-Secret-Token on every update.
//  - bot env missing → 404; wrong/missing secret header → 401 (constant-time compare);
//  - after auth always 200 (Telegram would otherwise retry the update), errors logged without message text;
//  - only text messages and menu button presses from private chats; 64 KB body cap; 30 updates per chat per 10 minutes.
// This is the PARTNER bot; the office bot (src/lib/telegram.ts) is never used here.
import { NextRequest, NextResponse } from "next/server";
import { makeChatLimiter } from "@/lib/partner/telegram";
import { partnerBotConfig } from "@/lib/partner/telegramApi";
import { MAX_UPDATE_BYTES, extractCallback, extractPrivateText, secretMatches } from "@/lib/partner/telegramBot";
import { handlePartnerBotCallback, handlePartnerBotMessage } from "@/lib/partner/telegramWebhook";

export const dynamic = "force-dynamic";

const chatLimiter = makeChatLimiter();
const ok = () => NextResponse.json({ ok: true });

/** Reads the body up to `max` bytes; null when it is larger (the stream is cancelled). */
async function readCapped(req: NextRequest, max: number): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > max) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}

export async function POST(req: NextRequest) {
  const cfg = partnerBotConfig();
  if (!cfg) return NextResponse.json({ ok: false }, { status: 404 });
  if (!secretMatches(req.headers.get("x-telegram-bot-api-secret-token"), cfg.secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const raw = await readCapped(req, MAX_UPDATE_BYTES);
    if (raw === null) return ok();
    let update: unknown;
    try {
      update = JSON.parse(raw);
    } catch {
      return ok();
    }
    // Menu buttons (notifications v2): same chat rate limit as messages.
    const cb = extractCallback(update);
    if (cb) {
      if (chatLimiter.hit(cb.chatId)) await handlePartnerBotCallback(cb);
      return ok();
    }
    const msg = extractPrivateText(update);
    if (!msg) return ok();
    if (!chatLimiter.hit(msg.chatId)) return ok(); // over the limit: ignored, no reply
    await handlePartnerBotMessage(msg.chatId, msg.text);
  } catch (e) {
    // Never the message text or the chat id; Prisma/fetch messages may quote input, so only the error kind.
    console.error("[partner-telegram] update failed:", e instanceof Error ? e.name : typeof e);
  }
  return ok();
}
