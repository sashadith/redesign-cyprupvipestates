import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRate } from "@/lib/crm/rateForm";
test("plain, decimal-comma and percent-sign inputs parse", () => {
  assert.deepEqual(parseRate("10"), { ok: true, value: 10 });
  assert.deepEqual(parseRate("5,5"), { ok: true, value: 5.5 });
  assert.deepEqual(parseRate(" 7.25 % "), { ok: true, value: 7.25 });
});
test("out-of-range and over-precise rates are rejected", () => {
  for (const bad of ["0", "-1", "100.01", "5.555", "abc", ""]) assert.equal(parseRate(bad).ok, false, bad);
  assert.deepEqual(parseRate("100"), { ok: true, value: 100 });
});
