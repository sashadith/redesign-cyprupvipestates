import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDealInput, parseRateText, chooseDealRate, dealProjectLabel, dealDeveloperLabel } from "@/lib/crm/dealInput";

const ok = (raw: unknown) => {
  const r = normalizeDealInput(raw);
  assert.ok("ok" in r, JSON.stringify(r));
  return r.ok;
};
const err = (raw: unknown) => {
  const r = normalizeDealInput(raw);
  assert.ok("error" in r);
  return r.error;
};

test("a project from our list is enough: the developer comes from the project", () => {
  assert.deepEqual(ok({ developmentId: "dev-1", unitLabel: " A203 ", price: 412000 }), {
    developmentId: "dev-1", projectName: null, developerAccountId: null, developerName: null, unitLabel: "A203", price: 412000, ratePercent: null,
  });
});

test("the old partner-portal shape still passes", () => {
  assert.equal(ok({ developmentId: "dev-1", unitLabel: null, price: 1 }).developmentId, "dev-1");
});

test("typed developer and typed project", () => {
  const d = ok({ developerName: "  Smith   Developers ", projectName: "Sea View  Villas", unitLabel: "", price: 950000, ratePercent: 5 });
  assert.equal(d.developerName, "Smith Developers");
  assert.equal(d.projectName, "Sea View Villas");
  assert.equal(d.unitLabel, null);
  assert.equal(d.ratePercent, 5);
});

test("our developer with a typed project", () => {
  const d = ok({ developerAccountId: "acc-1", developerName: "ignored", projectName: "Phase 2", price: 300000 });
  assert.equal(d.developerAccountId, "acc-1");
  assert.equal(d.developerName, null, "an id wins over a typed name");
});

test("a chosen project drops a typed project name", () => {
  assert.equal(ok({ developmentId: "dev-1", projectName: "x", price: 1 }).projectName, null);
});

test("missing project, developer or price is refused", () => {
  assert.match(err({ developerName: "X", price: 1 }), /project/);
  assert.match(err({ projectName: "X", price: 1 }), /developer/);
  assert.match(err({ developmentId: "d", price: 0 }), /price/);
  assert.match(err({ developmentId: "d", price: 1.5 }), /price/);
  assert.match(err({ developmentId: "d", price: 100_000_001 }), /price/);
  assert.match(err(null), /deal/);
});

test("over-long or non-string fields are refused", () => {
  assert.match(err({ developerName: "x".repeat(121), projectName: "p", price: 1 }), /deal/);
  assert.match(err({ developmentId: "d", unitLabel: "u".repeat(41), price: 1 }), /deal/);
  assert.match(err({ developmentId: 5, price: 1 }), /deal/);
});

test("rate: above 0, up to 20, two decimals", () => {
  assert.equal(ok({ developmentId: "d", price: 1, ratePercent: 4.75 }).ratePercent, 4.75);
  assert.equal(ok({ developmentId: "d", price: 1, ratePercent: null }).ratePercent, null);
  assert.match(err({ developmentId: "d", price: 1, ratePercent: 0 }), /Rate/);
  assert.match(err({ developmentId: "d", price: 1, ratePercent: 21 }), /Rate/);
  assert.match(err({ developmentId: "d", price: 1, ratePercent: 4.755 }), /Rate/);
});

test("parseRateText", () => {
  assert.equal(parseRateText(""), null);
  assert.equal(parseRateText("5"), 5);
  assert.equal(parseRateText("4,5 %"), 4.5);
  assert.ok(Number.isNaN(parseRateText("abc") as number));
  assert.ok(Number.isNaN(parseRateText("4.555") as number));
});

test("a typed rate wins over the rate on file", () => {
  assert.deepEqual(chooseDealRate(6, { ratePercent: 5, source: "PROJECT" }), { ratePercent: 6, source: "MANUAL" });
  assert.deepEqual(chooseDealRate(null, { ratePercent: 5, source: "DEVELOPER" }), { ratePercent: 5, source: "DEVELOPER" });
  assert.deepEqual(chooseDealRate(null, null), { ratePercent: null, source: "MISSING" });
});

test("labels: our names first, typed names otherwise", () => {
  assert.equal(dealProjectLabel({ development: { publicName: "Aura", override: { alias: " Aura Seafront " } }, projectName: "x" }), "Aura Seafront");
  assert.equal(dealProjectLabel({ development: null, projectName: "Sea View" }), "Sea View");
  assert.equal(dealProjectLabel({ development: null, projectName: null }), null);
  assert.equal(dealDeveloperLabel({ developerAccount: null, development: { developerAccount: { name: "Olias" } }, developerName: "x" }), "Olias");
  assert.equal(dealDeveloperLabel({ developerAccount: null, development: null, developerName: "Smith" }), "Smith");
});

import { shouldMoveToReserved } from "@/lib/crm/addDealRules";

test("New deal moves the lead to Reserved only before Reserved and only when ticked", () => {
  for (const s of ["NEW", "CONTACTED", "COMMUNICATING", "VIEWING_SCHEDULED", "OFFER", "KEEP_CONTACT", "LOST"]) assert.equal(shouldMoveToReserved(s, true), true, s);
  assert.equal(shouldMoveToReserved("RESERVED", true), false);
  assert.equal(shouldMoveToReserved("CLOSED", true), false);
  assert.equal(shouldMoveToReserved("OFFER", false), false);
});

test("one- and two-decimal rates that floats cannot hold exactly still pass", () => {
  for (const r of [4.1, 2.3, 1.1, 4.35, 0.57, 12.99]) assert.equal(ok({ developmentId: "d", price: 1, ratePercent: r }).ratePercent, r, String(r));
});

import { dealNeedsMove } from "@/lib/crm/addDealRules";

test("only a lost lead needs the move to Reserved with a new deal", () => {
  assert.equal(dealNeedsMove("LOST"), true);
  for (const s of ["NEW", "OFFER", "KEEP_CONTACT", "RESERVED", "CLOSED"]) assert.equal(dealNeedsMove(s), false, s);
});
