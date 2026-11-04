import { test } from "node:test";
import assert from "node:assert/strict";
import { budgetCurrencyUnverified, leadHints, nameEmailMismatch } from "@/lib/crm/leadHints";

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
  assert.equal(nameEmailMismatch("Smith", null), null);
  const h = leadHints({ source: "CONTACT_FORM", countryOfResidence: "GB", lastName: "Ashford", email: "ashworth@example.com" });
  assert.equal(h.nameEmailMismatch, "ashworth");
  assert.match(h.messages[0], /Ashford.*ashworth/);
});
