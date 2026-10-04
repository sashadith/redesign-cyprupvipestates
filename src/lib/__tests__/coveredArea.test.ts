// Covered area on the project page (cards + units table) = interior + covered
// veranda. Until 2026-10-04 it was areaBuilt + areaVeranda, which double-counted
// the veranda for every source that stores a veranda-inclusive total in
// areaBuilt (Cybarco, SharePoint, manual, AGG, Drive — ~1,000 published units).
// Every case below is a real unit row from the production DB on 2026-10-04.
//
// Pure function only — no DB, no React.
import { test } from "node:test";
import assert from "node:assert/strict";
import { areaValue, coveredArea, interiorArea } from "@/lib/formatArea";

test("a veranda-inclusive areaBuilt is not added to twice — areaInternal is the base", () => {
  // AGG Vasileon C305: "Total areas: 124" also carries parking 15 + storage 3 + uncovered 6.
  assert.equal(coveredArea("124", "89", "11"), 100); // the page said 135
  // Cybarco Centro Limassol A 208: built 72 = 51 + 21 exactly.
  assert.equal(coveredArea("72", "51", "21"), 72); // the page said 93
  // SharePoint City Landmark A APT NO. 103.
  assert.equal(coveredArea("103.7", "66.7", "21.4"), 88.1); // the page said 125.1
  // Manual Emerald Park, pre-formatted strings.
  assert.equal(coveredArea("64.5 m²", "56 m²", "6.5 m²"), 62.5); // the page said 71
});

test("sources whose areaBuilt IS the interior keep today's figure", () => {
  // Plus Properties stores the interior in both fields.
  assert.equal(coveredArea("71", "71", "17.2"), 88.2);
  // Live-feed adapters (feeds.ts) have no areaInternal at all.
  assert.equal(coveredArea("96.3 m²", undefined, "39.6 m²"), 135.9);
  assert.equal(coveredArea("96.3", "", "39.6"), 135.9);
});

test("no veranda figure → no Covered figure", () => {
  assert.equal(coveredArea("124", "89", ""), null);
  assert.equal(coveredArea("124", "89", null), null);
  assert.equal(coveredArea("124", "89", "0"), null);
});

test("no area at all → null, not NaN", () => {
  assert.equal(coveredArea("", "", "11"), null);
  assert.equal(coveredArea(null, undefined, "11"), null);
});

test("IEEE 754 drift is rounded away", () => {
  assert.equal(coveredArea("", "125.6", "9.7"), 135.3);
});

test("areaValue reads the leading number only", () => {
  assert.equal(areaValue("77 m²"), 77);
  assert.equal(areaValue("64.5"), 64.5);
  assert.equal(areaValue(""), null);
  assert.equal(areaValue("—"), null);
  assert.equal(areaValue(undefined), null);
});

test("the interior line shows areaInternal, so interior + veranda = covered on the card", () => {
  // Vasileon C305: was "124" (Total areas incl. parking/storage) next to Covered 100.
  assert.equal(interiorArea("124", "89"), "89");
  assert.equal(interiorArea("124", "89") && coveredArea("124", "89", "11"), 100);
  // City Landmark 301: built 138.1 also holds 12 parking + 4.9 communal.
  assert.equal(interiorArea("138.1", "92.2"), "92.2");
  // The source's own formatting is kept.
  assert.equal(interiorArea("67 m²", "52 m²"), "52 m²");
});

test("without an areaInternal the interior line keeps areaBuilt", () => {
  assert.equal(interiorArea("71", "71"), "71"); // Plus Properties
  assert.equal(interiorArea("96.3 m²", undefined), "96.3 m²"); // live-feed adapters
  assert.equal(interiorArea("96.3", ""), "96.3");
  assert.equal(interiorArea("96.3", "—"), "96.3");
  assert.equal(interiorArea("", null), "");
  assert.equal(interiorArea(null, undefined), "");
});
