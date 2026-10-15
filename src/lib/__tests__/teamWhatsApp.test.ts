import { test } from "node:test";
import assert from "node:assert/strict";
import { notifyTeamWhatsApp, telegramHtmlToWhatsApp, teamWhatsAppChat } from "@/lib/teamWhatsApp";
import { buildInboundLeadTelegramMessage } from "@/lib/leadNotify";

/* Every new-lead Telegram also goes to the team WhatsApp group (2026-10-15). */
const GROUP = "120363430110854997@g.us";
const env = { META_LEAD_WHATSAPP_CHAT: GROUP } as any;
const fakeClient = (sent: { chatId: string; text: string }[], fail = false) => () => ({
  fetchThread: async () => [],
  sendText: async (chatId: string, text: string) => {
    if (fail) throw new Error("gateway down");
    sent.push({ chatId, text });
  },
});

const partner = buildInboundLeadTelegramMessage({
  source: "PARTNER", email: "a&b@example.com", name: "Anna <Test>", phone: "+357 99 000000", page: "/partners", language: "de", link: "https://cyprusvipestates.com/admin/crm/L1",
});

test("an inbound-lead Telegram becomes clean WhatsApp text", () => {
  const wa = telegramHtmlToWhatsApp(partner);
  assert.match(wa, /^\*New PARTNER lead\*/);
  assert.match(wa, /\*Anna <Test>\*/, "entities decoded");
  assert.match(wa, /Email: a&b@example\.com/);
  assert.match(wa, /https:\/\/cyprusvipestates\.com\/admin\/crm\/L1/, "link kept as bare URL");
  assert.doesNotMatch(wa, /<b>|<a |&amp;|&lt;/);
});

test("sends to the configured group only", async () => {
  const sent: { chatId: string; text: string }[] = [];
  assert.equal(await notifyTeamWhatsApp(partner, { env, client: fakeClient(sent) }), true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].chatId, GROUP);
  assert.match(sent[0].text, /New PARTNER lead/);
});

test("off without META_LEAD_WHATSAPP_CHAT — no call at all", async () => {
  const sent: { chatId: string; text: string }[] = [];
  assert.equal(await notifyTeamWhatsApp(partner, { env: {} as any, client: fakeClient(sent) }), false);
  assert.equal(sent.length, 0);
  assert.equal(teamWhatsAppChat({ META_LEAD_WHATSAPP_CHAT: " " } as any), null);
});

test("a gateway failure never throws into the lead route", async () => {
  assert.equal(await notifyTeamWhatsApp(partner, { env, client: fakeClient([], true) }), false);
});
