import { test } from "node:test";
import assert from "node:assert/strict";
import { initialFilters, filtersFromFavorites } from "../crm/presentations/seedFilters";

const lead = { budgetMin: 100000, budgetMax: 400000, propertyTypeInterest: ["Villa"], lastMatchFilters: null as unknown };

test("initialFilters defaults come from the lead profile", () => {
  assert.deepEqual(initialFilters(lead), {
    budgetMin: 100000, budgetMax: 400000, bedrooms: [], districts: [], areas: [], propertyTypes: ["Villa"], includeReady: false, onlyAvailable: true,
  });
});

test("lastMatchFilters wins over the profile; non-objects are ignored", () => {
  const f = initialFilters({ ...lead, lastMatchFilters: { budgetMax: 250000, districts: ["Paphos"] } });
  assert.equal(f.budgetMax, 250000); assert.equal(f.budgetMin, 100000); assert.deepEqual(f.districts, ["Paphos"]);
  for (const bad of ["x", 5, null, undefined, ["a"]]) {
    assert.equal(initialFilters({ ...lead, lastMatchFilters: bad }).budgetMax, 400000);
  }
});

test("filtersFromFavorites widens the price band", () => {
  const f = filtersFromFavorites([
    { district: "Paphos", area: "Kato Paphos", prices: [200000, 300000], beds: [2, 3], types: ["Apartment"] },
  ]);
  assert.equal(f.budgetMin, 170000); assert.equal(f.budgetMax, 345000);
  assert.deepEqual(f.bedrooms, [2, 3]); assert.equal(f.onlyAvailable, true); assert.equal(f.includeReady, false);
});

test("no prices gives null budget; beds 5+ collapse; duplicates removed", () => {
  const f = filtersFromFavorites([
    { district: "Limassol", area: null, prices: [], beds: [6, 5, null], types: ["Villa"] },
    { district: "Limassol", area: "", prices: [], beds: [2], types: ["Villa"] },
    { district: null, area: "Germasogeia", prices: [], beds: [], types: [] },
  ]);
  assert.equal(f.budgetMin, null); assert.equal(f.budgetMax, null);
  assert.deepEqual(f.bedrooms, [5, 2]);
  assert.deepEqual(f.districts, ["Limassol"]); assert.deepEqual(f.areas, ["Germasogeia"]);
  assert.deepEqual(f.propertyTypes, ["Villa"]);
});
