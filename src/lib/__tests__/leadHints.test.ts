import { test } from "node:test";
import assert from "node:assert/strict";
import { budgetCurrencyUnverified, emailEditData, leadHints, nameEmailMismatch, phoneKind } from "@/lib/crm/leadHints";

const meta = { source: "META_LEAD_AD", budgetMin: 2_000_000, budgetMax: 3_000_000 };

test("a Meta lead outside the euro area with a budget is flagged; euro countries and other sources are not", () => {
  assert.equal(budgetCurrencyUnverified({ ...meta, countryOfResidence: "ZA" }), true);
  assert.equal(budgetCurrencyUnverified({ ...meta, countryOfResidence: "GB" }), true);
  assert.equal(budgetCurrencyUnverified({ ...meta, countryOfResidence: "DE" }), false);
  assert.equal(budgetCurrencyUnverified({ ...meta, countryOfResidence: null }), false);
  assert.equal(budgetCurrencyUnverified({ ...meta, countryOfResidence: "ZA", source: "CONTACT_FORM" }), false);
  assert.equal(budgetCurrencyUnverified({ source: "META_LEAD_AD", countryOfResidence: "ZA", budgetMin: null, budgetMax: null }), false);
  assert.deepEqual(leadHints({ ...meta, countryOfResidence: "ZA" }).messages, ["Budget possibly in local currency (South Africa), not euros"]);
});

test("name vs email: a clear near-miss of the last name is flagged, everything else stays quiet", () => {
  assert.equal(nameEmailMismatch("Ashford", "john.ashworth@example.com"), "ashworth");
  assert.equal(nameEmailMismatch("Ashford", "jashworth77@gmail.com"), "jashworth");
  assert.equal(nameEmailMismatch("Müller", "k.mueller@web.de"), null); // German spelling of the same name
  assert.equal(nameEmailMismatch("Ashford", "john.ashford@example.com"), null);
  assert.equal(nameEmailMismatch("Ashford", "info@ashford-homes.co.uk"), null);
  assert.equal(nameEmailMismatch("Ashford", "info@example.com"), null);
  assert.equal(nameEmailMismatch("Ashford", "bigboss@example.com"), null);
  assert.equal(nameEmailMismatch("Li", "lee@example.com"), null);
  assert.equal(nameEmailMismatch("Oliva", "olidano@gmail.com"), null); // nickname (Oli + Dan), not a typo
  assert.equal(nameEmailMismatch("ashford", "Sueashworth567@btinternet.com"), "sueashworth"); // the real case
  assert.equal(nameEmailMismatch("Smith", null), null);
  const h = leadHints({ source: "CONTACT_FORM", countryOfResidence: "GB", lastName: "Ashford", email: "ashworth@example.com" });
  assert.equal(h.nameEmailMismatch, "ashworth");
  assert.match(h.messages[0], /Ashford.*ashworth/);
});

test("phone type: UK 01/02/03 and other landlines are flagged, mobiles and unclear numbers are not", () => {
  assert.equal(phoneKind("+44 1632 960123").kind, "landline");
  assert.equal(phoneKind("+44 20 7946 0958").kind, "landline");
  assert.equal(phoneKind("+44 3069 990123").kind, "landline");
  assert.equal(phoneKind("+44 7700 900123").kind, "mobile");
  assert.equal(phoneKind("0044 7700 900123").kind, "mobile");
  assert.equal(phoneKind("01632 960123", "GB").kind, "landline"); // national format, read with the country
  assert.equal(phoneKind("01632 960123", null).kind, "unknown");
  assert.equal(phoneKind("447700900123", "GB").kind, "mobile"); // country code stored without "+"
  assert.equal(phoneKind("+49 151 23456789").kind, "mobile");
  assert.equal(phoneKind("+49 211 1234567").kind, "landline");
  assert.equal(phoneKind("+27 82 555 1234").kind, "mobile");
  assert.equal(phoneKind("+27 11 555 1234").kind, "landline");
  assert.equal(phoneKind("+357 99 123456").kind, "mobile");
  assert.equal(phoneKind("+1 212 555 0100").kind, "unknown"); // +1 cannot be told apart
  assert.equal(phoneKind("+66 81 234 5678").kind, "unknown"); // no rule for the country
  assert.equal(phoneKind(null).kind, "unknown");
  const h = leadHints({ source: "META_LEAD_AD", countryOfResidence: "GB", phone: "+44 1632 960123" });
  assert.equal(h.phoneType, "landline");
  assert.deepEqual(h.messages, ["Landline number (United Kingdom) — probably no WhatsApp; call instead"]);
});

test("a bounced address is shown as a hint; changing the address clears the mark, re-casing does not", () => {
  const h = leadHints({ source: "CONTACT_FORM", countryOfResidence: null, emailInvalidAt: new Date("2026-11-04T08:00:00Z"), emailInvalidReason: "550 5.1.1 user unknown" });
  assert.equal(h.emailInvalid, true);
  assert.match(h.messages[0], /bounced on 2026-11-04 \(550 5\.1\.1 user unknown\)/);
  assert.deepEqual(emailEditData("a@x.com", "b@x.com"), { emailInvalidAt: null, emailInvalidReason: null });
  assert.deepEqual(emailEditData("a@x.com", " A@X.com "), {});
  assert.deepEqual(emailEditData("a@x.com", null), { emailInvalidAt: null, emailInvalidReason: null });
});
