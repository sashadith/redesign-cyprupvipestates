import test from "node:test";
import assert from "node:assert/strict";
import { normalizeUnitPins, isUnitFieldPinned, stripPinnedUnitFields, PINNABLE_UNIT_FIELDS } from "../unitPins";

/* A pin says "this column, on this unit, is ours". The sync honours it by
   omitting the column from its update — see feedSync's
   syncFeedUnitsPreservingUnlisted and statusOnlySync. */

test("only status and price can be pinned", () => {
  assert.deepEqual([...PINNABLE_UNIT_FIELDS], ["status", "price"]);
  assert.deepEqual(normalizeUnitPins(["status", "price"]), ["status", "price"]);
  // Anything else is dropped, not trusted: a stored array is read on every
  // sync, and a stray "photos" would freeze a unit's images forever.
  assert.deepEqual(normalizeUnitPins(["photos", "label", "areaBuilt", "", "  "]), []);
  assert.deepEqual(normalizeUnitPins([" status ", "status", 7, null, { status: true }]), ["status"]);
  for (const bad of [null, undefined, "status", 1, {}]) assert.deepEqual(normalizeUnitPins(bad), []);
});

test("an unpinned unit's update is passed through untouched", () => {
  const row = { status: "available", price: 300000, label: "B006" };
  for (const pins of [null, undefined, [], ["photos"]]) {
    assert.deepEqual(stripPinnedUnitFields(row, pins), row);
  }
});

test("a pinned column is omitted from the update, the rest still writes", () => {
  const row = { status: "available", price: 300000, label: "B006", areaBuilt: "82 m²" };
  assert.deepEqual(stripPinnedUnitFields(row, ["status"]), { price: 300000, label: "B006", areaBuilt: "82 m²" });
  assert.deepEqual(stripPinnedUnitFields(row, ["price"]), { status: "available", label: "B006", areaBuilt: "82 m²" });
  assert.deepEqual(stripPinnedUnitFields(row, ["status", "price"]), { label: "B006", areaBuilt: "82 m²" });
  // The key is deleted, not set to undefined — Prisma treats a present key
  // with undefined as "no change" today, but an explicit absence is what the
  // guarantee rests on, and it is what freezeForPublished does too.
  assert.ok(!("status" in stripPinnedUnitFields(row, ["status"])));
  // The caller's object is never mutated: the sync reuses `row` for the
  // created-unit path in the same loop.
  assert.equal(row.status, "available");
});

test("a pin that is not in the whitelist cannot strip a column", () => {
  const row = { status: "available", price: 300000, photos: ["a.webp"] };
  assert.deepEqual(stripPinnedUnitFields(row, ["photos"]), row);
});

test("isUnitFieldPinned reads the stored array the same way", () => {
  assert.equal(isUnitFieldPinned(["status"], "status"), true);
  assert.equal(isUnitFieldPinned(["status"], "price"), false);
  assert.equal(isUnitFieldPinned([], "status"), false);
  assert.equal(isUnitFieldPinned(null, "status"), false);
  assert.equal(isUnitFieldPinned(["photos"], "status"), false);
});
