import { test } from "node:test";
import assert from "node:assert/strict";
import { firstMonday, currentRound, nextRound, doneForRound, roundStatus, nicosiaDate } from "@/lib/monthlyManualSync";

/* One manual-sync round a month, on the first Monday (2026-10-16). */

test("first Monday of a month", () => {
  assert.equal(firstMonday(2026, 10), "2026-10-05");
  assert.equal(firstMonday(2026, 11), "2026-11-02");
  assert.equal(firstMonday(2026, 6), "2026-06-01"); // the 1st itself is a Monday
  assert.equal(firstMonday(2027, 2), "2027-02-01");
  assert.equal(firstMonday(2027, 8), "2027-08-02"); // the 1st is a Sunday
});

test("the round in force: this month's once reached, else last month's (also across New Year)", () => {
  assert.equal(currentRound(new Date("2026-10-16T08:00:00Z")), "2026-10-05");
  assert.equal(currentRound(new Date("2026-11-01T12:00:00Z")), "2026-10-05"); // Sunday before the round
  assert.equal(currentRound(new Date("2026-11-02T06:00:00Z")), "2026-11-02");
  assert.equal(currentRound(new Date("2027-01-02T10:00:00Z")), "2026-12-07"); // 2027-01-04 not reached yet
  assert.equal(nextRound("2026-12-07"), "2027-01-04");
});

test("Cyprus calendar date decides — 23:30 UTC on Sunday is already Monday in Nicosia", () => {
  const sundayLateUtc = new Date("2026-11-01T23:30:00Z"); // 01:30 Monday in Nicosia (EET, UTC+2)
  assert.equal(nicosiaDate(sundayLateUtc), "2026-11-02");
  assert.equal(currentRound(sundayLateUtc), "2026-11-02");
});

test("done for a round only if marked on or after the round day", () => {
  assert.equal(doneForRound(null, "2026-11-02"), false);
  assert.equal(doneForRound(new Date("2026-10-16T10:00:00Z"), "2026-11-02"), false, "October's sync does not count for November");
  assert.equal(doneForRound(new Date("2026-11-02T07:00:00Z"), "2026-11-02"), true);
  assert.equal(doneForRound(new Date("2026-11-20T07:00:00Z"), "2026-11-02"), true, "a late sync still closes the round");
});

test("round status lists the open accounts, sorted, and moves done ones out", () => {
  const acc = [
    { id: "1", name: "SOL Properties", manualSyncedAt: new Date("2026-10-16T10:00:00Z") },
    { id: "2", name: "AGG (CC)", manualSyncedAt: new Date("2026-11-02T09:00:00Z") },
    { id: "3", name: "Platon Properties", manualSyncedAt: null },
  ];
  const s = roundStatus(acc, new Date("2026-11-03T09:00:00Z"));
  assert.equal(s.round, "2026-11-02");
  assert.deepEqual(s.open.map((a) => a.name), ["Platon Properties", "SOL Properties"]);
  assert.deepEqual(s.done.map((a) => a.name), ["AGG (CC)"]);
  assert.equal(roundStatus(acc, new Date("2026-10-20T09:00:00Z")).open.length, 1, "in October only the never-synced one is open");
});

import { monthlyManualSyncItem } from "@/lib/actionCenter/rules/developers";

test("Action Center: one item for the round, listing the open accounts", () => {
  const acc = [
    { id: "a", name: "SOL Properties", manualSyncedAt: new Date("2026-10-16T10:00:00Z") },
    { id: "b", name: "AGG (CC)", manualSyncedAt: new Date("2026-11-02T09:00:00Z") },
    { id: "c", name: "Platon Properties", manualSyncedAt: new Date("2026-10-16T10:00:00Z") },
  ];
  const item = monthlyManualSyncItem(acc, new Date("2026-11-02T08:00:00Z"))!;
  assert.equal(item.id, "monthly-manual-sync:2026-11-02");
  assert.equal(item.title, "Monthly manual sync: 2 of 3 developers open");
  assert.match(item.description, /Still open: Platon Properties, SOL Properties\./);
  assert.equal(item.deepLink, "/admin/developments");
  assert.equal(item.since.toISOString().slice(0, 10), "2026-11-02");
});

test("Action Center: one open account links straight to it; none open → no item; nothing in October after the migration", () => {
  const one = monthlyManualSyncItem([{ id: "x", name: "Reiwa", manualSyncedAt: null }], new Date("2026-11-03T08:00:00Z"))!;
  assert.equal(one.deepLink, "/admin/developments/developers/x");
  assert.equal(monthlyManualSyncItem([{ id: "x", name: "Reiwa", manualSyncedAt: new Date("2026-11-03T08:00:00Z") }], new Date("2026-11-04T08:00:00Z")), null);
  assert.equal(monthlyManualSyncItem([], new Date()), null);
  // the migration stamps every account on 2026-10-16: no item until Monday 2 November
  const migrated = [{ id: "y", name: "SOL", manualSyncedAt: new Date("2026-10-16T12:00:00Z") }];
  assert.equal(monthlyManualSyncItem(migrated, new Date("2026-11-01T20:00:00Z")), null);
  assert.ok(monthlyManualSyncItem(migrated, new Date("2026-11-02T05:00:00Z")));
});
