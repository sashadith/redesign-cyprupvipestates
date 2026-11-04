import { test } from "node:test";
import assert from "node:assert/strict";
import { isIdArg, isPayoutAction, parseStageDate, payoutActions, stageOrderError } from "@/lib/crm/commissionActions";
import { canTransitionCommission, COMMISSION_STATUSES } from "@/lib/crm/commission";
test("payout buttons per stage", () => {
  assert.deepEqual(payoutActions("EXPECTED"), ["CANCELLED"]);
  assert.deepEqual(payoutActions("EARNED"), ["DEVELOPER_PAID", "CANCELLED"]);
  assert.deepEqual(payoutActions("DEVELOPER_PAID"), ["PAID_OUT", "CANCELLED"]);
  assert.deepEqual(payoutActions("PAID_OUT"), []);
  assert.deepEqual(payoutActions("CANCELLED"), []);
});
test("every offered action is an allowed transition", () => {
  for (const s of COMMISSION_STATUSES) for (const a of payoutActions(s)) assert.ok(canTransitionCommission(s, a), `${s}→${a}`);
});
test("only the three payout actions pass the guard", () => {
  for (const ok of ["DEVELOPER_PAID", "PAID_OUT", "CANCELLED"]) assert.ok(isPayoutAction(ok), ok);
  for (const bad of ["EARNED", "EXPECTED", "", null, 3]) assert.equal(isPayoutAction(bad), false, String(bad));
});
test("stage dates: today and past at 12:00 UTC, future and malformed rejected", () => {
  const now = new Date("2026-10-18T23:30:00Z");
  const today = parseStageDate("2026-10-18", now);
  assert.ok(today.ok && today.value.toISOString() === "2026-10-18T12:00:00.000Z");
  assert.ok(parseStageDate("2026-01-02", now).ok);
  for (const bad of ["2026-10-19", "2026-02-30", "18.10.2026", "", "2026-1-2"]) assert.equal(parseStageDate(bad, now).ok, false, bad);
});
test("a payout stage cannot predate the stage before it", () => {
  const deal = { earnedAt: new Date("2026-09-10T15:00:00Z"), developerPaidAt: new Date("2026-10-01T12:00:00Z") };
  assert.equal(stageOrderError("DEVELOPER_PAID", "2026-09-10", deal), null);
  assert.match(stageOrderError("DEVELOPER_PAID", "2026-09-09", deal) ?? "", /before the deal was earned \(2026-09-10\)/);
  assert.match(stageOrderError("PAID_OUT", "2026-09-30", deal) ?? "", /before the developer paid/);
  assert.equal(stageOrderError("PAID_OUT", "2026-10-01", deal), null);
  assert.equal(stageOrderError("CANCELLED", "2000-01-01", deal), null);
  assert.equal(stageOrderError("DEVELOPER_PAID", "2000-01-01", { earnedAt: null, developerPaidAt: null }), null);
});

test("id arguments from the client: non-empty strings of at most 64 characters", () => {
  for (const ok of ["c", "cmabc123", "x".repeat(64)]) assert.ok(isIdArg(ok), ok);
  for (const bad of ["", "x".repeat(65), null, undefined, 3, {}, ["a"]]) assert.equal(isIdArg(bad), false, JSON.stringify(bad));
});

test("the commission actions guard their id arguments and map vanished rows (P2025)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("src/app/crm/commissions/actions.ts", "utf8");
  assert.match(src, /!isIdArg\(developerAccountId\)/);
  assert.match(src, /developmentId !== null && !isIdArg\(developmentId\)/);
  assert.match(src, /!isIdArg\(rateId\)/);
  assert.match(src, /!isIdArg\(dealId\)/);
  assert.equal(src.match(/e\.code === "P2025"/g)?.length, 2, "save and delete both map P2025");
});
