import test from "node:test";
import assert from "node:assert/strict";
import { newUnitDetails, unitFields } from "../driveUnitFields";
import type { ExtractedUnit } from "../ai/pricelistExtract";

/* The nightly Drive sync is LIGHT: it reads ref, price and status only. A unit it
   creates is therefore bare until somebody runs a full import. Seen live on
   2026-10-30: Olias rewrote the Tenera Villas tab (V1–V4 → 1A/1B), and the
   published page's two villas lost beds, areas and plots overnight. The sync now
   re-reads the list in detail for projects that gained units, and fills ONLY
   those new rows from it. */

const u = (over: Partial<ExtractedUnit>): ExtractedUnit => ({ project: "Tenera Villas 1A & 1B", ref: "1A", status: "reserved", ...over } as ExtractedUnit);

test("new units get the detail fields of the matching fresh row", () => {
  const out = newUnitDetails(
    [{ id: "u1", ref: "1A" }, { id: "u2", ref: "Villa 1B" }],
    [u({ ref: "Villa 1A", bedrooms: "4", areaPlot: "566", areaVeranda: "32", areaGroundFloor: "79", areaUpperFloor: "92", pool: "8 x 3,5" }), u({ ref: "1B", bedrooms: "4", areaBuilt: "248 m²" })],
    "Tenera Villas 1A & 1B",
    ["Swimming pool"],
  );
  assert.equal(out.length, 2);
  const a = out.find((x) => x.id === "u1")!.data;
  assert.equal(a.beds, "4");
  assert.equal(a.areaPlot, "566");
  assert.equal(a.areaBuilt, "171 m²");
  assert.deepEqual(a.amenities, ["Swimming pool"]);
  assert.ok(a.attrs.some((x) => x.name === "Private pool"));
  assert.equal(out.find((x) => x.id === "u2")!.data.areaBuilt, "248 m²");
});

test("price and status are never part of the fill", () => {
  const [one] = newUnitDetails([{ id: "u1", ref: "1A" }], [u({ bedrooms: "4", price: 999 } as any)], "Tenera Villas 1A & 1B", []);
  assert.ok(!("price" in one.data) && !("status" in one.data) && !("ref" in one.data));
});

test("a new unit with no detailed row, or a row with no details, is left alone", () => {
  assert.deepEqual(newUnitDetails([{ id: "u1", ref: "7" }], [u({ ref: "1A", bedrooms: "4" })], "X", []), []);
  assert.deepEqual(newUnitDetails([{ id: "u1", ref: "1A" }], [u({ ref: "1A" })], "X", ["Pool"]), []);
});

test("unitFields keeps its mapping (moved, not changed)", () => {
  const f = unitFields(u({ areaGroundFloor: "50", areaUpperFloor: "54", parking: "14", bathrooms: "3" }));
  assert.equal(f.areaBuilt, "104 m²");
  assert.equal(f.baths, "3");
  assert.deepEqual(f.attrs.map((a) => a.name), ["Ground floor (internal)", "Upper floor (internal)", "Parking"]);
});
