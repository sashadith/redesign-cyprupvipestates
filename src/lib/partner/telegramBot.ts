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

// ── Delivery ────────────────────────────────────────────────────────────────

/** A Bot API failure that means this chat can no longer be messaged (blocked, deactivated, never started). */
export function isBlockedTelegramError(status: number, _description?: string): boolean {
  return status === 403;
}

export type ChannelResult = { ok: true } | { ok: false; error: string; blocked?: boolean };

/** Prefix of `error` on a row that went out on one channel while another failed (still counts as mailed). */
export const PARTIAL_PREFIX = "partial: ";

export type DeliveryOutcome =
  /** At least one channel succeeded; `error` lists the failed channel(s) (prefixed "partial: ") or is null. */
  | { state: "sent"; error: string | null }
  /** Nothing went out and nothing can on retry (the only channel tried was a blocked chat): close the row. */
  | { state: "closed"; error: string }
  /** Nothing went out: release the row for a retry (counts toward the transport breaker). */
  | { state: "failed"; error: string };

/**
 * Per-row result over the channels that were attempted. Sent when ≥ 1 succeeded. A blocked Telegram chat
 * is permanent (the chat link is cleared), so a row whose every attempt was a blocked chat is closed
 * rather than retried; any other failure (mail transport, Telegram 5xx/429/network) is retried.
 */
export function deliveryOutcome(results: { email?: ChannelResult; telegram?: ChannelResult }): DeliveryOutcome {
  const tried = (["email", "telegram"] as const).filter((k) => results[k]);
  if (!tried.length) return { state: "failed", error: "no channel" };
  const failed = tried.filter((k) => !results[k]!.ok);
  const errorText = failed.map((k) => `${k}: ${(results[k] as { error: string }).error}`).join("; ");
  if (failed.length < tried.length) return { state: "sent", error: failed.length ? PARTIAL_PREFIX + errorText : null };
  const allBlocked = failed.every((k) => (results[k] as { blocked?: boolean }).blocked === true);
  return allBlocked ? { state: "closed", error: errorText } : { state: "failed", error: errorText };
}

/**
 * After a blocked Telegram send: e-mail this row instead, when it was not e-mailed already and an e-mail
 * is allowed for it (a recipient exists and the profile switch does not suppress this kind).
 */
export function blockedFallbackToEmail(input: { telegramBlocked: boolean; emailAttempted: boolean; emailAllowed: boolean }): boolean {
  return input.telegramBlocked && !input.emailAttempted && input.emailAllowed;
}
