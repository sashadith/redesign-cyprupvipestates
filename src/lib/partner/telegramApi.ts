// Partner Telegram bot — Bot API client (phase 3e, Task 3). Server-only.
// This is the PARTNER bot (env PARTNER_TELEGRAM_*), never the office bot in src/lib/telegram.ts.
// The token is part of the request URL: neither the token nor the URL is ever logged or returned.
import "server-only";
import { isBlockedTelegramError, partnerBotConfigFrom, type PartnerBotConfig } from "./telegramBot";

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
  if (!cfg) return { ok: false, status: 0, description: "partner bot not configured" };
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

export type PartnerSendResult = { ok: true } | { ok: false; status: number; description: string; blocked: boolean };

/** sendMessage with parse_mode HTML and no link previews. `blocked` = the partner blocked the bot (403). */
export async function sendPartnerTelegram(chatId: string, html: string): Promise<PartnerSendResult> {
  const r = await call("sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    link_preview_options: { is_disabled: true },
  });
  if (r.ok) return { ok: true };
  return { ok: false, status: r.status, description: r.description, blocked: isBlockedTelegramError(r.status, r.description) };
}

/** Registers the webhook on the main host with the secret header; only `message` updates; drops the backlog. */
export async function setPartnerWebhook(): Promise<{ ok: true } | { ok: false; description: string }> {
  const cfg = partnerBotConfig();
  if (!cfg) return { ok: false, description: "partner bot not configured" };
  const r = await call("setWebhook", {
    url: PARTNER_WEBHOOK_URL,
    secret_token: cfg.secret,
    allowed_updates: ["message"],
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
