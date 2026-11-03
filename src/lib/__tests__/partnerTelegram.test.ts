import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseBotCommand, newLinkCode, normalizeLinkCode, LINK_CODE_ALPHABET, LINK_CODE_LENGTH,
  routeNotification, buildBotReply, buildTelegramNotification, makeChatLimiter, TELEGRAM_MAX_CHARS,
} from "@/lib/partner/telegram";
import { hashToken } from "@/lib/partner/tokens";
import { PARTNER_LOCALES } from "@/lib/partner/i18n";
import { NOTIFICATION_KINDS } from "@/lib/partner/notify";

// ── parseBotCommand ─────────────────────────────────────────────────────────

test("parseBotCommand: plain commands, case-insensitive, trimmed", () => {
  assert.deepEqual(parseBotCommand("/status"), { cmd: "status" });
  assert.deepEqual(parseBotCommand("  /HELP  "), { cmd: "help" });
  assert.deepEqual(parseBotCommand("/Commission"), { cmd: "commission" });
  assert.deepEqual(parseBotCommand("/stop"), { cmd: "stop" });
});

test("parseBotCommand: /start with and without code", () => {
  assert.deepEqual(parseBotCommand("/start ABCD234567"), { cmd: "start", arg: "ABCD234567" });
  assert.deepEqual(parseBotCommand("/start   abcd234567  "), { cmd: "start", arg: "abcd234567" });
  assert.deepEqual(parseBotCommand("/start"), { cmd: "start" });
});

test("parseBotCommand: @BotName suffix", () => {
  assert.deepEqual(parseBotCommand("/status@CvePartnerBot"), { cmd: "status" });
  assert.deepEqual(parseBotCommand("/start@CvePartnerBot XYZ"), { cmd: "start", arg: "XYZ" });
});

test("parseBotCommand: unknown text and commands", () => {
  assert.deepEqual(parseBotCommand("hello"), { cmd: "unknown" });
  assert.deepEqual(parseBotCommand("/foo"), { cmd: "unknown" });
  assert.deepEqual(parseBotCommand(""), { cmd: "unknown" });
  assert.deepEqual(parseBotCommand("/statusx"), { cmd: "unknown" });
  assert.deepEqual(parseBotCommand("status"), { cmd: "unknown" });
  assert.deepEqual(parseBotCommand(undefined as unknown as string), { cmd: "unknown" });
});

test("parseBotCommand: over-long input is unknown", () => {
  assert.deepEqual(parseBotCommand("/start " + "A".repeat(300)), { cmd: "unknown" });
  assert.equal(parseBotCommand("/start " + "A".repeat(150)).cmd, "start");
});

// ── link codes ──────────────────────────────────────────────────────────────

test("newLinkCode: length, unambiguous alphabet, hash", () => {
  assert.equal(LINK_CODE_LENGTH, 10);
  for (const c of "0O1IL") assert.ok(!LINK_CODE_ALPHABET.includes(c), c);
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const { code, hash } = newLinkCode();
    assert.equal(code.length, 10);
    for (const ch of code) assert.ok(LINK_CODE_ALPHABET.includes(ch), ch);
    assert.equal(hash, hashToken(code));
    assert.match(hash, /^[0-9a-f]{64}$/);
    seen.add(code);
  }
  assert.equal(seen.size, 200);
});

test("normalizeLinkCode: case/space tolerant, rejects bad input", () => {
  const { code } = newLinkCode();
  assert.equal(normalizeLinkCode(code.toLowerCase()), code);
  assert.equal(normalizeLinkCode(` ${code.slice(0, 5)}-${code.slice(5)} `), code);
  assert.equal(normalizeLinkCode("ABC"), null);
  assert.equal(normalizeLinkCode("ABCDEFGH0O"), null);
  assert.equal(normalizeLinkCode(undefined), null);
});

// ── routing ─────────────────────────────────────────────────────────────────

test("routeNotification matrix", () => {
  const r = (kind: (typeof NOTIFICATION_KINDS)[number], notifyChannel: "EMAIL" | "TELEGRAM" | "BOTH", chatLinked: boolean, emailNotifications = true) =>
    routeNotification({ kind, notifyChannel, chatLinked, emailNotifications });
  assert.deepEqual(r("STAGE", "EMAIL", true), { email: true, telegram: false });
  assert.deepEqual(r("STAGE", "TELEGRAM", true), { email: false, telegram: true });
  assert.deepEqual(r("STAGE", "BOTH", true), { email: true, telegram: true });
  // fallback without a linked chat
  assert.deepEqual(r("STAGE", "TELEGRAM", false), { email: true, telegram: false });
  assert.deepEqual(r("PAYOUT", "BOTH", false), { email: true, telegram: false });
  // emailNotifications=false: STAGE/MESSAGE email suppressed, Telegram untouched
  assert.deepEqual(r("STAGE", "EMAIL", true, false), { email: false, telegram: false });
  assert.deepEqual(r("MESSAGE", "BOTH", true, false), { email: false, telegram: true });
  assert.deepEqual(r("MESSAGE", "TELEGRAM", false, false), { email: false, telegram: false });
  for (const k of ["CLAIM_OUTCOME", "PAYOUT", "MATCH", "PRESENTATION_OPENED"] as const) {
    assert.deepEqual(r(k, "EMAIL", false, false), { email: true, telegram: false }, k);
    assert.deepEqual(r(k, "TELEGRAM", true, false), { email: false, telegram: true }, k);
  }
  // Bot not configured: no Telegram send is attempted; a linked chat routes like no chat (e-mail fallback).
  const nb = (notifyChannel: "EMAIL" | "TELEGRAM" | "BOTH", emailNotifications = true, kind: (typeof NOTIFICATION_KINDS)[number] = "STAGE") =>
    routeNotification({ kind, notifyChannel, chatLinked: true, botConfigured: false, emailNotifications });
  assert.deepEqual(nb("TELEGRAM"), { email: true, telegram: false });
  assert.deepEqual(nb("BOTH"), { email: true, telegram: false });
  assert.deepEqual(nb("EMAIL"), { email: true, telegram: false });
  assert.deepEqual(nb("TELEGRAM", false), { email: false, telegram: false }, "STAGE opted out: nothing");
  assert.deepEqual(nb("TELEGRAM", false, "MATCH"), { email: true, telegram: false });
  assert.deepEqual(routeNotification({ kind: "STAGE", notifyChannel: "TELEGRAM", chatLinked: true, botConfigured: true, emailNotifications: true }), { email: false, telegram: true });
});

// ── bot replies ─────────────────────────────────────────────────────────────

const ALLOWED_TAGS = /<\/?(?:b|i|a)(?:\s+href="[^"<>]*")?>/g;
function onlyTelegramTags(s: string) {
  assert.doesNotMatch(s.replace(ALLOWED_TAGS, ""), /[<>]/, s);
}

test("buildBotReply: every kind renders in every locale with Telegram-safe HTML", () => {
  const data = {
    portalUrl: "https://partners.example.com",
    clients: [{ name: "Anna <script>alert(1)</script>", stageKey: "stages.viewing" }],
    more: 2,
    totals: [{ stage: "EXPECTED", amount: "€1,000" }, { stage: "PAID_OUT", amount: "€500" }],
    lastPayout: { amount: "€500", creditNoteNumber: "CN-2026-0001" },
  };
  for (const l of PARTNER_LOCALES) {
    for (const kind of ["linked", "invalidCode", "unlinked", "notLinked", "help", "status", "commission", "rateLimited"] as const) {
      const s = buildBotReply(l, { kind, data });
      assert.ok(s.trim().length > 0, `${l} ${kind}`);
      onlyTelegramTags(s);
      assert.doesNotMatch(s, /<script>/);
      assert.doesNotMatch(s, /\{\w+\}/, `${l} ${kind} leftover placeholder`);
    }
  }
});

test("buildBotReply: status escapes names, lists stage, notes more", () => {
  const s = buildBotReply("en", {
    kind: "status",
    data: { portalUrl: "https://p.example", clients: [{ name: "A & B <x>", stageKey: "stages.viewing" }], more: 3 },
  });
  assert.match(s, /A &amp; B &lt;x&gt;/);
  assert.match(s, /Viewing/i);
  assert.match(s, /3/);
});

test("buildBotReply: status caps at 10 lines", () => {
  const clients = Array.from({ length: 14 }, (_, i) => ({ name: `Client${i}`, stageKey: "stages.submitted" }));
  const s = buildBotReply("en", { kind: "status", data: { portalUrl: "https://p.example", clients } });
  assert.match(s, /Client9\b/);
  assert.doesNotMatch(s, /Client10\b/);
});

test("buildBotReply: empty status and commission", () => {
  assert.ok(buildBotReply("de", { kind: "status", data: { portalUrl: "https://p", clients: [] } }).length > 0);
  assert.ok(buildBotReply("ru", { kind: "commission", data: { portalUrl: "https://p", totals: [], lastPayout: null } }).length > 0);
});

test("buildBotReply: commission shows payout credit note", () => {
  const s = buildBotReply("en", {
    kind: "commission",
    data: { portalUrl: "https://p", totals: [{ stage: "EARNED", amount: "€2,000" }], lastPayout: { amount: "€900", creditNoteNumber: "CN-7" } },
  });
  assert.match(s, /€2,000/);
  assert.match(s, /CN-7/);
});

test("buildBotReply: notLinked is English regardless of locale and links the portal", () => {
  const en = buildBotReply("en", { kind: "notLinked", data: { portalUrl: "https://p.example" } });
  assert.equal(buildBotReply("ru", { kind: "notLinked", data: { portalUrl: "https://p.example" } }), en);
  assert.match(en, /https:\/\/p\.example/);
});

test("buildBotReply: help points to the submit page", () => {
  assert.match(buildBotReply("pl", { kind: "help", data: { portalUrl: "https://p.example" } }), /href="https:\/\/p\.example\/submit"/);
});

test("buildBotReply: hostile portalUrl is escaped in href", () => {
  const s = buildBotReply("en", { kind: "help", data: { portalUrl: 'https://p.example/"><script>' } });
  assert.doesNotMatch(s, /<script>/);
  onlyTelegramTags(s);
});

// ── notifications ───────────────────────────────────────────────────────────

const base = { url: "https://p.example/clients/c1", portalUrl: "https://p.example" };

test("buildTelegramNotification: every kind in every locale", () => {
  for (const l of PARTNER_LOCALES) {
    for (const kind of NOTIFICATION_KINDS) {
      const s = buildTelegramNotification(l, {
        ...base, kind, clientName: "Anna", stageKey: "stages.offer", messageBody: "Hello", accepted: true,
        amount: "€1,000", creditNoteNumber: "CN-1", projectName: "Sea View", changeType: "price_from_changed", priceFrom: "€250,000",
      });
      assert.ok(s.length > 0 && s.length <= TELEGRAM_MAX_CHARS, `${l} ${kind}`);
      onlyTelegramTags(s);
      assert.doesNotMatch(s, /\{\w+\}/, `${l} ${kind}`);
      assert.match(s, /href="https:\/\/p\.example/);
    }
  }
});

test("buildTelegramNotification: escapes client name and message body", () => {
  const s = buildTelegramNotification("en", { ...base, kind: "MESSAGE", clientName: "<script>x</script>", messageBody: "<b>hi</b> & <script>" });
  assert.doesNotMatch(s, /<script>/);
  assert.match(s, /&lt;script&gt;x&lt;\/script&gt;/);
  assert.match(s, /&lt;b&gt;hi&lt;\/b&gt; &amp;/);
  onlyTelegramTags(s);
});

test("buildTelegramNotification: long message is truncated with an ellipsis", () => {
  const s = buildTelegramNotification("en", { ...base, kind: "MESSAGE", clientName: "Anna", messageBody: "x".repeat(5000) });
  assert.ok(s.length <= TELEGRAM_MAX_CHARS);
  assert.match(s, /x…/);
});

test("buildTelegramNotification: truncation never cuts an entity in half", () => {
  const s = buildTelegramNotification("en", { ...base, kind: "MESSAGE", clientName: "Anna", messageBody: "&".repeat(3000) });
  assert.ok(s.length <= TELEGRAM_MAX_CHARS);
  assert.doesNotMatch(s.replace(/&amp;/g, ""), /&(?!lt;|gt;|quot;|#39;)/);
});

test("buildTelegramNotification: claim outcome accepted vs rejected differ; rejection is neutral", () => {
  const a = buildTelegramNotification("en", { ...base, kind: "CLAIM_OUTCOME", clientName: "Anna", accepted: true });
  const r = buildTelegramNotification("en", { ...base, kind: "CLAIM_OUTCOME", clientName: "Anna", accepted: false });
  assert.notEqual(a, r);
});

test("buildTelegramNotification: payout and match carry their figures", () => {
  const p = buildTelegramNotification("de", { ...base, kind: "PAYOUT", clientName: "Anna", amount: "1.000 €", creditNoteNumber: "CN-9" });
  assert.match(p, /1\.000 €/);
  assert.match(p, /CN-9/);
  const m = buildTelegramNotification("en", { ...base, kind: "MATCH", clientName: "Anna", projectName: "Sea <View>", changeType: "published", priceFrom: "€300,000" });
  assert.match(m, /Sea &lt;View&gt;/);
  assert.match(m, /€300,000/);
});

test("buildTelegramNotification: missing optional fields do not crash", () => {
  for (const kind of NOTIFICATION_KINDS) {
    const s = buildTelegramNotification("en", { ...base, kind });
    assert.ok(s.length > 0);
    assert.doesNotMatch(s, /undefined|null/);
  }
});

// ── limiter ─────────────────────────────────────────────────────────────────

test("makeChatLimiter: 30 per 10 minutes per chat", () => {
  const lim = makeChatLimiter();
  const t0 = 1_000_000;
  for (let i = 0; i < 30; i++) assert.equal(lim.hit("42", t0 + i), true);
  assert.equal(lim.hit("42", t0 + 31), false);
  assert.equal(lim.hit("43", t0 + 31), true);
  assert.equal(lim.hit("42", t0 + 10 * 60_000), true);
});
