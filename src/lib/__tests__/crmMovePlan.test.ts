import { test } from "node:test";
import assert from "node:assert/strict";
import { planMove, type DealLite } from "@/lib/crm/movePlan";

const expected: DealLite = { id: "d1", commissionStatus: "EXPECTED" };
const earned: DealLite = { id: "d2", commissionStatus: "EARNED" };
const paid: DealLite = { id: "d3", commissionStatus: "DEVELOPER_PAID" };
const cancelled: DealLite = { id: "d4", commissionStatus: "CANCELLED" };

test("forward moves inside the early funnel need nothing", () => {
  assert.deepEqual(planMove("NEW", "CONTACTED", []), { kind: "ok", needsDeal: false, needsLostReason: false, cancelDealIds: [], earnDealIds: [] });
});

test("reserving asks for a deal", () => {
  const p = planMove("OFFER", "RESERVED", []);
  assert.equal(p.kind, "ok");
  assert.equal(p.kind === "ok" && p.needsDeal, true);
});

test("reserving again with an open deal does not ask for a second one", () => {
  const p = planMove("RESERVED", "RESERVED", [expected]);
  assert.equal(p.kind === "ok" && p.needsDeal, false);
});

test("selling earns the expected deals, or asks for a deal when there is none", () => {
  const withDeal = planMove("RESERVED", "CLOSED", [expected, cancelled]);
  assert.deepEqual(withDeal, { kind: "ok", needsDeal: false, needsLostReason: false, cancelDealIds: [], earnDealIds: ["d1"] });
  const without = planMove("OFFER", "CLOSED", [cancelled]);
  assert.equal(without.kind === "ok" && without.needsDeal, true);
});

test("losing asks for a reason and cancels open deals", () => {
  const p = planMove("RESERVED", "LOST", [expected, cancelled]);
  assert.deepEqual(p, { kind: "ok", needsDeal: false, needsLostReason: true, cancelDealIds: ["d1"], earnDealIds: [] });
});

test("moving back before Reserved cancels expected and earned deals", () => {
  const p = planMove("CLOSED", "OFFER", [earned]);
  assert.deepEqual(p, { kind: "ok", needsDeal: false, needsLostReason: false, cancelDealIds: ["d2"], earnDealIds: [] });
});

test("keep contact with an open deal also cancels it", () => {
  const p = planMove("RESERVED", "KEEP_CONTACT", [expected]);
  assert.equal(p.kind === "ok" && p.cancelDealIds.length, 1);
});

test("a deal the developer already paid blocks any move away from Sold", () => {
  const p = planMove("CLOSED", "OFFER", [paid]);
  assert.equal(p.kind, "blocked");
  assert.match(p.kind === "blocked" ? p.reason : "", /already paid/);
});

test("Sold back to Reserved keeps an earned deal as it is", () => {
  const p = planMove("CLOSED", "RESERVED", [earned]);
  assert.deepEqual(p, { kind: "ok", needsDeal: false, needsLostReason: false, cancelDealIds: [], earnDealIds: [] });
});

test("a PAID_OUT deal blocks leaving too", () => {
  const p = planMove("CLOSED", "LOST", [{ id: "d5", commissionStatus: "PAID_OUT" }]);
  assert.equal(p.kind, "blocked");
});

test("Reserved with only settled deals does not ask for a new deal", () => {
  const p = planMove("CLOSED", "RESERVED", [paid]);
  assert.equal(p.kind === "ok" && p.needsDeal, false);
});
