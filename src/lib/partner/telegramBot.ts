// Partner Telegram bot (phase 3e, Task 3) — pure glue for the webhook route and the outbox sender.
// No I/O: env parsing, the secret-header compare, update validation, the per-row delivery decision.
// The Bot API calls live in telegramApi.ts (server-only); texts and routing in telegram.ts.
import { createHash, timingSafeEqual } from "node:crypto";

// ── Configuration ───────────────────────────────────────────────────────────

export type PartnerBotConfig = { token: string; username: string; secret: string };

/** All three env vars present (trimmed, non-empty) → the config; otherwise null (bot not available). */
export function partnerBotConfigFrom(env: Record<string, string | undefined>): PartnerBotConfig | null {
  const token = env.PARTNER_TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const username = (env.PARTNER_TELEGRAM_BOT_USERNAME?.trim() ?? "").replace(/^@/, "");
  const secret = env.PARTNER_TELEGRAM_WEBHOOK_SECRET?.trim() ?? "";
  if (!token || !username || !secret) return null;
  return { token, username, secret };
}

/** Deep link that opens the bot with `/start <code>`. */
export function telegramDeepLink(username: string, code: string): string {
  return `https://t.me/${encodeURIComponent(username.replace(/^@/, ""))}?start=${encodeURIComponent(code)}`;
}

/** Channel radio value from the settings form; null when it is not one of the three. */
export function parseNotifyChannel(v: unknown): "EMAIL" | "TELEGRAM" | "BOTH" | null {
  return v === "EMAIL" || v === "TELEGRAM" || v === "BOTH" ? v : null;
}

// ── Webhook request validation ──────────────────────────────────────────────

/**
 * Constant-time string compare. Both sides are hashed first, so neither the content nor the length of
 * the expected secret leaks through timing. An empty expected value never matches.
 */
export function secretMatches(received: string | null | undefined, expected: string | null | undefined): boolean {
  if (typeof received !== "string" || typeof expected !== "string" || !expected) return false;
  const a = createHash("sha256").update(received, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b) && received.length === expected.length;
}

/** Largest update body the webhook reads (Telegram text messages are far below this). */
export const MAX_UPDATE_BYTES = 64 * 1024;
const MAX_TEXT_CHARS = 4096;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * The only input the bot acts on: a text `message` from a private chat. Edited messages, channel posts,
 * groups, stickers, captions and anything malformed → null. The chat id comes back as a string.
 */
export function extractPrivateText(update: unknown): { chatId: string; text: string } | null {
  if (!isObj(update) || !isObj(update.message)) return null;
  const m = update.message;
  if (!isObj(m.chat) || m.chat.type !== "private") return null;
  const id = m.chat.id;
  const chatId = typeof id === "number" && Number.isSafeInteger(id) ? String(id) : typeof id === "string" && /^-?\d{1,20}$/.test(id) ? id : null;
  if (!chatId) return null;
  if (typeof m.text !== "string" || !m.text.trim() || m.text.length > MAX_TEXT_CHARS) return null;
  return { chatId, text: m.text };
}

/**
 * A button press (callback_query) from a private chat: the chat, the menu message to edit and the button
 * data. Anything else (inline mode, groups, game buttons, malformed ids) → null.
 */
export function extractCallback(update: unknown): { id: string; chatId: string; messageId: number; data: string } | null {
  if (!isObj(update) || !isObj(update.callback_query)) return null;
  const q = update.callback_query;
  if (typeof q.id !== "string" || !q.id || q.id.length > 100) return null;
  if (typeof q.data !== "string" || !q.data || q.data.length > 64) return null;
  if (!isObj(q.message) || !isObj(q.message.chat) || q.message.chat.type !== "private") return null;
  const id = q.message.chat.id;
  const chatId = typeof id === "number" && Number.isSafeInteger(id) ? String(id) : typeof id === "string" && /^-?\d{1,20}$/.test(id) ? id : null;
  const messageId = q.message.message_id;
  if (!chatId || typeof messageId !== "number" || !Number.isSafeInteger(messageId) || messageId <= 0) return null;
  return { id: q.id, chatId, messageId, data: q.data };
}

// ── Delivery ────────────────────────────────────────────────────────────────

/** A Bot API failure that means this chat can no longer be messaged (blocked, deactivated, never started). */
export function isBlockedTelegramError(status: number, _description?: string): boolean {
  return status === 403;
}

/** Description the API client returns (status 0) when the PARTNER_TELEGRAM_* env is incomplete. */
export const PARTNER_BOT_NOT_CONFIGURED = "partner bot not configured";

/**
 * What a failed sendMessage means for the outbox row:
 *  - "blocked": 403 — the partner blocked the bot; permanent, and the chat link is cleared;
 *  - "permanent": any other 4xx except 429 (chat not found, bad request…) or the bot not configured —
 *    retrying the same row cannot help: fall back to e-mail when allowed, otherwise close the row;
 *  - "transport": 5xx, 429, network error, timeout — Telegram itself is unavailable; retried and counted
 *    by the transport breaker;
 *  - "other": anything unclassified — retried with the normal backoff, never trips the breaker.
 */
export type TelegramFailureClass = "blocked" | "permanent" | "transport" | "other";

export function classifyTelegramFailure(status: number, description?: string): TelegramFailureClass {
  if (isBlockedTelegramError(status, description)) return "blocked";
  if (status === 429) return "transport";
  if (status >= 400 && status < 500) return "permanent";
  if (status >= 500 && status < 600) return "transport";
  if (status === 0) return description === PARTNER_BOT_NOT_CONFIGURED ? "permanent" : "transport";
  return "other";
}

/**
 * A channel attempt. On failure: `permanent` = this row can never go out on this channel (a blocked chat
 * sets `blocked` too); `transport` = a shared outage (counts toward the breaker). An e-mail failure is
 * always a transport failure (sendEmail only throws when the mail server rejects or is unreachable).
 */
export type ChannelResult = { ok: true } | { ok: false; error: string; blocked?: boolean; permanent?: boolean; transport?: boolean };

/** ChannelResult for a failed Telegram send, from its classification. */
export function telegramFailureResult(error: string, cls: TelegramFailureClass): ChannelResult {
  return {
    ok: false,
    error,
    ...(cls === "blocked" ? { blocked: true } : {}),
    ...(cls === "blocked" || cls === "permanent" ? { permanent: true } : {}),
    ...(cls === "transport" ? { transport: true } : {}),
  };
}

/** Prefix of `error` on a row that went out on one channel while another failed (still counts as mailed). */
export const PARTIAL_PREFIX = "partial: ";

export type DeliveryOutcome =
  /** At least one channel succeeded; `error` lists the failed channel(s) (prefixed "partial: ") or is null. */
  | { state: "sent"; error: string | null }
  /** Nothing went out and nothing can on retry (every channel tried failed permanently): close the row. `blocked` = a blocked chat among them. */
  | { state: "closed"; error: string; blocked: boolean }
  /** Nothing went out: release the row for a retry. `transport` = a shared outage, counted by the transport breaker. */
  | { state: "failed"; error: string; transport: boolean };

const isPermanent = (r: ChannelResult) => !r.ok && (r.permanent === true || r.blocked === true);

/**
 * Per-row result over the channels that were attempted. Sent when ≥ 1 succeeded. A row whose every attempt
 * failed permanently (blocked chat, Telegram 4xx other than 429, bot not configured) is closed rather than
 * retried. Any other failure is retried; it counts toward the transport breaker only when a channel failed
 * on a shared transport (mail transport, Telegram 5xx/429/network/timeout) — a Telegram failure that is
 * neither permanent nor transport is charged an attempt but never stops the batch.
 */
export function deliveryOutcome(results: { email?: ChannelResult; telegram?: ChannelResult }): DeliveryOutcome {
  const tried = (["email", "telegram"] as const).filter((k) => results[k]);
  if (!tried.length) return { state: "failed", error: "no channel", transport: false };
  const failed = tried.filter((k) => !results[k]!.ok);
  const errorText = failed.map((k) => `${k}: ${(results[k] as { error: string }).error}`).join("; ");
  if (failed.length < tried.length) return { state: "sent", error: failed.length ? PARTIAL_PREFIX + errorText : null };
  if (failed.every((k) => isPermanent(results[k]!))) {
    return { state: "closed", error: errorText, blocked: failed.some((k) => (results[k] as { blocked?: boolean }).blocked === true) };
  }
  const transport = failed.some((k) => k === "email" || (results[k] as { transport?: boolean }).transport === true);
  return { state: "failed", error: errorText, transport };
}

/**
 * After a permanent Telegram failure (blocked chat, 4xx, bot not configured): e-mail this row instead, when
 * it was not e-mailed already and an e-mail is allowed for it (a recipient exists and the profile switch
 * does not suppress this kind).
 */
export function permanentFallbackToEmail(input: { telegramPermanent: boolean; emailAttempted: boolean; emailAllowed: boolean }): boolean {
  return input.telegramPermanent && !input.emailAttempted && input.emailAllowed;
}
