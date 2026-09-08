import { test } from "node:test";
import assert from "node:assert/strict";
import { filterAndRank, parseCompletionBefore, type SearchDevelopment } from "@/lib/crm/inventorySearch";

const now = new Date("2026-09-08T10:00:00Z");
const unit = (o: Partial<SearchDevelopment["units"][number]> = {}) => ({ type: "Apartment", status: "available", price: null, beds: null, amenities: null, ...o });
const dev = (o: Partial<SearchDevelopment> & { id: string; publicName: string }): SearchDevelopment => ({
  developerName: o.publicName, developer: "Dev Co", category: null, stage: null, status: null, completion: null, district: "Paphos", town: "Paphos", area: null,
  priceFrom: null, priceTo: null, currency: "EUR", amenities: null, slug: o.publicName.toLowerCase().replace(/\s+/g, "-"), publishStatus: "published",
  syncedAt: null, updatedAt: now, units: [], override: null, ...o,
});

const rows: SearchDevelopment[] = [
  dev({ id: "a", publicName: "Alpha", units: [unit({ price: 300_000, beds: "2" }), unit({ price: 450_000, beds: "3", type: "Penthouse" })] }),
  dev({ id: "b", publicName: "Beta", district: "Limassol", town: "Limassol", units: [unit({ price: 900_000, beds: "4", type: "Villas / Houses", amenities: ["Sea View"] })] }),
  dev({ id: "c", publicName: "Gamma", priceFrom: 200_000, priceTo: 260_000, units: [unit({ price: null, beds: "1" })] }),
  dev({ id: "d", publicName: "Delta", units: [unit({ price: 500_000, status: "sold" })] }),
  dev({ id: "e", publicName: "Epsilon", publishStatus: "ready", slug: null, units: [unit({ price: 100_000 })] }),
  dev({ id: "f", publicName: "Zeta", completion: "Q2 2028", units: [unit({ price: 350_000 })] }),
  dev({ id: "g", publicName: "Eta", completion: "TBA", units: [unit({ price: 360_000 })] }),
];

test("empty filters: published only, sold-out dropped by default, price_asc sort, summary over the whole set", () => {
  const r = filterAndRank(rows, {}, now);
  assert.deepEqual(r.rows.map((x) => x.name), ["Gamma", "Alpha", "Zeta", "Eta", "Beta"]); // Gamma: no unit price → priceFrom 200k sorts first
  assert.equal(r.total, 5); // a, b, c, f, g — d is sold out, e is ready
  assert.deepEqual(r.summary.byDistrict, { Paphos: 4, Limassol: 1 });
  assert.equal(r.rows.find((x) => x.name === "Alpha")?.publicUrl?.de, "/de/projects/alpha");
});

test("includeReady adds ready rows with publicUrl null", () => {
  const r = filterAndRank(rows, { includeReady: true }, now);
  const e = r.rows.find((x) => x.name === "Epsilon");
  assert.equal(e?.publishStatus, "ready");
  assert.equal(e?.publicUrl, null);
});

test("budget applies to unit prices, with priceFrom/priceTo fallback when no unit is priced", () => {
  const r = filterAndRank(rows, { budgetMax: 320_000 }, now);
  const names = r.rows.map((x) => x.name);
  assert.deepEqual(names, ["Gamma", "Alpha"]);
  const alpha = r.rows.find((x) => x.name === "Alpha")!;
  assert.deepEqual(alpha.matchingUnits, { count: 1, minPrice: 300_000, maxPrice: 300_000, types: ["Apartment"] });
  assert.equal(r.rows.find((x) => x.name === "Gamma")?.matchingUnits.priceFallback, true);
});

test("property type and bedrooms are normalised like the admin panel; 5 means 5+", () => {
  assert.deepEqual(filterAndRank(rows, { propertyTypes: ["villa"] }, now).rows.map((x) => x.name), ["Beta"]);
  assert.deepEqual(filterAndRank(rows, { bedrooms: [3] }, now).rows.map((x) => x.name), ["Alpha"]);
  assert.deepEqual(filterAndRank([dev({ id: "h", publicName: "Theta", units: [unit({ beds: "6", price: 1 })] })], { bedrooms: [5] }, now).total, 1);
});

test("districts fall back to town; amenity matches development or unit amenities", () => {
  assert.deepEqual(filterAndRank(rows, { districts: ["limassol"] }, now).rows.map((x) => x.name), ["Beta"]);
  assert.deepEqual(filterAndRank(rows, { amenity: "sea view" }, now).rows.map((x) => x.name), ["Beta"]);
  const withDevAmenity = dev({ id: "i", publicName: "Iota", amenities: ["Communal Pool"], units: [unit({ price: 1 })] });
  assert.deepEqual(filterAndRank([withDevAmenity], { amenity: "pool" }, now).rows.map((x) => x.name), ["Iota"]);
});

test("completionBefore keeps unparseable completion and flags it", () => {
  assert.equal(parseCompletionBefore("2027"), Date.UTC(2028, 0, 1));
  assert.equal(parseCompletionBefore("2027-06"), Date.UTC(2027, 6, 1));
  assert.equal(parseCompletionBefore("June 2027"), "invalid");
  assert.equal(parseCompletionBefore(undefined), null);
  const r = filterAndRank(rows, { completionBefore: "2027" }, now);
  const names = r.rows.map((x) => x.name);
  assert.ok(!names.includes("Zeta")); // Q2 2028 is after
  assert.equal(r.rows.find((x) => x.name === "Eta")?.completionUnparsed, true);
});

test("sort orders and paging", () => {
  const desc = filterAndRank(rows, { sort: "price_desc", pageSize: 2 }, now);
  assert.deepEqual(desc.rows.map((x) => x.name), ["Beta", "Eta"]); // 900k, then 360k
  assert.equal(desc.total, 5);
  const p2 = filterAndRank(rows, { sort: "name", pageSize: 2, page: 2 }, now);
  assert.deepEqual(p2.rows.map((x) => x.name), ["Eta", "Gamma"]);
});

test("onlyAvailable=false keeps sold-out developments", () => {
  const r = filterAndRank(rows, { onlyAvailable: false }, now);
  assert.ok(r.rows.some((x) => x.name === "Delta" && x.availability.soldOut));
});

test("query, developer and stage are case-insensitive contains-matches", () => {
  assert.deepEqual(filterAndRank(rows, { query: "ZET" }, now).rows.map((x) => x.name), ["Zeta"]);
  const kappa = dev({ id: "j", publicName: "Kappa", developer: "Aristo Developers", units: [unit({ price: 1 })] });
  assert.equal(filterAndRank([kappa, ...rows], { developer: "aristo" }, now).total, 1);
  assert.equal(filterAndRank(rows, { developer: "nobody" }, now).total, 0);
  const lambda = dev({ id: "k", publicName: "Lambda", stage: "Under Construction", units: [unit({ price: 1 })] });
  assert.deepEqual(filterAndRank([lambda, ...rows], { stage: "construction" }, now).rows.map((x) => x.name), ["Lambda"]);
});

test("a development without a district is matched on its town", () => {
  const mu = dev({ id: "m", publicName: "Mu", district: null, town: "Larnaca", units: [unit({ price: 1 })] });
  const r = filterAndRank([mu, ...rows], { districts: ["larnaca"] }, now);
  assert.deepEqual(r.rows.map((x) => x.name), ["Mu"]);
  assert.deepEqual(r.summary.byDistrict, { Larnaca: 1 });
});
