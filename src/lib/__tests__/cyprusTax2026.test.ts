import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTax, scaleTax } from "../cyprusTax2026";

const r = (n: number) => Math.round(n);

// The four salaries of /guides/cyprus-tax-for-individuals-2026 (single employee, no other income, no deductions).
test("employee salary rows of the 2026 guide", () => {
  const rows: [number, number, number, number, number, number][] = [
    // gross, SI, GHS, taxable, tax, net
    [30_000, 2_640, 795, 26_565, 913, 25_652],
    [50_000, 4_400, 1_325, 44_275, 5_183, 39_093],
    [70_000, 6_064, 1_855, 62_081, 10_524, 51_557],
    [100_000, 6_064, 2_650, 91_286, 20_250, 71_036],
  ];
  for (const [gross, si, ghs, taxable, tax, net] of rows) {
    const x = computeTax({ employment: gross });
    assert.equal(r(x.socialInsurance), si, `SI ${gross}`);
    assert.equal(r(x.ghs), ghs, `GHS ${gross}`);
    assert.equal(r(x.chargeable), taxable, `taxable ${gross}`);
    assert.equal(r(x.incomeTax), tax, `tax ${gross}`);
    assert.equal(r(x.net), net, `net ${gross}`);
  }
});

test("the 2026 scale on chargeable income", () => {
  assert.equal(scaleTax(22_000).tax, 0);
  assert.equal(scaleTax(30_000).tax, 1_600);
  assert.equal(scaleTax(50_000).tax, 6_900);
  assert.equal(scaleTax(70_000).tax, 12_900);
  assert.equal(scaleTax(100_000).tax, 23_300);
});

test("social insurance example of the guide: employee on €36,000 and €72,000", () => {
  const a = computeTax({ employment: 36_000 });
  assert.equal(r(a.socialInsurance), 3_168);
  assert.equal(r(a.ghs), 954);
  const b = computeTax({ employment: 72_000 });
  assert.equal(r(b.socialInsurance), 6_064);
  assert.equal(r(b.ghs), 1_908);
});

test("self-employed on €60,000: social insurance 16.6%, GHS 4%, HRDA 0.5%", () => {
  const x = computeTax({ selfEmployed: 60_000 });
  assert.equal(r(x.socialInsurance), 9_960);
  assert.equal(r(x.ghs), 2_400);
  assert.equal(r(x.hrda), 300);
  assert.equal(r(x.incomeTax), 6_192);
});

test("rent only: the guide's €30,000 landlord pays about €1,036 (GHS €795 + tax €241)", () => {
  const x = computeTax({ rent: 30_000 });
  assert.equal(r(x.ghs), 795);
  assert.equal(r(x.incomeTax), 241);
  assert.equal(r(x.totalBurden), 1_036);
});

test("dividends: €200,000, domiciled pays SDC 5% plus GHS capped at €4,770; non-domiciled only GHS", () => {
  const dom = computeTax({ dividends: 200_000, domiciled: true });
  assert.equal(r(dom.sdc), 10_000);
  assert.equal(r(dom.ghs), 4_770);
  assert.equal(r(dom.totalBurden), 14_770);
  const non = computeTax({ dividends: 200_000, domiciled: false });
  assert.equal(r(non.totalBurden), 4_770);
});

test("foreign pension: the 5% election wins at €30,000 and the normal scale at €20,000", () => {
  const hi = computeTax({ foreignPension: 30_000 });
  assert.equal(hi.pension.elected, true);
  assert.equal(r(hi.pension.pensionTax), 1_250);
  assert.equal(r(hi.incomeTax), 1_250);
  const lo = computeTax({ foreignPension: 20_000 });
  assert.equal(lo.pension.elected, false);
  assert.equal(r(lo.incomeTax), 0);
});

test("S1 holder pays no GHS on the pension", () => {
  assert.equal(computeTax({ foreignPension: 30_000, pensionHasS1: true }).ghs, 0);
});

test("50% exemption on €80,000 of pay", () => {
  const x = computeTax({ employment: 80_000, exemption: "half" });
  assert.equal(x.exemptAmount, 40_000);
  // chargeable = 40,000 - SI 6,063.55 - GHS 2,120 = 31,816.45; tax = 20% x 9,816.45
  assert.equal(r(x.incomeTax), 1_963);
  assert.equal(computeTax({ employment: 50_000, exemption: "half" }).exemptAmount, 0); // below €55,000
});

test("20% exemption is capped at €8,550 and 25% at €25,000", () => {
  assert.equal(computeTax({ employment: 100_000, exemption: "fifth" }).exemptAmount, 8_550);
  assert.equal(computeTax({ employment: 200_000, exemption: "quarter" }).exemptAmount, 25_000);
  assert.equal(computeTax({ employment: 25_000, exemption: "quarter" }).exemptAmount, 0); // pay must exceed €30,000
});

test("children deduction: €1,000 + €1,250 + €1,500, doubled for a single parent, ceiling €100,000", () => {
  const base = computeTax({ employment: 60_000 }).incomeTax;
  const three = computeTax({ employment: 60_000, children: 3, status: "married", spouseIncome: 0 });
  assert.equal(r(base - three.incomeTax), r(3_750 * 0.3)); // all in the 30% band
  const sp = computeTax({ employment: 60_000, children: 1, status: "singleParent" });
  assert.equal(r(base - sp.incomeTax), r(2_000 * 0.3));
  const over = computeTax({ employment: 101_000, children: 1, status: "married" });
  assert.equal(over.familyDeductionsApplied, false);
});

test("single person above €40,000 loses the home interest deduction, a couple keeps it", () => {
  const single = computeTax({ employment: 45_000, homeInterestOrRent: 2_000 });
  assert.equal(single.deductions.family, 0);
  const couple = computeTax({ employment: 45_000, homeInterestOrRent: 2_000, status: "married" });
  assert.equal(couple.deductions.family, 2_000);
});

test("other deductions are limited to one fifth of chargeable income", () => {
  const x = computeTax({ employment: 50_000, otherDeductions: 20_000 });
  assert.ok(x.deductions.other < 20_000);
  assert.ok(x.deductions.otherDisallowed > 0);
});

test("empty input is all zeros", () => {
  const x = computeTax({});
  assert.equal(x.totalBurden, 0);
  assert.equal(x.net, 0);
});
