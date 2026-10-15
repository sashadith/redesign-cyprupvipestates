import { test } from "node:test";
import assert from "node:assert/strict";
import { selectionPriceFrom } from "@/lib/crm/selectionPriceFrom";

/* Avalon Valley, 2026-10-15: project-level priceFrom €213,000 (a studio), the
   lead's Villa filter matched only villas from €522,000. */
const u = (id: string, price: number | null, status = "available") => ({ id, price, status });
const villas = [u("v30", 522000), u("v1", 622000), u("v-sold", 448000, "sold"), u("v-unl", 510000, "unlisted")];

test("the cheapest AVAILABLE matched unit, not the project's cheapest unit", () => {
  assert.equal(selectionPriceFrom(villas, null, 213000), 522000);
});

test("follows the admin's hand selection", () => {
  assert.equal(selectionPriceFrom(villas, ["v1"], 213000), 622000);
});

test("sold, unlisted and unpriced units never set the price", () => {
  assert.equal(selectionPriceFrom([u("a", null), u("b", 0), u("c", 300000, "sold")], null, 213000), null);
});

test("units exist but none selected → no price (—), not the project price", () => {
  assert.equal(selectionPriceFrom(villas, [], 213000), null);
});

test("no unit data at all → the project's own priceFrom", () => {
  assert.equal(selectionPriceFrom([], null, 213000), 213000);
});
