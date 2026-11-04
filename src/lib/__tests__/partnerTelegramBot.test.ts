import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_UPDATE_BYTES, PARTIAL_PREFIX, PARTNER_BOT_NOT_CONFIGURED, classifyTelegramFailure, deliveryOutcome, extractPrivateText,
  isBlockedTelegramError, parseNotifyChannel, partnerBotConfigFrom, permanentFallbackToEmail, secretMatches, telegramDeepLink,
  telegramFailureResult,
} from "@/lib/partner/telegramBot";
import { onboardingFactsFrom, onboardingHref, onboardingSteps, onboardingVisible } from "@/lib/partner/onboarding";
import { PARTNER_LOCALES, dict } from "@/lib/partner/i18n";

const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

// ── secretMatches ───────────────────────────────────────────────────────────

test("secretMatches: equal strings only; empty/missing expected never matches", () => {
  assert.equal(secretMatches("s3cret-Token_1", "s3cret-Token_1"), true);
  assert.equal(secretMatches("s3cret-Token_2", "s3cret-Token_1"), false);
  assert.equal(secretMatches("s3cret-Token_1x", "s3cret-Token_1"), false); // longer
  assert.equal(secretMatches("s3cret", "s3cret-Token_1"), false); // prefix
  assert.equal(secretMatches("", "s3cret"), false);
  assert.equal(secretMatches(null, "s3cret"), false);
  assert.equal(secretMatches(undefined, "s3cret"), false);
  assert.equal(secretMatches("", ""), false);
  assert.equal(secretMatches("x", ""), false);
  assert.equal(secretMatches("x", null), false);
  assert.equal(secretMatches("S3CRET", "s3cret"), false); // case-sensitive
});

test("secretMatches is constant-time (timingSafeEqual over hashes), not ===", () => {
  const s = src("src/lib/partner/telegramBot.ts");
  const body = s.slice(s.indexOf("export function secretMatches"), s.indexOf("export const MAX_UPDATE_BYTES"));
  assert.ok(body.includes("timingSafeEqual("));
  assert.ok(body.includes('createHash("sha256")'));
  assert.ok(!/received\s*===\s*expected/.test(body));
});

// ── config / links / channel ────────────────────────────────────────────────

test("partnerBotConfigFrom: all three env vars required, trimmed, @ stripped from the username", () => {
  const full = { PARTNER_TELEGRAM_BOT_TOKEN: " 1:abc ", PARTNER_TELEGRAM_BOT_USERNAME: "@CveBot", PARTNER_TELEGRAM_WEBHOOK_SECRET: "sec" };
  assert.deepEqual(partnerBotConfigFrom(full), { token: "1:abc", username: "CveBot", secret: "sec" });
  for (const k of Object.keys(full)) assert.equal(partnerBotConfigFrom({ ...full, [k]: "  " }), null, k);
  assert.equal(partnerBotConfigFrom({}), null);
  // The office bot's env is never a substitute.
  assert.equal(partnerBotConfigFrom({ TELEGRAM_BOT_TOKEN: "1:x", TELEGRAM_CHAT_ID: "5" }), null);
});

test("telegramDeepLink encodes username and code", () => {
  assert.equal(telegramDeepLink("CveBot", "ABCDEFGH23"), "https://t.me/CveBot?start=ABCDEFGH23");
  assert.equal(telegramDeepLink("@CveBot", "A B"), "https://t.me/CveBot?start=A%20B");
});

test("parseNotifyChannel accepts the three values only", () => {
  assert.equal(parseNotifyChannel("EMAIL"), "EMAIL");
  assert.equal(parseNotifyChannel("TELEGRAM"), "TELEGRAM");
  assert.equal(parseNotifyChannel("BOTH"), "BOTH");
  for (const v of ["email", "", null, undefined, 1, "SMS"]) assert.equal(parseNotifyChannel(v), null);
});

// ── extractPrivateText ──────────────────────────────────────────────────────

const update = (message: unknown) => ({ update_id: 1, message });

test("extractPrivateText: private text message → chat id string + text", () => {
  assert.deepEqual(extractPrivateText(update({ chat: { id: 12345, type: "private" }, text: "/status" })), { chatId: "12345", text: "/status" });
  assert.deepEqual(extractPrivateText(update({ chat: { id: "987", type: "private" }, text: "hi" })), { chatId: "987", text: "hi" });
});

test("extractPrivateText: groups, channels, edits, non-text and malformed input are ignored", () => {
  assert.equal(extractPrivateText(update({ chat: { id: -100, type: "group" }, text: "/status" })), null);
  assert.equal(extractPrivateText(update({ chat: { id: -100, type: "supergroup" }, text: "/status" })), null);
  assert.equal(extractPrivateText(update({ chat: { id: 1, type: "channel" }, text: "/status" })), null);
  assert.equal(extractPrivateText({ update_id: 1, edited_message: { chat: { id: 1, type: "private" }, text: "/status" } }), null);
  assert.equal(extractPrivateText({ update_id: 1, channel_post: { chat: { id: 1, type: "channel" }, text: "x" } }), null);
  assert.equal(extractPrivateText(update({ chat: { id: 1, type: "private" }, sticker: {} })), null);
  assert.equal(extractPrivateText(update({ chat: { id: 1, type: "private" }, caption: "/status" })), null);
  assert.equal(extractPrivateText(update({ chat: { id: 1, type: "private" }, text: "   " })), null);
  assert.equal(extractPrivateText(update({ chat: { id: 1, type: "private" }, text: "x".repeat(4097) })), null);
  assert.equal(extractPrivateText(update({ chat: { id: 1.5, type: "private" }, text: "x" })), null);
  assert.equal(extractPrivateText(update({ chat: { id: "abc", type: "private" }, text: "x" })), null);
  assert.equal(extractPrivateText(update({ chat: { type: "private" }, text: "x" })), null);
  assert.equal(extractPrivateText(update({ text: "x" })), null);
  for (const bad of [null, undefined, "x", 5, [], { message: [] }, { message: "x" }]) assert.equal(extractPrivateText(bad), null);
});

// ── delivery decisions ──────────────────────────────────────────────────────

test("deliveryOutcome: sent when at least one chosen channel succeeded; per-channel errors recorded", () => {
  assert.deepEqual(deliveryOutcome({ email: { ok: true } }), { state: "sent", error: null });
  assert.deepEqual(deliveryOutcome({ telegram: { ok: true } }), { state: "sent", error: null });
  assert.deepEqual(deliveryOutcome({ email: { ok: true }, telegram: { ok: true } }), { state: "sent", error: null });
  const partial = deliveryOutcome({ email: { ok: true }, telegram: { ok: false, error: "500 Internal" } });
  assert.deepEqual(partial, { state: "sent", error: `${PARTIAL_PREFIX}telegram: 500 Internal` });
  const partial2 = deliveryOutcome({ email: { ok: false, error: "smtp down" }, telegram: { ok: true } });
  assert.deepEqual(partial2, { state: "sent", error: `${PARTIAL_PREFIX}email: smtp down` });
});

test("deliveryOutcome: nothing went out → failed (retry), unless every failure was permanent → closed", () => {
  assert.deepEqual(deliveryOutcome({ email: { ok: false, error: "smtp down", transport: true } }), { state: "failed", error: "email: smtp down", transport: true });
  assert.deepEqual(
    deliveryOutcome({ telegram: telegramFailureResult("0 timeout", "transport") }),
    { state: "failed", error: "telegram: 0 timeout", transport: true },
  );
  assert.deepEqual(
    deliveryOutcome({ telegram: telegramFailureResult("403 Forbidden: bot was blocked by the user", "blocked") }),
    { state: "closed", error: "telegram: 403 Forbidden: bot was blocked by the user", blocked: true },
  );
  assert.deepEqual(
    deliveryOutcome({ telegram: telegramFailureResult("400 Bad Request: chat not found", "permanent") }),
    { state: "closed", error: "telegram: 400 Bad Request: chat not found", blocked: false },
  );
  // Blocked chat + failed fallback e-mail: the e-mail is retried (and counts as transport).
  const both = deliveryOutcome({ email: { ok: false, error: "smtp down" }, telegram: telegramFailureResult("403 blocked", "blocked") });
  assert.equal(both.state, "failed");
  assert.equal(both.error, "email: smtp down; telegram: 403 blocked");
  assert.equal(both.state === "failed" && both.transport, true);
  assert.deepEqual(deliveryOutcome({}), { state: "failed", error: "no channel", transport: false });
});

test("breaker counting: only shared transport failures count; other Telegram-only failures are charged but never trip", () => {
  const counts = (o: ReturnType<typeof deliveryOutcome>) => o.state === "failed" && o.transport;
  // Mail transport error (an e-mail failure is always transport, flagged or not).
  assert.equal(counts(deliveryOutcome({ email: { ok: false, error: "ECONNREFUSED" } })), true);
  // Telegram 5xx / 429 / network / timeout.
  for (const [status, d] of [[500, "x"], [502, "x"], [429, "Too Many Requests"], [0, "network error"], [0, "timeout"]] as const) {
    assert.equal(counts(deliveryOutcome({ telegram: telegramFailureResult(`${status} ${d}`, classifyTelegramFailure(status, d)) })), true, `${status} ${d}`);
  }
  // Unclassified Telegram failure: failed (charged, backoff), not counted.
  const other = deliveryOutcome({ telegram: telegramFailureResult("302 moved", classifyTelegramFailure(302, "moved")) });
  assert.equal(other.state, "failed");
  assert.equal(counts(other), false);
  // Permanent ones never reach the breaker: closed.
  for (const [status, d] of [[400, "Bad Request"], [404, "Not Found"], [403, "Forbidden"], [0, PARTNER_BOT_NOT_CONFIGURED]] as const) {
    assert.equal(deliveryOutcome({ telegram: telegramFailureResult(`${status} ${d}`, classifyTelegramFailure(status, d)) }).state, "closed", `${status}`);
  }
  // Sender: charges non-transport failures at once, feeds only transport failures to the streak.
  const s = src("src/lib/partner/notifySend.ts");
  const i = s.indexOf('if (out.state === "failed") {');
  const block = s.slice(i, s.indexOf("result.sent++;", i));
  assert.ok(block.indexOf("if (!out.transport) {") < block.indexOf("streak.fail(row.id)"));
  assert.ok(block.includes("await release(row, truncateError(out.error), true);\n        continue;"));
});

test("classifyTelegramFailure: 403 blocked; other 4xx and not-configured permanent; 5xx/429/network transport", () => {
  assert.equal(classifyTelegramFailure(403, "Forbidden: bot was blocked by the user"), "blocked");
  for (const st of [400, 401, 404, 409, 413]) assert.equal(classifyTelegramFailure(st, "x"), "permanent", String(st));
  assert.equal(classifyTelegramFailure(0, PARTNER_BOT_NOT_CONFIGURED), "permanent");
  for (const st of [429, 500, 502, 503, 504]) assert.equal(classifyTelegramFailure(st, "x"), "transport", String(st));
  assert.equal(classifyTelegramFailure(0, "timeout"), "transport");
  assert.equal(classifyTelegramFailure(0, "network error"), "transport");
  assert.equal(classifyTelegramFailure(200, "ok false"), "other");
  assert.deepEqual(telegramFailureResult("e", "blocked"), { ok: false, error: "e", blocked: true, permanent: true });
  assert.deepEqual(telegramFailureResult("e", "permanent"), { ok: false, error: "e", permanent: true });
  assert.deepEqual(telegramFailureResult("e", "transport"), { ok: false, error: "e", transport: true });
  assert.deepEqual(telegramFailureResult("e", "other"), { ok: false, error: "e" });
  // The API client reports a missing env with exactly this description, and classifies every failure.
  const a = src("src/lib/partner/telegramApi.ts");
  assert.ok(a.includes("description: PARTNER_BOT_NOT_CONFIGURED"));
  assert.ok(a.includes("failure: classifyTelegramFailure(r.status, r.description)"));
});

test("permanent Telegram failure: fall back to e-mail only when not mailed already and allowed; 403 stays 'blocked'", () => {
  assert.equal(isBlockedTelegramError(403, "Forbidden: bot was blocked by the user"), true);
  assert.equal(isBlockedTelegramError(403, "Forbidden: user is deactivated"), true);
  for (const s of [0, 400, 429, 500, 502]) assert.equal(isBlockedTelegramError(s, "x"), false, String(s));
  assert.equal(permanentFallbackToEmail({ telegramPermanent: true, emailAttempted: false, emailAllowed: true }), true);
  assert.equal(permanentFallbackToEmail({ telegramPermanent: true, emailAttempted: true, emailAllowed: true }), false); // BOTH: mailed already
  assert.equal(permanentFallbackToEmail({ telegramPermanent: true, emailAttempted: false, emailAllowed: false }), false); // opted out / no address
  assert.equal(permanentFallbackToEmail({ telegramPermanent: false, emailAttempted: false, emailAllowed: true }), false); // transient failure: retry instead
  const s = src("src/lib/partner/notifySend.ts");
  assert.ok(s.includes("const telegramPermanent = !!tg && !tg.ok && tg.permanent === true;"));
  assert.ok(s.includes('if (!r.ok && r.failure === "blocked") {'), "only a 403 unlinks the chat");
});

test("sender wiring: routeNotification decides channels, blocked chat unlinked only if unchanged, MATCH/PRESENTATION_OPENED delivered", () => {
  const s = src("src/lib/partner/notifySend.ts");
  assert.ok(s.includes("kind: row.kind, notifyChannel: partner.notifyChannel, chatLinked: !!chatId, botConfigured: partnerBotConfigured(),"));
  assert.ok(s.includes("where: { id: d.partnerId, telegramChatId: d.telegram.chatId }"), "only the chat that blocked is cleared");
  assert.ok(s.includes("return deliveryOutcome(results);"));
  assert.ok(s.includes('kind: "MATCH", projectName, changeType, url, portalUrl: common.link'));
  assert.ok(s.includes('{ kind: "PRESENTATION_OPENED", clientName, url: link, portalUrl: base }'));
  // A partially delivered STAGE row still counts as "last mailed" for the unchanged-stage check.
  assert.ok(s.includes("{ error: { startsWith: PARTIAL_PREFIX } }"));
  assert.ok(!s.includes('from "@/lib/telegram"'), "never the office bot");
});

// ── webhook route / API client (source checks: no network, no DB) ───────────

test("webhook route: POST only, 404 without bot env, 401 on a wrong secret header, 64 KB cap, always 200 after auth", () => {
  const r = src("src/app/api/webhooks/partner-telegram/route.ts");
  assert.ok(r.includes("export async function POST("));
  assert.ok(!/export async function (GET|PUT|PATCH|DELETE)/.test(r));
  assert.ok(r.includes("if (!cfg) return NextResponse.json({ ok: false }, { status: 404 });"));
  assert.ok(r.includes('secretMatches(req.headers.get("x-telegram-bot-api-secret-token"), cfg.secret)'));
  assert.ok(r.includes("{ status: 401 }"));
  assert.ok(r.indexOf("{ status: 401 }") < r.indexOf("readCapped(req, MAX_UPDATE_BYTES)"), "auth before the body is read");
  assert.ok(r.includes("readCapped(req, MAX_UPDATE_BYTES)"));
  assert.equal(MAX_UPDATE_BYTES, 64 * 1024);
  assert.ok(r.includes("chatLimiter.hit(msg.chatId)"));
  assert.ok(!r.includes('from "@/lib/telegram"'), "never the office bot");
  // Logs carry no message text.
  for (const line of r.split("\n").filter((l) => l.includes("console."))) assert.ok(!/text|msg\./.test(line.replace("[partner-telegram] update failed:", "")), line);
});

test("API client: partner env only, 10 s abort, token/URL never logged or returned", () => {
  const a = src("src/lib/partner/telegramApi.ts");
  assert.ok(a.includes('import "server-only";'));
  assert.ok(a.includes("AbortController"));
  assert.ok(a.includes("TIMEOUT_MS = 10_000"));
  assert.ok(a.includes('parse_mode: "HTML"'));
  assert.ok(a.includes("disable_web_page_preview: true"));
  assert.ok(a.includes('url: PARTNER_WEBHOOK_URL') && a.includes('allowed_updates: ["message", "callback_query"]') && a.includes("drop_pending_updates: true"));
  assert.ok(a.includes('"https://cyprusvipestates.com/api/webhooks/partner-telegram"'));
  assert.ok(!a.includes("console."), "no logging in the client");
  assert.ok(!/process\.env\.TELEGRAM_/.test(a), "never the office bot env");
});

test("bot dispatch: partner from the chat only; code consumed atomically; moved chat cleared; ACTIVE required", () => {
  const w = src("src/lib/partner/telegramWebhook.ts");
  assert.ok(w.includes("where: { telegramChatId: chatId }"));
  assert.ok(w.includes("updateMany({ where: { codeHash, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } })"));
  assert.ok(w.includes("if (used.count !== 1) return null;"));
  assert.ok(w.includes('partner.status !== "ACTIVE"'));
  assert.ok(w.includes("where: { telegramChatId: chatId, id: { not: partner.id } }"));
  assert.ok(!w.includes("ourCommission") && !w.includes("ourRate"));
});

// ── onboarding ──────────────────────────────────────────────────────────────

test("onboarding: Telegram step is optional — listed while the bot is available, counts only once linked", () => {
  const base = { status: "ACTIVE", hasAcceptance: true, bankComplete: true, hasClaim: true };
  const off = onboardingSteps(onboardingFactsFrom({ ...base, telegram: { available: false, linked: false } }));
  assert.ok(!off.steps.some((s) => s.key === "telegram"));
  assert.deepEqual([off.done, off.total, off.complete], [4, 4, true]);

  const open = onboardingSteps(onboardingFactsFrom({ ...base, telegram: { available: true, linked: false } }));
  const step = open.steps.find((s) => s.key === "telegram");
  assert.deepEqual(step, { key: "telegram", done: false, optional: true });
  assert.deepEqual([open.done, open.total, open.complete], [4, 4, true], "an open optional step never blocks completion");
  assert.equal(onboardingVisible(open, false), false);

  const partial = onboardingSteps(onboardingFactsFrom({ ...base, hasClaim: false, telegram: { available: true, linked: true } }));
  assert.deepEqual([partial.done, partial.total, partial.complete], [4, 5, false], "linked counts toward done and total");
  const notLinked = onboardingSteps(onboardingFactsFrom({ ...base, hasClaim: false, telegram: { available: true, linked: false } }));
  assert.deepEqual([notLinked.done, notLinked.total], [3, 4]);

  // Linked but env removed later: still counted as done.
  const kept = onboardingSteps(onboardingFactsFrom({ ...base, telegram: { available: false, linked: true } }));
  assert.deepEqual([kept.done, kept.total, kept.complete], [5, 5, true]);

  assert.equal(onboardingHref("telegram"), "/profile#telegram");
  for (const l of PARTNER_LOCALES) assert.ok(dict(l).onboarding.steps.telegram.trim(), l);
});

test("portal Telegram card: code shown once, chat id never sent to the client, channel saved only for linked chats", () => {
  const actions = src("src/app/partner-portal/telegramActions.ts");
  assert.ok(actions.includes("requirePartner({ active: true })"));
  assert.ok(actions.includes("L.telegramCode.hit(me.partner.id)"));
  assert.ok(actions.includes("usedAt: null, expiresAt: { gt: now } }, data: { expiresAt: now }"), "older unused codes invalidated");
  assert.ok(actions.includes("codeHash: hash"), "only the hash is stored");
  const page = src("src/app/partner-portal/profile/page.tsx");
  assert.ok(!/telegramChatId=|chatId=\{/.test(page), "no chat id prop");
  const settings = src("src/app/partner-portal/settingsActions.ts");
  assert.ok(settings.includes('choice !== "EMAIL" && !linked?.telegramChatId ? "EMAIL" : choice'));
  const crm = src("src/app/crm/partners/page.tsx");
  assert.ok(crm.includes("telegramLinked: !!p.telegramChatId"));
  const crmActions = src("src/app/crm/partners/telegramActions.ts");
  assert.ok(crmActions.includes("actor.isActive && actor.isOwner"));
  assert.ok(crmActions.includes('"partner_telegram_webhook_set"'));
  // Partner code never imports the staff auth.
  for (const f of ["src/lib/partner/telegramApi.ts", "src/lib/partner/telegramWebhook.ts", "src/app/partner-portal/telegramActions.ts", "src/app/api/webhooks/partner-telegram/route.ts"]) {
    assert.ok(!src(f).includes("@/auth"), f);
  }
});
