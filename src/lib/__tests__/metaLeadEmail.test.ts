import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLeadMessage, buildLeadEmail } from "@/lib/metaLeadgen/notify";

/* Meta leads get the same notification by e-mail as by Telegram (2026-10-15). */
const tg = buildLeadMessage({
  outcome: "CREATED", language: "en", name: "Stephen Pattichis", email: "s@example.com", phone: "+447700900123",
  budget: "3-5", preferredChannel: "EMAIL", campaignName: "CVE Private Collection — UK Leads (Instant Form)",
  formName: "CVE PC Briefing EN v2", placeholderReason: null, unmatchedCount: 0, leadId: "lead-1",
} as any);

test("subject names the lead; an existing lead is labelled as such", () => {
  assert.equal(buildLeadEmail(tg, { outcome: "CREATED", name: "Stephen Pattichis" }).subject, "New Meta lead: Stephen Pattichis");
  assert.match(buildLeadEmail(tg, { outcome: "ATTACHED", name: "Stephen Pattichis" }).subject, /existing lead.*Stephen Pattichis/);
  assert.equal(buildLeadEmail(tg, { outcome: "CREATED", name: "  " }).subject, "New Meta lead: unknown");
});

test("the plain-text body carries every fact of the Telegram, without tags or entities", () => {
  const { text } = buildLeadEmail(tg, { outcome: "CREATED", name: "Stephen Pattichis" });
  for (const s of ["New Private Collection lead", "Stephen Pattichis", "s@example.com", "+447700900123", "Campaign: CVE Private Collection — UK Leads (Instant Form)", "/admin/crm/lead-1"]) {
    assert.ok(text.includes(s), s);
  }
  assert.doesNotMatch(text, /<[a-z/]|&amp;|&lt;|&gt;/);
});

test("the HTML body keeps the link and the line breaks", () => {
  const { html } = buildLeadEmail(tg, { outcome: "CREATED", name: "x" });
  assert.match(html, /<a href="[^"]*\/admin\/crm\/lead-1">/);
  assert.ok(html.split("<br/>").length >= 5);
});

test("the testbed prefix reaches the subject too", () => {
  process.env.NOTIFY_PREFIX = "[TEST]";
  try {
    assert.equal(buildLeadEmail(tg, { outcome: "CREATED", name: "A B" }).subject, "[TEST] New Meta lead: A B");
  } finally {
    delete process.env.NOTIFY_PREFIX;
  }
});

/* …and to the team WhatsApp group (2026-10-15). */
import { buildLeadWhatsApp, leadWhatsAppChat } from "@/lib/metaLeadgen/notify";

test("WhatsApp text: *bold* instead of <b>, bare CRM link, no tags or entities", () => {
  const wa = buildLeadWhatsApp(tg);
  assert.match(wa, /\*New Private Collection lead \(UK\)\*/);
  assert.match(wa, /\*Stephen Pattichis\*/);
  assert.match(wa, /https?:\/\/\S+\/admin\/crm\/lead-1/);
  assert.match(wa, /Campaign: CVE Private Collection — UK Leads \(Instant Form\)/);
  assert.doesNotMatch(wa, /<[a-z/]|&amp;|&lt;|&gt;/);
});

test("WhatsApp is off unless META_LEAD_WHATSAPP_CHAT is set", () => {
  assert.equal(leadWhatsAppChat({} as any), null);
  assert.equal(leadWhatsAppChat({ META_LEAD_WHATSAPP_CHAT: "  " } as any), null);
  assert.equal(leadWhatsAppChat({ META_LEAD_WHATSAPP_CHAT: "120363430110854997@g.us" } as any), "120363430110854997@g.us");
});
