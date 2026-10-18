import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSiteButtonMessage } from "@/lib/openwa/siteButtonMessage";
import { leadNameFrom, buttonLeadTelegram } from "@/lib/openwa/buttonLead";
import { processInboundWhatsApp } from "@/lib/openwa/inboundMessage";
import { messageWithUrl } from "@/app/components/WhatAppButtonProject/WhatAppButtonProject.copy";

// The exact text the project button produced for lead V on 2026-10-17.
const LA_MER =
  "Hello, I’m interested in buying property in Cyprus. Could you help me find suitable villas or apartments?\n\n" +
  "I'm sending this message from the page: https://cyprusvipestates.com/projects/la-mer";

test("parse: the real La Mer message → project slug, en", () => {
  const p = parseSiteButtonMessage(LA_MER);
  assert.ok(p);
  assert.equal(p.projectSlug, "la-mer");
  assert.equal(p.lang, "en");
  assert.equal(p.pageUrl, "https://cyprusvipestates.com/projects/la-mer");
  assert.equal(p.utmSource, null);
});

test("parse: every locale's button text is recognised, language from the marker", () => {
  for (const [lang, prefix] of Object.entries(messageWithUrl)) {
    const p = parseSiteButtonMessage(`${prefix} https://cyprusvipestates.com/projects/x-y`);
    assert.ok(p, `marker for ${lang} not recognised`);
    assert.equal(p.lang, lang);
    assert.equal(p.projectSlug, "x-y");
  }
});

test("parse: a language prefix in the URL wins over the marker language", () => {
  const p = parseSiteButtonMessage(`${messageWithUrl.en} https://cyprusvipestates.com/de/projects/la-mer`);
  assert.equal(p?.lang, "de");
  assert.equal(p?.projectSlug, "la-mer");
});

test("parse: a non-project page is still an enquiry, without a project", () => {
  const p = parseSiteButtonMessage(`${messageWithUrl.ru} https://www.cyprusvipestates.com/ru/blog/some-article`);
  assert.ok(p);
  assert.equal(p.projectSlug, null);
  assert.equal(p.lang, "ru");
});

test("parse: the attribution tag after the URL is read; the URL's own query wins", () => {
  const tagged = parseSiteButtonMessage(`${messageWithUrl.en} https://cyprusvipestates.com/projects/a (utm_source=alfitouri, ref=p42)`);
  assert.equal(tagged?.utmSource, "alfitouri");
  assert.equal(tagged?.attributionRef, "p42");
  const inUrl = parseSiteButtonMessage(`${messageWithUrl.en} https://cyprusvipestates.com/projects/a?utm_source=fb (utm_source=other)`);
  assert.equal(inUrl?.utmSource, "fb");
  assert.equal(inUrl?.projectSlug, "a");
});

test("parse: curly vs straight apostrophe in the marker does not matter", () => {
  assert.ok(parseSiteButtonMessage(LA_MER.replace("I'm sending", "I’m sending")));
});

test("parse: not a button message → null", () => {
  assert.equal(parseSiteButtonMessage("Hi, is the La Mer penthouse still available?"), null);
  assert.equal(parseSiteButtonMessage(null), null);
  // Marker but someone else's site.
  assert.equal(parseSiteButtonMessage(`${messageWithUrl.en} https://example.com/projects/la-mer`), null);
  // Our URL without the marker (e.g. we sent them a link and they quoted it).
  assert.equal(parseSiteButtonMessage("see https://cyprusvipestates.com/projects/la-mer"), null);
});

test("parse: a hostile slug is dropped, the enquiry is kept", () => {
  const p = parseSiteButtonMessage(`${messageWithUrl.en} https://cyprusvipestates.com/projects/%27%3B--`);
  assert.ok(p);
  assert.equal(p.projectSlug, null);
});

test("leadNameFrom: display name split, fallback when empty", () => {
  assert.deepEqual(leadNameFrom("Viktor Hansen"), { firstName: "Viktor", lastName: "Hansen" });
  assert.deepEqual(leadNameFrom("V"), { firstName: "V", lastName: "" });
  assert.deepEqual(leadNameFrom("  "), { firstName: "WhatsApp lead", lastName: "" });
  assert.deepEqual(leadNameFrom(null), { firstName: "WhatsApp lead", lastName: "" });
});

test("telegram text: escapes the visitor's text, links the CRM", () => {
  const site = parseSiteButtonMessage(LA_MER)!;
  const t = buttonLeadTelegram({ name: "<b>x</b>", phone: "+4917683399489", site, projectTitle: "La Mer", body: "a<b", crmLink: "https://x/admin/crm/1" });
  assert.match(t, /New WhatsApp lead/);
  assert.match(t, /Project: La Mer/);
  assert.match(t, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(t, /a&lt;b/);
  assert.match(t, /<a href="https:\/\/x\/admin\/crm\/1">/);
});

test("inbound: an @lid sender the gateway cannot resolve is skipped, never guessed", async () => {
  const r = await processInboundWhatsApp(
    { id: "m1", from: "131232977416246@lid", body: LA_MER, senderPhone: null },
    { resolvePhone: async () => null },
  );
  assert.deepEqual(r, { status: "skipped", reason: "unresolved-lid" });
});

test("inbound: a failing phone lookup counts as unresolved, not as an error", async () => {
  const r = await processInboundWhatsApp(
    { id: "m1", from: "131232977416246@lid", body: LA_MER },
    { resolvePhone: async () => { throw new Error("gateway down"); } },
  );
  assert.deepEqual(r, { status: "skipped", reason: "unresolved-lid" });
});

test("inbound: group traffic stays out, even with button text", async () => {
  const r = await processInboundWhatsApp({ id: "m1", from: "120363430110854997@g.us", body: LA_MER });
  assert.deepEqual(r, { status: "skipped", reason: "not-a-chat" });
});
