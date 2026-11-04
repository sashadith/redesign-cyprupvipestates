import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOfficeMail } from "@/lib/sendEmail";
import { sumWhatsAppSends, whatsAppSentTodayWhere } from "@/lib/openwa/sentToday";

test("office mail: from office, To joined, CC deduped against To and office, Reply-To office", () => {
  const m = buildOfficeMail(
    { to: ["a@dev.com", "b@dev.com"], cc: ["b@dev.com", "c@dev.com", "OFFICE@cve.com", "c@dev.com"], subject: "S", text: "T" },
    "office@cve.com",
    "<id@cyprusvipestates.com>",
  );
  assert.equal(m.from, "office@cve.com");
  assert.equal(m.to, "a@dev.com, b@dev.com");
  assert.equal(m.cc, "c@dev.com");
  assert.equal(m.replyTo, "office@cve.com");
  assert.equal(m.messageId, "<id@cyprusvipestates.com>");
  assert.equal(m.subject, "S");
  assert.equal(m.text, "T");
});

test("office mail: no cc key when nothing is left", () => {
  assert.equal("cc" in buildOfficeMail({ to: ["a@d.com"], cc: ["a@d.com"], subject: "S", text: "T" }, "o@c.com", "<x@y>"), false);
});

test("shared WhatsApp cap filter covers MCP sends and registration sends since the day start", () => {
  const since = new Date("2026-10-28T00:00:00Z");
  const w = whatsAppSentTodayWhere(since);
  const s = JSON.stringify(w);
  assert.match(s, /mcp-whatsapp/);
  assert.match(s, /developer_registration/);
  assert.match(s, /"whatsapp"/);
  assert.deepEqual(w.occurredAt, { gte: since });
});

test("a registration row counts once per number it reached", () => {
  assert.equal(
    sumWhatsAppSends([
      { type: "WHATSAPP_OUT", metadata: { via: "mcp-whatsapp" } },
      { type: "SYSTEM", metadata: { kind: "developer_registration", channel: "whatsapp", to: ["+3579", "+3578"] } },
      { type: "SYSTEM", metadata: { kind: "developer_registration", channel: "whatsapp", to: [] } },
    ]),
    4,
  );
});
