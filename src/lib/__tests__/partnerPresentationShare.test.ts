import { test } from "node:test";
import assert from "node:assert/strict";
import { dict } from "@/lib/partner/i18n";
import { presentationMailto, presentationWhatsApp } from "@/lib/partner/presentationShare";

const base = { greetingName: "Anna", url: "https://cyprusvipestates.com/c/abc123", signer: "Sea Homes GmbH", updated: false };

test("mailto: prefilled subject and body in the presentation language, signed by the partner", () => {
  const m = presentationMailto(dict("de"), { ...base, email: "anna@example.com" })!;
  assert.ok(m.startsWith("mailto:anna@example.com?subject="));
  const q = new URLSearchParams(m.split("?")[1]);
  assert.equal(q.get("subject"), "Ihre persönliche Immobilienauswahl");
  assert.match(q.get("body")!, /^Guten Tag Anna,/);
  assert.match(q.get("body")!, /https:\/\/cyprusvipestates\.com\/c\/abc123/);
  assert.match(q.get("body")!, /Sea Homes GmbH$/);
  assert.doesNotMatch(q.get("subject")!, /Cyprus VIP Estates/);
});

test("no email or phone: no link", () => {
  assert.equal(presentationMailto(dict("en"), { ...base, email: null }), null);
  assert.equal(presentationMailto(dict("en"), { ...base, email: "not an email" }), null);
  assert.equal(presentationWhatsApp(dict("en"), { ...base, phone: null }), null);
  assert.equal(presentationWhatsApp(dict("en"), { ...base, phone: "123" }), null);
});

test("WhatsApp: digits only, updated text after an edit", () => {
  const w = presentationWhatsApp(dict("en"), { ...base, phone: "+357 99-123 456", updated: true })!;
  assert.ok(w.startsWith("https://wa.me/35799123456?text="));
  assert.match(decodeURIComponent(w.split("text=")[1]), /updated your property selection/);
  assert.ok(presentationWhatsApp(dict("en"), { ...base, phone: "0049 170 1234567" })!.startsWith("https://wa.me/491701234567?"));
});
