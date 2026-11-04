import { test } from "node:test";
import assert from "node:assert/strict";
import { budgetCurrencyUnverified, leadHints } from "@/lib/crm/leadHints";

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
