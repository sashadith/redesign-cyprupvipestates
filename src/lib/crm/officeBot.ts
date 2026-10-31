// Office bot (TELEGRAM_BOT_TOKEN, the bot behind src/lib/telegram.ts) — the calls the lead reminders need:
// messages with buttons, button answers, keyboard edits, and the webhook config. Server-only.
// The token is part of the request URL: neither the token nor the URL is ever logged or returned.
import "server-only";
import type { InlineButton } from "./leadNag";

// The webhook (https://cyprusvipestates.com/api/webhooks/office-telegram, updates: message + callback_query,
// secret OFFICE_TELEGRAM_WEBHOOK_SECRET) is registered once by the operator's ops script, not from the app.
const TIMEOUT_MS = 10_000;

export type OfficeBotConfig = { token: string; officeChatId: string | null; secret: string | null };

/** Token required; the office chat (TELEGRAM_CHAT_ID) and the webhook secret (OFFICE_TELEGRAM_WEBHOOK_SECRET) may be missing. */
export function officeBotConfigFrom(env: Record<string, string | undefined>): OfficeBotConfig | null {
  const token = env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  if (!token) return null;
  return { token, officeChatId: env.TELEGRAM_CHAT_ID?.trim() || null, secret: env.OFFICE_TELEGRAM_WEBHOOK_SECRET?.trim() || null };
}

export function officeBotConfig(): OfficeBotConfig | null {
  return officeBotConfigFrom(process.env);
}

export type OfficeResult = { ok: true; result: unknown } | { ok: false; status: number; description: string };

async function call(method: string, body: Record<string, unknown>): Promise<OfficeResult> {
  const cfg = officeBotConfig();
  if (!cfg) return { ok: false, status: 0, description: "office bot not configured" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.telegram.org/bot${cfg.token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; result?: unknown; description?: unknown } | null;
    if (res.ok && json?.ok === true) return { ok: true, result: json.result };
    const description = typeof json?.description === "string" ? json.description.slice(0, 200) : `HTTP ${res.status}`;
    return { ok: false, status: res.status, description };
  } catch (e) {
    const aborted = ctrl.signal.aborted || (e instanceof Error && e.name === "AbortError");
    return { ok: false, status: 0, description: aborted ? "timeout" : "network error" };
  } finally {
    clearTimeout(timer);
  }
}

export function sendOfficeMessage(chatId: string, html: string, keyboard?: InlineButton[][]): Promise<OfficeResult> {
  return call("sendMessage", {
    chat_id: chatId, text: html, parse_mode: "HTML", link_preview_options: { is_disabled: true },
    ...(keyboard && keyboard.length ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
}

export function answerOfficeCallback(callbackQueryId: string, text: string): Promise<OfficeResult> {
  return call("answerCallbackQuery", { callback_query_id: callbackQueryId, text: text.slice(0, 190) });
}

export function editOfficeKeyboard(chatId: string, messageId: number, keyboard: InlineButton[][]): Promise<OfficeResult> {
  return call("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: keyboard } });
}

/** The bot's @username (for the t.me link on the settings page); null when the bot is not reachable. */
export async function officeBotUsername(): Promise<string | null> {
  const r = await call("getMe", {});
  if (!r.ok) return null;
  const u = (r.result as { username?: unknown } | null)?.username;
  return typeof u === "string" && /^[A-Za-z0-9_]{3,64}$/.test(u) ? u : null;
}
