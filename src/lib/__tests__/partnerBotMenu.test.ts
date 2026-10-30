import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CLIENTS_PER_PAGE, botCommandLists, channelScreen, clientScreen, clientsScreen, languageScreen, mainMenu, notifyScreen, overviewScreen,
  parseMenuAction, projectsScreen, quietScreen, settingsScreen, type MenuScreen,
} from "@/lib/partner/telegramMenu";
import { inQuietHours, parseQuietPreset, quietEndsAt, quietWindow, quietLabel } from "@/lib/partner/notifyPrefs";
import { extractCallback } from "@/lib/partner/telegramBot";
import { parseBotCommand } from "@/lib/partner/telegram";
import { PARTNER_LOCALES } from "@/lib/partner/i18n";

const PORTAL = "https://partner.cyprusvipestates.com";
const UUID = "6e3475a1-9444-48c5-a253-1b386af669ac";
const src = (p: string) => readFileSync(p, "utf8");
const datas = (s: MenuScreen) => s.keyboard.flat().flatMap((b) => ("callback_data" in b ? [b.callback_data] : []));

// ── Callback data ───────────────────────────────────────────────────────────

test("menu actions: every button this module emits parses; forged or stale data does not", () => {
  const settings = { language: "de" as const, quiet: [22, 8] as [number, number], channel: "BOTH" as const,
    switches: { notifyClients: true, notifyNewProjects: false, notifyProjectUpdates: true, notifyReminders: true, digestOptIn: true } };
  for (const l of PARTNER_LOCALES) {
    const screens = [
      mainMenu(l, PORTAL), settingsScreen(l, settings), languageScreen(l, l), quietScreen(l, null), notifyScreen(l, settings.switches), channelScreen(l, "BOTH"),
      clientsScreen(l, { items: [{ id: UUID, name: "Anna", stageKey: "stages.viewing" }], page: 2, pages: 3, more: false }),
    ];
    for (const s of screens) for (const d of datas(s)) {
      assert.ok(Buffer.byteLength(d) <= 64, `${d} fits Telegram's 64 bytes`);
      assert.ok(parseMenuAction(d), `${l}: ${d} parses`);
    }
  }
  assert.deepEqual(parseMenuAction(`cl:${UUID}`), { a: "client", id: UUID });
  assert.deepEqual(parseMenuAction("sq:22-8"), { a: "setQuiet", window: [22, 8] });
  assert.deepEqual(parseMenuAction("sq:off"), { a: "setQuiet", window: null });
  assert.deepEqual(parseMenuAction("sn:4"), { a: "toggle", key: "digestOptIn" });
  for (const bad of ["cl:../x", "cl:1", "sl:he", "sl:xx", "sq:3-4", "sq:22-8:1", "sn:9", "sn:01", "sc:E", "c:0", "c:99", "zz", "", null, 5, "x".repeat(65)]) {
    assert.equal(parseMenuAction(bad), null, String(bad));
  }
});

test("button presses: private chats only, sane ids", () => {
  const cb = (o: Record<string, unknown> = {}) => ({
    callback_query: { id: "q1", data: "m", message: { message_id: 7, chat: { id: 123, type: "private" } }, ...o },
  });
  assert.deepEqual(extractCallback(cb()), { id: "q1", chatId: "123", messageId: 7, data: "m" });
  assert.equal(extractCallback(cb({ message: { message_id: 7, chat: { id: 1, type: "group" } } })), null);
  assert.equal(extractCallback(cb({ data: "x".repeat(65) })), null);
  assert.equal(extractCallback(cb({ message: undefined })), null, "inline-mode presses have no message");
  assert.equal(extractCallback({ message: { text: "/menu" } }), null);
  assert.deepEqual(parseBotCommand("/menu"), { cmd: "menu" });
});

// ── Screens ─────────────────────────────────────────────────────────────────

test("screens: escaped values, portal links only over https, a way back everywhere", () => {
  for (const l of PARTNER_LOCALES) {
    assert.ok(mainMenu(l, PORTAL).keyboard.flat().some((b) => "url" in b && b.url === `${PORTAL}/submit`));
    assert.ok(!mainMenu(l, "").keyboard.flat().some((b) => "url" in b), "no relative links without PARTNER_HOST");
    const ov = overviewScreen(l, {
      counts: { active: 3, inReview: 1, viewings: 1, closed: 0 },
      commission: [{ stage: "EXPECTED", amount: "€4,500" }],
      tier: { name: "Silver <b>", next: { name: "Gold", remaining: 2 } },
    });
    assert.ok(ov.html.includes("€4,500") && ov.html.includes("Silver &lt;b&gt;"));
    const cl = clientScreen(l, { name: "Anna <script>", stageKey: "stages.viewing", protectedUntil: "2 Dec 2026", url: `${PORTAL}/clients/${UUID}` });
    assert.ok(cl.html.includes("Anna &lt;script&gt;") && cl.html.includes("2 Dec 2026"));
    const pr = projectsScreen(l, { items: [{ name: "Sea & Sun", town: "Paphos", detail: "Your rate: 1.5%", url: "https://cyprusvipestates.com/projects/sea" }] });
    assert.ok(pr.html.includes("Sea &amp; Sun") && pr.html.includes('href="https://cyprusvipestates.com/projects/sea"'));
    for (const s of [ov, cl, pr, languageScreen(l, l), quietScreen(l, [22, 8]), channelScreen(l, "TELEGRAM")]) {
      assert.ok(datas(s).some((d) => d === "m" || d === "s" || d.startsWith("c:")), "back button");
    }
  }
});

test("client list: pages of 8, previous/next only where they lead somewhere", () => {
  const items = Array.from({ length: CLIENTS_PER_PAGE }, (_, i) => ({ id: UUID, name: `Client ${i} with a very long name indeed`, stageKey: "stages.offer" }));
  const first = clientsScreen("en", { items, page: 1, pages: 2, more: false });
  assert.deepEqual(datas(first).filter((d) => d.startsWith("c:")), ["c:2"]);
  const last = clientsScreen("en", { items, page: 2, pages: 2, more: true });
  assert.deepEqual(datas(last).filter((d) => d.startsWith("c:")), ["c:1"]);
  assert.ok(last.html.includes("More clients in the portal."));
  assert.ok(first.keyboard[0][0].text.length <= 60, "labels are clipped");
  assert.ok(clientsScreen("de", { items: [], page: 1, pages: 1, more: false }).html.includes("keine aktiven Kunden"));
});

test("settings: current values shown, ticks on the active choice, toggles show their state", () => {
  const sw = { notifyClients: true, notifyNewProjects: false, notifyProjectUpdates: true, notifyReminders: true, digestOptIn: false };
  const s = settingsScreen("de", { language: "de", quiet: [22, 8], channel: "TELEGRAM", switches: sw }, true);
  assert.ok(s.html.includes("Deutsch") && s.html.includes("22:00–08:00") && s.html.includes("Nur Telegram") && s.html.includes("Gespeichert"));
  assert.ok(languageScreen("en", "pl").keyboard.flat().some((b) => b.text === "✓ Polski"));
  assert.ok(quietScreen("en", null).keyboard.flat().some((b) => b.text === "✓ Off"));
  const n = notifyScreen("en", sw).keyboard.flat().map((b) => b.text);
  assert.ok(n.includes("⬜️ New projects") && n.includes("✅ Client updates and messages") && n.includes("⬜️ Weekly summary"));
  assert.ok(channelScreen("en", "BOTH").keyboard.flat().some((b) => b.text === "✓ Telegram and e-mail"));
});

test("command list: menu first, every language, Telegram's description limits", () => {
  const lists = botCommandLists();
  assert.deepEqual(Object.keys(lists).sort(), ["", "de", "pl", "ru"]);
  for (const list of Object.values(lists)) {
    assert.equal(list[0].command, "menu");
    for (const c of list) assert.ok(/^[a-z]{1,32}$/.test(c.command) && c.description.length >= 3 && c.description.length <= 256);
  }
});

// ── Quiet hours ─────────────────────────────────────────────────────────────

test("quiet hours: wrap midnight in Cyprus time, end on the next full hour, presets only", () => {
  // 2026-11-02 is winter time: Cyprus = UTC+2.
  const w: [number, number] = [22, 8];
  assert.equal(inQuietHours(new Date("2026-11-02T20:30:00Z"), w), true, "22:30 Cyprus");
  assert.equal(inQuietHours(new Date("2026-11-02T05:59:00Z"), w), true, "07:59 Cyprus");
  assert.equal(inQuietHours(new Date("2026-11-02T06:00:00Z"), w), false, "08:00 Cyprus");
  assert.equal(inQuietHours(new Date("2026-11-02T19:59:00Z"), w), false, "21:59 Cyprus");
  assert.equal(quietEndsAt(new Date("2026-11-02T20:30:00Z"), w)?.toISOString(), "2026-11-03T06:00:00.000Z");
  assert.equal(quietEndsAt(new Date("2026-11-02T10:00:00Z"), w), null);
  // Summer time (UTC+3): 23–7 ends at 04:00 UTC.
  assert.equal(quietEndsAt(new Date("2026-07-01T21:00:00Z"), [23, 7])?.toISOString(), "2026-07-02T04:00:00.000Z");
  assert.equal(quietWindow(null, null), null);
  assert.equal(quietWindow(5, 5), null);
  assert.equal(quietWindow(24, 8), null);
  assert.equal(parseQuietPreset("3-4"), undefined);
  assert.equal(parseQuietPreset("off"), null);
  assert.equal(quietLabel([22, 8], "Off"), "22:00–08:00");
});

test("wiring: callbacks routed and rate-limited; settings only for the chat's own partner; quiet hours held in the sender", () => {
  const route = src("src/app/api/webhooks/partner-telegram/route.ts");
  assert.ok(route.includes("if (chatLimiter.hit(cb.chatId)) await handlePartnerBotCallback(cb);"));
  const hook = src("src/lib/partner/telegramWebhook.ts");
  assert.ok(hook.includes("const found = await loadMenuPartner(cb.chatId);") && hook.includes('if (!found || found.status !== "ACTIVE")'));
  assert.ok(hook.includes("const where = { id: p.id };"), "writes are keyed by the linked partner, never by button data");
  assert.ok(hook.includes("const c = await getMyClient(p.id, action.id);"), "client detail is partner-scoped");
  const send = src("src/lib/partner/notifySend.ts");
  assert.ok(send.includes("quietUntil: sendTelegram ? quietEndsAt(now, quietWindow(partner.quietFrom, partner.quietTo)) : null,"));
  assert.ok(send.includes("data: { sentAt: null, error: null, notBefore: quietUntil }"));
  assert.ok(send.includes("refKey: `${row.refKey}#tg`"));
  const api = src("src/lib/partner/telegramApi.ts");
  assert.ok(api.includes('allowed_updates: ["message", "callback_query"]'));
});
