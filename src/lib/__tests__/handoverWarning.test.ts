import { test } from "node:test";
import assert from "node:assert/strict";
import { PARTNER_LOCALES } from "@/lib/partner/i18n";
import { handoverAlertHtml, handoverWarning } from "@/lib/partner/pipeline/handoverCopy";

test("the downgrade warning shows the partner's real shares in every locale, with no exclamation mark", () => {
  for (const l of PARTNER_LOCALES) {
    const s = handoverWarning(l, 50, 30);
    assert.ok(s.includes("50 %"), `${l}: ${s}`);
    assert.ok(s.includes("30 %"), `${l}: ${s}`);
    assert.ok(!s.includes("!"), `${l}: ${s}`);
    assert.ok(s.indexOf("50 %") < s.indexOf("30 %"), `${l}: from FIX to Handover`);
  }
});

test("the en warning is the agreed text", () => {
  assert.equal(
    handoverWarning("en", 50, 30),
    "Do you really want to hand this client over now? They are not at the viewing stage yet. Once you confirm, the client moves from Fix to Handover and your commission drops from 50 % to 30 %.",
  );
});

test("the de warning says the same in the portal's Sie form", () => {
  const s = handoverWarning("de", 50, 30);
  assert.ok(s.includes("von Fix auf Handover"), s);
  assert.ok(s.includes("Ihre Provision sinkt von 50 % auf 30 %"), s);
});

test("a fractional share is written the locale's way", () => {
  assert.ok(handoverWarning("de", 32.5, 20).includes("32,5 %"));
  assert.ok(handoverWarning("en", 32.5, 20).includes("32.5 %"));
});

test("the manager's Telegram names partner, client and stage, escapes HTML and flags a downgrade", () => {
  const html = handoverAlertHtml({
    partnerName: "Anna <B>", client: "Max & Co", stage: "CONTACTED", note: "Arrives 12 Dec, <wants> sea view", downgrade: true,
    url: "https://x.test/crm/leads/1",
  });
  assert.ok(html.startsWith("Handover requested by partner Anna &lt;B&gt;: Max &amp; Co, stage Contacted. (downgrade to Handover on acceptance)"), html);
  assert.ok(html.includes("Arrives 12 Dec, &lt;wants&gt; sea view"), html);
  assert.ok(html.includes('<a href="https://x.test/crm/leads/1">'), html);
  const plain = handoverAlertHtml({ partnerName: "Anna", client: "Max", stage: "VIEWING_SCHEDULED", note: null, downgrade: false, url: "u" });
  assert.ok(!plain.includes("downgrade"), plain);
  assert.equal(plain.split("\n").length, 2, plain);
});
