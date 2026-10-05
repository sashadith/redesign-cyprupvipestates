import test from "node:test";
import assert from "node:assert/strict";
import { matchesPropertyTypeFilter } from "../developmentCard";

/* The /projects type filter offers four values — Apartment, Villa, Townhouse,
   Commercial — and matches them as substrings against resolveDevelopmentType(),
   which is built from the UNIT type strings a feed or an operator supplied.
   Those strings are the developer's own vocabulary, and measured across the 292
   published projects on 2026-10-05 they come in 23 spellings, 13 of them outside
   the filter's four words. Eleven projects matched no filter value at all and
   were invisible to anyone using it.

   Flattening the data into four words was the other option and was rejected:
   "Penthouse" and "Duplex" are accurate, and a buyer searches for them. The
   filter learns the synonyms instead — which is what "Commercial" already did
   for office/shop since 2026-07-29. */

test("the four filter values still match their own word", () => {
  assert.ok(matchesPropertyTypeFilter("Apartment", "Apartment"));
  assert.ok(matchesPropertyTypeFilter("Villa", "Villa"));
  assert.ok(matchesPropertyTypeFilter("Townhouse", "Townhouse"));
  assert.ok(matchesPropertyTypeFilter("Commercial", "Commercial"));
});

test("plural and compound spellings keep matching", () => {
  // These already worked by substring and must not regress.
  assert.ok(matchesPropertyTypeFilter("Villas", "Villa"));
  assert.ok(matchesPropertyTypeFilter("Villas / Houses", "Villa"));
  assert.ok(matchesPropertyTypeFilter("Apartments / Penthouses", "Apartment"));
  assert.ok(matchesPropertyTypeFilter("Studio · Apartment", "Apartment"));
});

test("Commercial keeps its existing office/shop synonyms", () => {
  assert.ok(matchesPropertyTypeFilter("Office", "Commercial"));
  assert.ok(matchesPropertyTypeFilter("Shop", "Commercial"));
  assert.ok(matchesPropertyTypeFilter("Shops / Commercial Buildings", "Commercial"));
});

test("Apartment covers the flat types that were falling out", () => {
  // hide, olympic-residences-zeus-penthouse (Penthouse);
  // eden-roc-residence-block-d (Duplex); a studio-only building would be next.
  assert.ok(matchesPropertyTypeFilter("Penthouse", "Apartment"));
  assert.ok(matchesPropertyTypeFilter("Duplex", "Apartment"));
  assert.ok(matchesPropertyTypeFilter("Studio", "Apartment"));
  assert.ok(matchesPropertyTypeFilter("Maisonette", "Apartment"));
  assert.ok(matchesPropertyTypeFilter("Maisonettes", "Apartment"));
});

test("Townhouse covers the attached house types", () => {
  // zephyros-village-3 (Semi-detached); "Terraced House" exists on one project.
  assert.ok(matchesPropertyTypeFilter("Semi-detached", "Townhouse"));
  assert.ok(matchesPropertyTypeFilter("Terraced House", "Townhouse"));
});

test("Commercial covers hotels", () => {
  // promenade-boutique-hotel, regency-boutique-hotel.
  assert.ok(matchesPropertyTypeFilter("Boutique Hotel", "Commercial"));
});

test("the synonyms do not leak across filter values", () => {
  // The point of the filter is that picking one value excludes the others.
  assert.ok(!matchesPropertyTypeFilter("Penthouse", "Villa"));
  assert.ok(!matchesPropertyTypeFilter("Penthouse", "Townhouse"));
  assert.ok(!matchesPropertyTypeFilter("Semi-detached", "Apartment"));
  assert.ok(!matchesPropertyTypeFilter("Boutique Hotel", "Apartment"));
  assert.ok(!matchesPropertyTypeFilter("Villa", "Apartment"));
  assert.ok(!matchesPropertyTypeFilter("Studio", "Commercial"));
});

test("a townhouse is not dragged in by the word 'house' alone", () => {
  // "Villas / Houses" is a villa project; it must not also answer Townhouse.
  assert.ok(!matchesPropertyTypeFilter("Villas / Houses", "Townhouse"));
});

test("an empty or unknown type matches nothing", () => {
  // Four published projects carry no unit type and no category at all. They need
  // data, and until they have it the filter must not guess on their behalf.
  assert.ok(!matchesPropertyTypeFilter("", "Apartment"));
  assert.ok(!matchesPropertyTypeFilter("Building", "Commercial"));
});
