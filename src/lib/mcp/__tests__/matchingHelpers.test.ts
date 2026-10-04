import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBeds, normalizeType, rangesOverlap, locationMatch } from "@/lib/crm/matching";

test("parseBeds reads studio and the first number of free text", () => {
  assert.equal(parseBeds("Studio"), 0);
  assert.equal(parseBeds("2 bed"), 2);
  assert.equal(parseBeds("3-4"), 3);
  assert.equal(parseBeds(""), null);
  assert.equal(parseBeds(null), null);
});

test("normalizeType folds feed spellings onto the four residential kinds plus office", () => {
  assert.equal(normalizeType("Villas / Houses"), "villa");
  assert.equal(normalizeType("Apartments / Penthouses"), "apartment"); // first alias wins, as in the admin panel
  assert.equal(normalizeType("PENTHOUSE"), "penthouse");
  assert.equal(normalizeType("Town House"), "villa"); // pre-existing: the space defeats the townhouse alias and "house" → villa wins
  assert.equal(normalizeType("Townhouse"), "townhouse");
  assert.equal(normalizeType("Shops / Commercial Buildings"), "office");
  assert.equal(normalizeType(undefined), null);
});

test("rangesOverlap treats null as open-ended", () => {
  assert.equal(rangesOverlap(100, 200, 150, 300), true);
  assert.equal(rangesOverlap(100, 200, 250, 300), false);
  assert.equal(rangesOverlap(null, 200, 150, null), true);
  assert.equal(rangesOverlap(300, null, null, 200), false);
});

test("locationMatch: district falls back to town, area only counts within a matching district", () => {
  const dev = { district: null, town: "Paphos", area: "Kato Paphos" };
  assert.deepEqual(locationMatch(dev, ["paphos"], []), { districtMatches: true, areaMatches: false });
  assert.deepEqual(locationMatch(dev, ["paphos"], ["kato paphos"]), { districtMatches: true, areaMatches: true });
  assert.deepEqual(locationMatch(dev, ["limassol"], ["kato paphos"]), { districtMatches: false, areaMatches: false });
  assert.deepEqual(locationMatch(dev, [], []), { districtMatches: false, areaMatches: false });
});
