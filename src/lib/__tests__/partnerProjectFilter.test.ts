import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_FILTERS, activeFilterCount, deliveryBucket, filterProjects, isNew, placeOptions, sortProjects,
  type CatalogFilters, type CatalogProject,
} from "@/lib/partner/projectFilter";

const NOW = new Date("2026-11-11T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const proj = (over: Partial<CatalogProject> & { id: string }): CatalogProject => ({
  name: over.id, town: null, district: null, area: null, url: null, priceFrom: null, completion: null, completionKey: null, ready: false,
  addedAt: null, unitsFree: 0, unitsTotal: 0, bedsMin: null, bedsMax: null, types: [], units: [], handoverRate: null, fixRate: null, ourRate: null,
  ...over,
});
const f = (over: Partial<CatalogFilters>): CatalogFilters => ({ ...EMPTY_FILTERS, ...over });
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

const aura = proj({
  id: "aura", name: "Aura Seafront", district: "Paphos", area: "Peyia", priceFrom: 250_000, addedAt: daysAgo(3), handoverRate: 3,
  unitsFree: 3, unitsTotal: 10, completionKey: Date.UTC(2027, 3, 1),
  units: [{ t: "apartment", b: 1, p: 250_000 }, { t: "apartment", b: 2, p: 320_000 }, { t: "penthouse", b: 3, p: 610_000 }],
});
const agnades = proj({
  id: "agnades", name: "Agnades Village", town: "Polis", district: "Paphos", area: "Polis Chrysochous", priceFrom: 540_000, addedAt: daysAgo(40),
  handoverRate: 1.5, unitsFree: 2, unitsTotal: 6, ready: true, units: [{ t: "villa", b: 4, p: 540_000 }, { t: "villa", b: 6, p: 900_000 }],
});
const marina = proj({ id: "marina", name: "Marina Tower", district: "Limassol", area: "Seafront", priceFrom: 900_000, addedAt: daysAgo(100), handoverRate: 3, unitsFree: 0, unitsTotal: 12 });
const nounits = proj({ id: "nounits", name: "Ēlia Gardens", district: "Larnaca", priceFrom: 200_000, completionKey: Date.UTC(2029, 0, 1) });
const all = [aura, agnades, marina, nounits];

test("no filters: every project, shown price = project price", () => {
  const out = filterProjects(all, EMPTY_FILTERS, NOW);
  assert.deepEqual(ids(out), ["aura", "agnades", "marina", "nounits"]);
  assert.equal(out[0].shownFrom, 250_000);
});

test("search covers name, town, district and area, accents ignored", () => {
  assert.deepEqual(ids(filterProjects(all, f({ q: "elia" }), NOW)), ["nounits"]);
  assert.deepEqual(ids(filterProjects(all, f({ q: "paphos peyia" }), NOW)), ["aura"]);
  assert.deepEqual(ids(filterProjects(all, f({ q: "polis" }), NOW)), ["agnades"]);
});

test("budget, bedrooms and type must hold for the same unit; shown price is the cheapest hit", () => {
  const out = filterProjects(all, f({ budgetMin: 300_000, budgetMax: 700_000 }), NOW);
  // nounits has no unit list: from €200,000 may still reach €300,000, so it stays
  assert.deepEqual(ids(out), ["aura", "agnades", "nounits"]);
  assert.equal(out[0].shownFrom, 320_000);
  // a 3-bed exists (penthouse 610k) and an apartment exists, but no 3-bed apartment
  assert.deepEqual(ids(filterProjects(all, f({ beds: [3], types: ["apartment"] }), NOW)), []);
  assert.deepEqual(ids(filterProjects(all, f({ beds: [3], types: ["penthouse"] }), NOW)), ["aura"]);
});

test("5 bedrooms means five or more", () => {
  assert.deepEqual(ids(filterProjects(all, f({ beds: [5] }), NOW)), ["agnades"]);
});

test("project without a unit list: budget checks the project price, bedrooms and type cannot match", () => {
  assert.deepEqual(ids(filterProjects([nounits], f({ budgetMax: 250_000 }), NOW)), ["nounits"]);
  assert.deepEqual(ids(filterProjects([nounits], f({ budgetMax: 150_000 }), NOW)), []);
  assert.deepEqual(ids(filterProjects([nounits], f({ beds: [2] }), NOW)), []);
});

test("district, and an area narrows only its own district", () => {
  assert.deepEqual(ids(filterProjects(all, f({ districts: ["paphos"] }), NOW)), ["aura", "agnades"]);
  assert.deepEqual(ids(filterProjects(all, f({ districts: ["Paphos", "Limassol"], areas: ["Peyia"] }), NOW)), ["aura", "marina"]);
});

test("delivery buckets: ready, this year, next year, later; unknown never matches", () => {
  assert.equal(deliveryBucket(agnades, NOW), "ready");
  assert.equal(deliveryBucket(aura, NOW), "nextYear");
  assert.equal(deliveryBucket(nounits, NOW), "later");
  assert.equal(deliveryBucket(proj({ id: "x", completionKey: Date.UTC(2026, 9, 1) }), NOW), "thisYear");
  assert.equal(deliveryBucket(marina, NOW), null);
  assert.deepEqual(ids(filterProjects(all, f({ delivery: ["ready", "nextYear"] }), NOW)), ["aura", "agnades"]);
});

test("added within N days, and the New mark after 30 days", () => {
  assert.deepEqual(ids(filterProjects(all, f({ addedWithin: 7 }), NOW)), ["aura"]);
  assert.deepEqual(ids(filterProjects(all, f({ addedWithin: 90 }), NOW)), ["aura", "agnades"]);
  assert.equal(isNew(aura, NOW), true);
  assert.equal(isNew(agnades, NOW), false);
  assert.equal(isNew(nounits, NOW), false);
});

test("minimum rate and only-free; a project without unit data counts as free", () => {
  assert.deepEqual(ids(filterProjects(all, f({ minRate: 2 }), NOW)), ["aura", "marina"]);
  assert.deepEqual(ids(filterProjects(all, f({ onlyFree: true }), NOW)), ["aura", "agnades", "nounits"]);
});

test("sorting: missing values last in both directions, ties by name", () => {
  const shown = filterProjects(all, EMPTY_FILTERS, NOW);
  assert.deepEqual(ids(sortProjects(shown, "price", "asc")), ["nounits", "aura", "agnades", "marina"]);
  assert.deepEqual(ids(sortProjects(shown, "price", "desc")), ["marina", "agnades", "aura", "nounits"]);
  assert.deepEqual(ids(sortProjects(shown, "added", "desc")), ["aura", "agnades", "marina", "nounits"]);
  assert.deepEqual(ids(sortProjects(shown, "delivery", "asc")), ["agnades", "aura", "nounits", "marina"]);
  assert.deepEqual(ids(sortProjects(shown, "free", "desc")), ["aura", "agnades", "marina", "nounits"]);
  assert.deepEqual(ids(sortProjects(shown, "name", "asc")), ["agnades", "aura", "nounits", "marina"]);
});

test("price sort follows the filtered price", () => {
  const shown = filterProjects(all, f({ budgetMin: 300_000 }), NOW);
  assert.deepEqual(ids(sortProjects(shown, "price", "asc")), ["nounits", "aura", "agnades", "marina"]);
  assert.equal(shown.find((p) => p.id === "aura")!.shownFrom, 320_000);
});

test("place options: district falls back to town, areas per district, one label per spelling", () => {
  const o = placeOptions([...all, proj({ id: "y", district: "paphos", area: "peyia" }), proj({ id: "z", town: "Nicosia" })]);
  assert.deepEqual(o.districts, ["Larnaca", "Limassol", "Nicosia", "Paphos"]);
  assert.deepEqual(o.areasByDistrict.Paphos, ["Peyia", "Polis Chrysochous"]);
  assert.deepEqual(o.areasByDistrict.Larnaca, []);
});

test("active filter count", () => {
  assert.equal(activeFilterCount(EMPTY_FILTERS), 0);
  assert.equal(activeFilterCount(f({ q: " x ", budgetMax: 1, onlyFree: true, beds: [2] })), 4);
});

import { toCatalogProject, type CatalogRow } from "@/lib/partner/projectCatalog";

test("catalog row: override wins, only available units, beds/types from units, relative delivery resolved", () => {
  const row: CatalogRow = {
    id: "d1", town: "Paphos", district: "Paphos", area: "Kato Paphos", completion: "Q2 2025", priceFrom: null,
    publishedAt: new Date("2026-11-03T09:00:00Z"),
    override: { town: null, district: null, area: "Peyia", completion: "24 months from signing" },
    units: [
      { type: "Apartment", beds: "2", price: 320_000, status: "available" },
      { type: "Penthouse", beds: "3 bed", price: 610_000, status: null },
      { type: "Villa", beds: "5", price: 1_000_000, status: "sold" },
      { type: "Studio", beds: "Studio", price: null, status: "available" },
    ],
  };
  const rated = { id: "d1", name: "Aura", town: "Paphos", slug: "aura", handoverRate: 3, fixRate: 5, ourRate: null };
  const c = toCatalogProject(row, rated, NOW);
  assert.equal(c.area, "Peyia");
  assert.equal(c.district, "Paphos");
  assert.equal(c.priceFrom, 320_000);
  assert.equal(c.unitsFree, 3);
  assert.equal(c.unitsTotal, 4);
  assert.equal(c.bedsMin, 0);
  assert.equal(c.bedsMax, 3);
  assert.deepEqual(c.types, ["apartment", "penthouse"]);
  assert.equal(c.completion, "Q4 2028");
  assert.equal(c.ready, false);
  assert.equal(c.addedAt, "2026-11-03T09:00:00.000Z");
  assert.equal(c.handoverRate, 3);
  assert.ok(!("developer" in c));
});

test("catalog row: a past delivery reads as ready", () => {
  const row: CatalogRow = { id: "d2", town: null, district: "Limassol", area: null, completion: "Q2 2025", priceFrom: 400_000, publishedAt: null, override: null, units: [] };
  const c = toCatalogProject(row, { id: "d2", name: "X", town: null, slug: null, handoverRate: null, fixRate: null, ourRate: null }, NOW);
  assert.equal(c.ready, true);
  assert.equal(c.priceFrom, 400_000);
  assert.equal(c.addedAt, null);
});
