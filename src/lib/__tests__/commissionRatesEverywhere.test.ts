import { test } from "node:test";
import assert from "node:assert/strict";
import { effectiveRates, fmtRate, toRateRows } from "../crm/rateFormat";

const rows = [
  { developerAccountId: "bbf", developmentId: null, ratePercent: 10 },
  { developerAccountId: "bbf", developmentId: "eden-bay", ratePercent: 5 },
  { developerAccountId: "aristo", developmentId: "venus", ratePercent: 4 },
];

test("a project rate wins over the developer rate; without one the developer rate applies", () => {
  const m = effectiveRates([
    { id: "eden-bay", developerAccountId: "bbf" },
    { id: "gravity", developerAccountId: "bbf" },
  ], rows);
  assert.deepEqual(m.get("eden-bay"), { ratePercent: 5, source: "PROJECT" });
  assert.deepEqual(m.get("gravity"), { ratePercent: 10, source: "DEVELOPER" });
});

test("no developer rate and no project rate → MISSING; a project rate still works without a default", () => {
  const m = effectiveRates([
    { id: "venus", developerAccountId: "aristo" },
    { id: "atlas", developerAccountId: "aristo" },
  ], rows);
  assert.deepEqual(m.get("venus"), { ratePercent: 4, source: "PROJECT" });
  assert.deepEqual(m.get("atlas"), { ratePercent: null, source: "MISSING" });
});

test("another developer's default never leaks onto a project", () => {
  const m = effectiveRates([{ id: "x", developerAccountId: "domenica" }], rows);
  assert.deepEqual(m.get("x"), { ratePercent: null, source: "MISSING" });
});

test("Decimal rows convert and rates print without trailing zeros", () => {
  const conv = toRateRows([{ developerAccountId: "a", developmentId: null, ratePercent: { toNumber: () => 7.25 } }]);
  assert.equal(conv[0].ratePercent, 7.25);
  assert.equal(fmtRate(10), "10 %");
  assert.equal(fmtRate(5.5), "5.5 %");
  assert.equal(fmtRate(7.25), "7.25 %");
  assert.equal(fmtRate(null), "—");
});
