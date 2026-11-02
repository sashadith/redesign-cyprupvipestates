import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NAG_ALARM_DAYS, NAG_TEXT_MAX, buildNagMessage, extractNagCallback, maySnooze, nagCallbackData, nagCounts, nagItems, nagSlot,
  parseNagCallback, parseOfficeCommand, routeNag, shortName, snoozeUntil, withoutLeadRow, type NagLead, type NagUser,
} from "@/lib/crm/leadNag";

const DAY = 86_400_000;
// Saturday 31 Oct 2026, 10:00 Cyprus (UTC+2 since 25 Oct).
const NOW = new Date("2026-10-31T08:00:00Z");
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const lead = (n: number, o: Partial<NagLead> = {}): NagLead => ({
  id: id(n), firstName: `First${n}`, lastName: `Last${n}`, status: "CONTACTED", createdAt: new Date(NOW.getTime() - 30 * DAY),
  lastContactAt: new Date(NOW.getTime() - 2 * DAY), nextFollowUpAt: null, viewingScheduledAt: null, assignedToId: null, ...o,
});

test("nagSlot: only 10, 12, 15 and 18 Cyprus time, DST-proof", () => {
  assert.equal(nagSlot(new Date("2026-10-31T08:05:00Z")), 10); // winter, UTC+2
  assert.equal(nagSlot(new Date("2026-10-31T10:00:00Z")), 12);
  assert.equal(nagSlot(new Date("2026-10-31T13:00:00Z")), 15);
  assert.equal(nagSlot(new Date("2026-10-31T16:00:00Z")), 18);
  assert.equal(nagSlot(new Date("2026-10-31T09:00:00Z")), null);
  assert.equal(nagSlot(new Date("2026-07-01T07:00:00Z")), 10); // summer, UTC+3
});

test("nagItems: the pipeline's red/yellow rule, most overdue first; done follow-ups drop out", () => {
  const items = nagItems([
    lead(1, { nextFollowUpAt: new Date(NOW.getTime() - 9 * DAY), lastContactAt: new Date(NOW.getTime() - 12 * DAY) }),
    lead(2, { nextFollowUpAt: new Date(NOW.getTime() - 1 * DAY), lastContactAt: new Date(NOW.getTime() - 5 * DAY) }),
    lead(3, { nextFollowUpAt: new Date(NOW.getTime() + 2 * 3_600_000) }), // later today → act now
    lead(4, { nextFollowUpAt: new Date(NOW.getTime() + 3 * DAY) }), // planned → nothing
    lead(5, { status: "LOST", nextFollowUpAt: new Date(NOW.getTime() - 5 * DAY) }), // not active → nothing
    // Follow-up 3 days ago, but a call was logged yesterday → answered, not red.
    lead(6, { nextFollowUpAt: new Date(NOW.getTime() - 3 * DAY), lastContactAt: new Date(NOW.getTime() - 1 * DAY) }),
  ], NOW);
  assert.deepEqual(items.map((i) => i.leadId), [id(1), id(2), id(3)]);
  assert.equal(items[0].urgency.level, "overdue");
  assert.equal(items[2].urgency.level, "now");
  assert.deepEqual(nagCounts(items), { overdue: 2, now: 1 });
});

test("routeNag: own chat when linked, else the owner (private chat, else office chat); nothing dropped", () => {
  const users: NagUser[] = [
    { id: "o", name: "Sascha Dith", isOwner: true, isActive: true, telegramChatId: null },
    { id: "a", name: "Aliaksandr B", isOwner: false, isActive: true, telegramChatId: "111" },
    { id: "b", name: "Alisher M", isOwner: false, isActive: true, telegramChatId: null },
    { id: "x", name: "Gone", isOwner: false, isActive: false, telegramChatId: "222" },
  ];
  const r = routeNag([lead(1, { assignedToId: "a" }), lead(2, { assignedToId: "b" }), lead(3), lead(4, { assignedToId: "o" }), lead(5, { assignedToId: "x" })], users, "-100");
  assert.deepEqual(r.get("111")!.leads.map((l) => l.id), [id(1)]);
  const office = r.get("-100")!;
  assert.deepEqual(office.leads.map((l) => l.id), [id(2), id(3), id(4), id(5)]);
  assert.deepEqual(Array.from(office.foreign).sort(), [id(2), id(5)], "others' leads are named in the owner's list");
  assert.equal(r.has("222"), false, "an inactive user's chat gets nothing");
  const linkedOwner = routeNag([lead(3)], [{ ...users[0], telegramChatId: "999" }], "-100");
  assert.ok(linkedOwner.has("999") && !linkedOwner.has("-100"));
});

test("buildNagMessage: headline per slot, louder with age, links and two buttons per lead", () => {
  const items = nagItems([
    lead(1, { nextFollowUpAt: new Date(NOW.getTime() - (NAG_ALARM_DAYS + 2) * DAY), lastContactAt: new Date(NOW.getTime() - 20 * DAY) }),
    lead(2, { nextFollowUpAt: new Date(NOW.getTime() - 4 * DAY), lastContactAt: new Date(NOW.getTime() - 9 * DAY) }),
    lead(3, { nextFollowUpAt: new Date(NOW.getTime() - 1 * DAY), lastContactAt: new Date(NOW.getTime() - 5 * DAY) }),
    lead(4, { nextFollowUpAt: new Date(NOW.getTime() + 3_600_000) }),
  ], NOW);
  const m = buildNagMessage(items, { slot: 10, crmBase: "https://cve.test/" })!;
  assert.ok(m.text.startsWith("🔔 <b>Leads need you</b> — 3 leads overdue, 1 due today"));
  assert.ok(m.text.includes(`🚨 <b><a href="https://cve.test/crm/leads/${id(1)}">First1 Last1</a> — left alone for ${NAG_ALARM_DAYS + 2} days</b>`));
  assert.ok(m.text.includes("🔴🔴 <a"), "4 days late doubles the mark");
  assert.ok(m.text.includes("🔴 <a") && m.text.includes("<b>Overdue 1d</b>"));
  assert.ok(m.text.includes("🟡 <a"));
  assert.equal(m.keyboard.length, 4);
  assert.deepEqual(m.keyboard[0].map((b) => b.callback_data), [nagCallbackData(1, id(1)), nagCallbackData(3, id(1))]);
  assert.ok(buildNagMessage(items, { slot: 15, crmBase: "https://cve.test" })!.text.startsWith("🔔 <b>Still open at 15:00</b>"));
  assert.equal(buildNagMessage([], { slot: 10, crmBase: "x" }), null, "nothing due → no message");
});

test("buildNagMessage: escapes names, stays under Telegram's limit, counts the rest", () => {
  const many = Array.from({ length: 60 }, (_, i) => lead(i + 1, {
    firstName: `<b>Évelyne ${i}`, lastName: "O'Brien & Söhne Longname".repeat(2), nextFollowUpAt: new Date(NOW.getTime() - 2 * DAY), lastContactAt: new Date(NOW.getTime() - 9 * DAY),
  }));
  const m = buildNagMessage(nagItems(many, NOW), { slot: 12, crmBase: "https://cve.test" })!;
  assert.ok(m.text.length <= NAG_TEXT_MAX);
  assert.ok(!m.text.includes("<b>Évelyne") && m.text.includes("&lt;b&gt;Évelyne"));
  assert.ok(/…and \d+ more/.test(m.text));
  assert.ok(m.keyboard.length < 60 && m.keyboard.length >= 1);
  for (const row of m.keyboard) for (const b of row) assert.ok(b.text.length <= 64 && b.callback_data.length <= 64);
});

test("buttons: callback data round-trips; only 1 or 3 days; a uuid lead id", () => {
  assert.deepEqual(parseNagCallback(nagCallbackData(1, id(7))), { days: 1, leadId: id(7) });
  assert.deepEqual(parseNagCallback(nagCallbackData(3, id(7))), { days: 3, leadId: id(7) });
  assert.equal(parseNagCallback(nagCallbackData(9, id(7))), null);
  assert.equal(parseNagCallback("nag:1:not-a-uuid"), null);
  assert.equal(parseNagCallback("menu:clients"), null);
  assert.equal(shortName("Anna Maria Müller"), "Anna M.");
  assert.equal(shortName("Cher"), "Cher");
});

test("snoozeUntil: 09:00 Cyprus on the chosen day, across the DST change", () => {
  assert.equal(snoozeUntil(NOW, 1).toISOString(), "2026-11-01T07:00:00.000Z");
  assert.equal(snoozeUntil(NOW, 3).toISOString(), "2026-11-03T07:00:00.000Z");
  assert.equal(snoozeUntil(new Date("2026-10-24T08:00:00Z"), 1).toISOString(), "2026-10-25T07:00:00.000Z", "25 Oct is already winter time");
  assert.equal(snoozeUntil(new Date("2026-07-01T08:00:00Z"), 1).toISOString(), "2026-07-02T06:00:00.000Z");
});

test("maySnooze: office chat any lead; an employee only their own; owner's private chat any", () => {
  const emp: NagUser = { id: "a", name: "A", isOwner: false, isActive: true, telegramChatId: "1" };
  assert.equal(maySnooze({ chatId: "-100", officeChatId: "-100", chatUser: null, leadAssignedToId: "zz" }), true);
  assert.equal(maySnooze({ chatId: "1", officeChatId: "-100", chatUser: emp, leadAssignedToId: "a" }), true);
  assert.equal(maySnooze({ chatId: "1", officeChatId: "-100", chatUser: emp, leadAssignedToId: "b" }), false);
  assert.equal(maySnooze({ chatId: "1", officeChatId: "-100", chatUser: { ...emp, isActive: false }, leadAssignedToId: "a" }), false);
  assert.equal(maySnooze({ chatId: "9", officeChatId: "-100", chatUser: { ...emp, isOwner: true }, leadAssignedToId: "b" }), true);
  assert.equal(maySnooze({ chatId: "5", officeChatId: "-100", chatUser: null, leadAssignedToId: "a" }), false);
});

test("withoutLeadRow drops only that lead's row", () => {
  const kb = [[{ text: "a", callback_data: nagCallbackData(1, id(1)) }, { text: "b", callback_data: nagCallbackData(3, id(1)) }], [{ text: "c", callback_data: nagCallbackData(1, id(2)) }]];
  assert.deepEqual(withoutLeadRow(kb, id(1)), [kb[1]]);
});

test("extractNagCallback: private and group chats, keyboard kept, junk refused", () => {
  const u = (chatType: string, extra: Record<string, unknown> = {}) => ({
    callback_query: {
      id: "q1", data: nagCallbackData(1, id(1)), from: { first_name: "Sascha", last_name: "D" },
      message: { message_id: 7, chat: { id: -100123, type: chatType }, reply_markup: { inline_keyboard: [[{ text: "x", callback_data: "nag:1:y" }, { text: "u", url: "https://x" }]] } },
      ...extra,
    },
  });
  const g = extractNagCallback(u("supergroup"))!;
  assert.equal(g.chatId, "-100123");
  assert.equal(g.fromName, "Sascha D");
  assert.deepEqual(g.keyboard, [[{ text: "x", callback_data: "nag:1:y" }]]);
  assert.ok(extractNagCallback(u("private")));
  assert.equal(extractNagCallback(u("channel")), null);
  assert.equal(extractNagCallback({ callback_query: { id: "q", data: "x".repeat(65), message: { message_id: 1, chat: { id: 1, type: "private" } } } }), null);
  assert.equal(extractNagCallback(null), null);
});

test("parseOfficeCommand", () => {
  assert.deepEqual(parseOfficeCommand("/start abcDEF_123-xyz9876"), { start: "abcDEF_123-xyz9876" });
  assert.deepEqual(parseOfficeCommand("/start@cyprusvipestates_bot code1234567890123"), { start: "code1234567890123" });
  assert.deepEqual(parseOfficeCommand("/start"), { start: "" });
  assert.deepEqual(parseOfficeCommand("/stop"), { stop: true });
  assert.deepEqual(parseOfficeCommand("hello"), {});
  assert.deepEqual(parseOfficeCommand("/start a b"), {});
});
