import { test } from "node:test";
import assert from "node:assert/strict";
import { unitKey, snapshotOf } from "@/lib/crm/inventorySnapshot";

test("unitKey prefers ref, then feedRef, then id, and trims", () => {
  assert.equal(unitKey({ id: "u1", ref: " A-101 ", feedRef: "F1" }), "A-101");
  assert.equal(unitKey({ id: "u1", ref: "", feedRef: "F1" }), "F1");
  assert.equal(unitKey({ id: "u1", ref: null, feedRef: null }), "u1");
});

test("snapshotOf uses listed units and computed availability, defaults status to available, dedupes colliding keys by id", () => {
  const s = snapshotOf({
    publishStatus: "published", priceFrom: 100, priceTo: 200,
    units: [
      { id: "a", ref: "1", feedRef: null, label: "Nr. 1", status: "available", price: 100 },
      { id: "b", ref: "1", feedRef: null, label: "Nr. 1 dup", status: "sold", price: 110 },
      { id: "c", ref: "2", feedRef: null, label: null, status: null, price: null },
      { id: "d", ref: "3", feedRef: null, label: null, status: "unlisted", price: 5 },
    ],
  });
  assert.deepEqual(s, {
    publishStatus: "published", priceFrom: 100, priceTo: 200, unitsTotal: 3, unitsAvailable: 2,
    units: [
      { key: "1", label: "Nr. 1", status: "available", price: 100 },
      { key: "1#b", label: "Nr. 1 dup", status: "sold", price: 110 },
      { key: "2", label: null, status: "available", price: null },
    ],
  });
});
