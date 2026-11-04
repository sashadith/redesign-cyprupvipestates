import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalUnitType, dominantType, normalizeCreateRow, normalizeUpdateRow, UNIT_TYPES } from "../unitType";
import { matchesPropertyTypeFilter } from "../developmentCard";
import { normalizeType } from "../crm/matching";

const t = (raw: string | null, unit = {}) => {
  const v = canonicalUnitType(raw, unit);
  return v.kind === "type" ? v.type : v.kind;
};

test("every spelling found in the DB on 2026-10-20 lands on the agreed word", () => {
  const cases: [string, string][] = [
    ["Apartment", "Apartment"], ["apartment", "Apartment"], ["Apartments", "Apartment"],
    ["Studio", "Studio"], ["studio", "Studio"], ["Swim-up Suite", "Studio"],
    ["Penthouse", "Penthouse"], ["Maisonette", "Maisonette"], ["Maisonettes", "Maisonette"], ["Duplex", "Duplex"],
    ["Villa", "Villa"], ["villa", "Villa"], ["Villas", "Villa"], ["Villas / Houses", "Villa"], ["Bungalow", "Villa"], ["House", "Villa"],
    ["Townhouse", "Townhouse"], ["Semi-detached", "Townhouse"], ["Terraced House", "Townhouse"], ["Townhouses / Maisonettes", "Townhouse"],
    ["Office", "Office"], ["Shop", "Shop"], ["Commercial", "Commercial"], ["commercial", "Commercial"],
    ["Shops / Commercial Buildings", "Commercial"], ["Commercial and Residential Building", "Commercial"], ["Boutique Hotel", "Hotel"],
  ];
  for (const [raw, want] of cases) assert.equal(t(raw), want, raw);
  for (const [, want] of cases) assert.ok((UNIT_TYPES as readonly string[]).includes(want), want);
});

test("empty, a block letter and 'Building' are not types", () => {
  for (const raw of ["", "  ", null, "B", "C", "Building"]) assert.equal(t(raw as string | null), "none", String(raw));
});

test("a unit named Penthouse is a penthouse whatever its feed category says", () => {
  assert.equal(t("apartment", { label: "Nr. Penthouse 301" }), "Penthouse");
  assert.equal(t("Apartments / Penthouses", { label: "Penthouse A" }), "Penthouse");
  assert.equal(t("", { name: "Penthouse 2" }), "Penthouse");
  assert.equal(t("Villa", { label: "Villa Penthouse View" }), "Villa"); // only apartment-ish rows are upgraded
});

test("Leptos' combined category is ambiguous: Apartment for a new unit, the stored type otherwise", () => {
  const v = canonicalUnitType("Apartments / Penthouses");
  assert.deepEqual(v, { kind: "ambiguous", fallback: "Apartment" });
});

test("an unknown word is kept (tidied), never guessed into another type", () => {
  assert.equal(t("plots & land parcels"), "Plots & land parcels");
});

test("update: an unusable or ambiguous type never overwrites the stored one", async () => {
  for (const raw of ["", "B", "Building", "Apartments / Penthouses", null]) {
    const row: Record<string, unknown> = { type: raw, price: 1 };
    normalizeUpdateRow(row);
    assert.equal("type" in row, false, String(raw));
    assert.equal(row.price, 1);
  }
  const row: Record<string, unknown> = { type: { set: "Villas" } };
  normalizeUpdateRow(row);
  assert.equal(row.type, "Villa");
});

test("create: an unusable type borrows the project's dominant type; ambiguous falls back to Apartment", async () => {
  const row: Record<string, unknown> = { developmentId: "d1", type: "" };
  await normalizeCreateRow(row, async () => "Villa");
  assert.equal(row.type, "Villa");
  const amb: Record<string, unknown> = { developmentId: "d1", type: "Apartments / Penthouses" };
  await normalizeCreateRow(amb, async () => null);
  assert.equal(amb.type, "Apartment");
  const none: Record<string, unknown> = { developmentId: "d1", type: "B" };
  await normalizeCreateRow(none, async () => null);
  assert.equal(none.type, null);
  const untouched: Record<string, unknown> = { developmentId: "d1" };
  await normalizeCreateRow(untouched, async () => "Villa");
  assert.equal("type" in untouched, false);
});

test("dominantType counts canonical words", () => {
  assert.equal(dominantType(["villa", "Villas", "Apartment", null, "B"]), "Villa");
  assert.equal(dominantType([null, "", "B"]), null);
});

test("the /projects filter has a Penthouse value; Apartment still finds penthouses", () => {
  assert.ok(matchesPropertyTypeFilter("Apartment · Penthouse", "Penthouse"));
  assert.ok(!matchesPropertyTypeFilter("Apartment · Studio", "Penthouse"));
  assert.ok(matchesPropertyTypeFilter("Penthouse", "Apartment"));
});

test("admin matching: studios, maisonettes and duplexes count as apartments; townhouse family and bungalow mapped", () => {
  assert.equal(normalizeType("Studio"), "apartment");
  assert.equal(normalizeType("Maisonette"), "apartment");
  assert.equal(normalizeType("Duplex"), "apartment");
  assert.equal(normalizeType("Penthouse"), "penthouse");
  assert.equal(normalizeType("Semi-detached"), "townhouse");
  assert.equal(normalizeType("Terraced House"), "townhouse");
  assert.equal(normalizeType("Bungalow"), "villa");
  assert.equal(normalizeType("Hotel"), "office");
});
