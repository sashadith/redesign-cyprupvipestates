import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveRate, computeDealAmounts, canTransitionCommission, commissionStatusForLeadStatus,
  estimatePartnerCommission, DEFAULT_HANDOVER_SHARE, DEFAULT_FIX_SHARE, type RateRow,
} from "@/lib/crm/commission";

const rows: RateRow[] = [
  { developerAccountId: "bbf", developmentId: null, ratePercent: 10 },
  { developerAccountId: "bbf", developmentId: "eden-coast", ratePercent: 5 },
];

test("a project rate beats the developer rate", () => {
  assert.deepEqual(resolveRate(rows, "bbf", "eden-coast"), { ratePercent: 5, source: "PROJECT" });
});

test("other projects of the developer inherit the developer rate", () => {
  assert.deepEqual(resolveRate(rows, "bbf", "marina"), { ratePercent: 10, source: "DEVELOPER" });
});

test("no rate at all is reported as missing, never as zero", () => {
  assert.deepEqual(resolveRate(rows, "aristo", "x"), { ratePercent: null, source: "MISSING" });
});

test("the spec's worked example: 400,000 at 5 % with a 30 % partner share", () => {
  assert.deepEqual(
    computeDealAmounts({ price: 400_000, ourRatePercent: 5, partnerSharePercent: 30 }),
    { ourCommission: 20_000, partnerCommission: 6_000 },
  );
  assert.deepEqual(
    computeDealAmounts({ price: 400_000, ourRatePercent: 5, partnerSharePercent: DEFAULT_FIX_SHARE }),
    { ourCommission: 20_000, partnerCommission: 10_000 },
  );
});

test("overrides win and the partner share applies to the overridden amount", () => {
  assert.deepEqual(
    computeDealAmounts({ price: 400_000, ourRatePercent: 5, partnerSharePercent: 30, ourCommissionOverride: 18_000 }),
    { ourCommission: 18_000, partnerCommission: 5_400 },
  );
  assert.deepEqual(
    computeDealAmounts({ price: 400_000, ourRatePercent: 5, partnerSharePercent: 30, partnerCommissionOverride: 7_000 }),
    { ourCommission: 20_000, partnerCommission: 7_000 },
  );
});

test("a missing rate yields no numbers, and no partner means no partner commission", () => {
  assert.deepEqual(computeDealAmounts({ price: 400_000, ourRatePercent: null, partnerSharePercent: 30 }), { ourCommission: null, partnerCommission: null });
  assert.deepEqual(computeDealAmounts({ price: 400_000, ourRatePercent: 5, partnerSharePercent: null }), { ourCommission: 20_000, partnerCommission: null });
});

test("amounts are whole euros", () => {
  assert.deepEqual(computeDealAmounts({ price: 333_333, ourRatePercent: 5, partnerSharePercent: 30 }), { ourCommission: 16_667, partnerCommission: 5_000 });
});

test("commission moves forward only, and can be cancelled until paid out", () => {
  assert.equal(canTransitionCommission("EXPECTED", "EARNED"), true);
  assert.equal(canTransitionCommission("EARNED", "DEVELOPER_PAID"), true);
  assert.equal(canTransitionCommission("DEVELOPER_PAID", "PAID_OUT"), true);
  assert.equal(canTransitionCommission("EARNED", "EXPECTED"), false);
  assert.equal(canTransitionCommission("EXPECTED", "PAID_OUT"), false);
  assert.equal(canTransitionCommission("DEVELOPER_PAID", "CANCELLED"), true);
  assert.equal(canTransitionCommission("PAID_OUT", "CANCELLED"), false);
  assert.equal(canTransitionCommission("CANCELLED", "EXPECTED"), false);
});

test("lead stages drive the first two commission stages", () => {
  assert.equal(commissionStatusForLeadStatus("RESERVED"), "EXPECTED");
  assert.equal(commissionStatusForLeadStatus("CLOSED"), "EARNED");
  assert.equal(commissionStatusForLeadStatus("OFFER"), null);
});

test("the estimate uses the budget and is absent without a budget or rate", () => {
  assert.equal(estimatePartnerCommission({ budget: 400_000, ourRatePercent: 5, partnerSharePercent: DEFAULT_HANDOVER_SHARE }), 6_000);
  assert.equal(estimatePartnerCommission({ budget: null, ourRatePercent: 5, partnerSharePercent: 30 }), null);
  assert.equal(estimatePartnerCommission({ budget: 400_000, ourRatePercent: null, partnerSharePercent: 30 }), null);
});

test("a two-decimal rate is computed in basis points (123,450 at 5.55% = 6,851.475 → 6,851)", () => {
  assert.deepEqual(computeDealAmounts({ price: 123_450, ourRatePercent: 5.55, partnerSharePercent: null }), { ourCommission: 6_851, partnerCommission: null });
});

test("basis-point maths avoids float error on an exact half (101,000 at 1.15% = 1,161.5 → 1,162)", () => {
  // Float maths gives 1161.4999999999998 and rounds down to 1,161.
  assert.equal(computeDealAmounts({ price: 101_000, ourRatePercent: 1.15, partnerSharePercent: null }).ourCommission, 1_162);
});
