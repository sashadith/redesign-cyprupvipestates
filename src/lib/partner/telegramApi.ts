// Partner Telegram bot — Bot API client (phase 3e, Task 3). Server-only.
// This is the PARTNER bot (env PARTNER_TELEGRAM_*), never the office bot in src/lib/telegram.ts.
// The token is part of the request URL: neither the token nor the URL is ever logged or returned.
import "server-only";
import { PARTNER_BOT_NOT_CONFIGURED, classifyTelegramFailure, partnerBotConfigFrom, type PartnerBotConfig, type TelegramFailureClass } from "./telegramBot";

export const PARTNER_WEBHOOK_URL = "https://cyprusvipestates.com/api/webhooks/partner-telegram";
const TIMEOUT_MS = 10_000;
const DESCRIPTION_MAX = 200;

export function partnerBotConfig(): PartnerBotConfig | null {
  return partnerBotConfigFrom(process.env);
}

/** PARTNER_TELEGRAM_BOT_TOKEN + _BOT_USERNAME + _WEBHOOK_SECRET are all set. */
export function partnerBotConfigured(): boolean {
  return partnerBotConfig() !== null;
}

type ApiResult = { ok: true; result: unknown } | { ok: false; status: number; description: string };

const clip = (s: string) => (s.length > DESCRIPTION_MAX ? s.slice(0, DESCRIPTION_MAX) : s);

/** One Bot API call (POST JSON, 10 s timeout). Errors come back as values; nothing here throws or logs the URL. */
async function call(method: string, body: Record<string, unknown>): Promise<ApiResult> {
  const cfg = partnerBotConfig();
  if (!cfg) return { ok: false, status: 0, description: PARTNER_BOT_NOT_CONFIGURED };
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
    const description = typeof json?.description === "string" ? json.description : `HTTP ${res.status}`;
    return { ok: false, status: res.status, description: clip(description) };
  } catch (e) {
    // fetch errors may carry the request URL in their message: report only the kind of failure.
    const aborted = ctrl.signal.aborted || (e instanceof Error && e.name === "AbortError");
    return { ok: false, status: 0, description: aborted ? "timeout" : "network error" };
  } finally {
    clearTimeout(timer);
  }
}

export type PartnerSendResult = { ok: true } | { ok: false; status: number; description: string; failure: TelegramFailureClass };

/** Inline keyboard (bot menu, notifications v2): rows of callback or URL buttons. */
export type InlineKeyboard = ({ text: string; callback_data: string } | { text: string; url: string })[][];
/** The persistent menu under the message field (reply keyboard): rows of plain button texts. */
export type ReplyKeyboard = { reply: string[][] };

const markup = (k: InlineKeyboard | ReplyKeyboard) =>
  "reply" in k
    ? { keyboard: k.reply.map((row) => row.map((text) => ({ text }))), resize_keyboard: true, is_persistent: true }
    : { inline_keyboard: k };

/** sendMessage with parse_mode HTML and no link previews. `failure` classifies an error (classifyTelegramFailure). */
export async function sendPartnerTelegram(chatId: string, html: string, keyboard?: InlineKeyboard | ReplyKeyboard): Promise<PartnerSendResult> {
  const r = await call("sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    link_preview_options: { is_disabled: true },
    ...(keyboard ? { reply_markup: markup(keyboard) } : {}),
  });
  if (r.ok) return { ok: true };
  return { ok: false, status: r.status, description: r.description, failure: classifyTelegramFailure(r.status, r.description) };
}

/** Replaces a menu message in place (a button press); "message is not modified" counts as success. */
export async function editPartnerTelegram(chatId: string, messageId: number, html: string, keyboard: InlineKeyboard): Promise<boolean> {
  const r = await call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: html,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: keyboard },
  });
  return r.ok || /not modified/i.test(r.description);
}

/** Stops the button's loading spinner; `text` shows as a short toast. */
export async function answerPartnerCallback(callbackQueryId: string, text?: string): Promise<void> {
  await call("answerCallbackQuery", { callback_query_id: callbackQueryId, ...(text ? { text } : {}) });
}

/** The bot's command list ("/" menu) per language; `commands` maps a language code (or "" for the default) to its list. */
export async function setPartnerCommands(commands: Record<string, { command: string; description: string }[]>): Promise<boolean> {
  let ok = true;
  for (const [lang, list] of Object.entries(commands)) {
    const r = await call("setMyCommands", { commands: list, ...(lang ? { language_code: lang } : {}) });
    ok = ok && r.ok;
  }
  return ok;
}

/** Registers the webhook on the main host with the secret header; message and button (callback_query) updates; drops the backlog. */
export async function setPartnerWebhook(): Promise<{ ok: true } | { ok: false; description: string }> {
  const cfg = partnerBotConfig();
  if (!cfg) return { ok: false, description: PARTNER_BOT_NOT_CONFIGURED };
  const r = await call("setWebhook", {
    url: PARTNER_WEBHOOK_URL,
    secret_token: cfg.secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  return r.ok ? { ok: true } : { ok: false, description: r.description };
}

export type PartnerWebhookInfo = {
  url: string;
  pendingUpdateCount: number;
  lastErrorMessage: string | null;
  lastErrorDate: string | null;
};

/** getWebhookInfo, reduced to what the CRM panel shows. */
export async function getPartnerWebhookInfo(): Promise<{ ok: true; info: PartnerWebhookInfo } | { ok: false; description: string }> {
  const r = await call("getWebhookInfo", {});
  if (!r.ok) return { ok: false, description: r.description };
  const o = (r.result && typeof r.result === "object" ? r.result : {}) as Record<string, unknown>;
  const lastErrorDate = typeof o.last_error_date === "number" ? new Date(o.last_error_date * 1000).toISOString() : null;
  return {
    ok: true,
    info: {
      url: typeof o.url === "string" ? o.url : "",
      pendingUpdateCount: typeof o.pending_update_count === "number" ? o.pending_update_count : 0,
      lastErrorMessage: typeof o.last_error_message === "string" ? clip(o.last_error_message) : null,
      lastErrorDate,
    },
  };
}
