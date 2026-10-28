import { test } from "node:test";
import assert from "node:assert/strict";
import { favoriteSeeds, favoritesSeedFromRows, type FavoriteDevRow } from "../crm/presentations/favoritesSeed";

const row = (over: Partial<FavoriteDevRow> = {}): FavoriteDevRow => ({
  id: "d1", publicName: "Sea Gardens", district: "Paphos", town: "Paphos", area: "Kato Paphos", override: null,
  units: [], ...over,
});

test("prices come only from available units with a positive price; beds via parseBeds", () => {
  const [s] = favoriteSeeds([row({
    units: [
      { status: "available", price: 250000, beds: "2 bed", type: "Apartment" },
      { status: "available", price: 0, beds: "Studio", type: "Studio" },
      { status: "available", price: null, beds: "3", type: "Apartment" },
      { status: "sold", price: 180000, beds: "1", type: "Apartment" },
      { status: "reserved", price: 190000, beds: "4", type: "Apartment" },
      { status: null, price: 200000, beds: "5", type: "Apartment" },
    ],
  })]);
  assert.deepEqual(s.prices, [250000]);
  assert.deepEqual(s.beds, [2, 0, 3]);
  assert.equal(s.district, "Paphos");
  assert.equal(s.area, "Kato Paphos");
});

test("location follows the override, then district, then town (as the district list does)", () => {
  const seeds = favoriteSeeds([
    row({ override: { district: "Limassol", town: null, area: "Germasogeia" } }),
    row({ district: null, town: "Larnaca", area: null }),
    row({ district: null, town: null, area: "", override: { district: null, town: "Nicosia", area: null } }),
  ]);
  assert.deepEqual(seeds.map((s) => [s.district, s.area]), [["Limassol", "Germasogeia"], ["Larnaca", null], ["Nicosia", null]]);
});

test("type is the most common filter type among available units", () => {
  const [s] = favoriteSeeds([row({
    units: [
      { status: "available", price: 1, beds: null, type: "Penthouse" },
      { status: "available", price: 1, beds: null, type: "Flat" },
      { status: "available", price: 1, beds: null, type: "Apartment" },
      { status: "sold", price: 1, beds: null, type: "Villa" },
      { status: "sold", price: 1, beds: null, type: "Villa" },
    ],
  })]);
  assert.equal(s.type, "Apartment");
  assert.equal(favoriteSeeds([row({ units: [{ status: "available", price: 1, beds: null, type: "Plot" }] })])[0].type, null);
  assert.equal(favoriteSeeds([row()])[0].type, null);
});

test("favoritesSeedFromRows: filters, preselect ids and names", () => {
  const out = favoritesSeedFromRows([
    row({ units: [{ status: "available", price: 200000, beds: "2", type: "Apartment" }] }),
    row({ id: "d2", publicName: "Hill Villas", district: "Limassol", area: null, units: [{ status: "available", price: 400000, beds: "4", type: "Villa" }] }),
  ]);
  assert.deepEqual(out.preselect, ["d1", "d2"]);
  assert.deepEqual(out.preselectNames, { d1: "Sea Gardens", d2: "Hill Villas" });
  assert.equal(out.filters.budgetMin, 170000);
  assert.equal(out.filters.budgetMax, 460000);
  assert.deepEqual(out.filters.bedrooms, [2, 4]);
  assert.deepEqual(out.filters.districts, ["Paphos", "Limassol"]);
  assert.deepEqual(out.filters.areas, ["Kato Paphos"]);
  assert.deepEqual(out.filters.propertyTypes, ["Apartment", "Villa"]);
});
