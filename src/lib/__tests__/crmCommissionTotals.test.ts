import { test } from "node:test";
import assert from "node:assert/strict";
import { DEALS_SHOWN, capDeals, statusTotalsOf, withoutRateLabel } from "@/lib/crm/commissionTotals";

test("one row over the cap is loaded so truncation is known, not guessed", () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => i);
  assert.equal(DEALS_SHOWN, 300);
  assert.deepEqual(capDeals(rows(300)), { shown: rows(300), truncated: false }, "exactly 300 is complete");
  const over = capDeals(rows(301));
  assert.equal(over.shown.length, 300);
  assert.equal(over.truncated, true);
  assert.deepEqual(capDeals([]), { shown: [], truncated: false });
});

test("status totals count deals without a commission", () => {
  const totals = statusTotalsOf([
    { commissionStatus: "EXPECTED", _sum: { ourCommission: 12000 }, _count: { _all: 3, ourCommission: 2 } },
    { commissionStatus: "EARNED", _sum: { ourCommission: null }, _count: { _all: 1, ourCommission: 0 } },
  ]);
  assert.deepEqual(totals, [
    { status: "EXPECTED", count: 3, sum: 12000, withoutRate: 1 },
    { status: "EARNED", count: 1, sum: 0, withoutRate: 1 },
  ]);
});

test("the without-rate note only appears when some deal lacks a commission", () => {
  assert.equal(withoutRateLabel(0), null);
  assert.equal(withoutRateLabel(1), "1 without rate");
  assert.equal(withoutRateLabel(4), "4 without rate");
});
