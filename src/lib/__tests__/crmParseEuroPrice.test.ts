import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEuroPrice } from "@/lib/crm/parseEuroPrice";

test("plain digits", () => {
  assert.equal(parseEuroPrice("412000"), 412000);
  assert.equal(parseEuroPrice(" 412000 "), 412000);
});

test("thousands separators: space, dot, comma, nbsp", () => {
  assert.equal(parseEuroPrice("412 000"), 412000);
  assert.equal(parseEuroPrice("412.000"), 412000);
  assert.equal(parseEuroPrice("1,250,000"), 1250000);
  assert.equal(parseEuroPrice("1 250 000"), 1250000);
  assert.equal(parseEuroPrice("€ 412.000"), 412000);
});

test("rejects cents, letters, ragged groups, zero and empty", () => {
  for (const bad of ["", "0", "000", "412,000.50", "412.5", "41 20 00", "abc", "12k", "-5", "1,2345"]) {
    assert.equal(parseEuroPrice(bad), null, bad);
  }
});
