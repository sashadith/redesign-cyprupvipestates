import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalPlaceLabels, placeKey } from "../crm/placeNames";
import { locationMatch } from "../crm/matching";

test("placeKey folds case, punctuation, accents and known transliterations", () => {
  assert.equal(placeKey("Tombs Of The Kings"), placeKey("Tombs of the Kings"));
  assert.equal(placeKey("Park Of Colours"), placeKey("park of colours"));
  assert.equal(placeKey("Agios Nicolaos"), placeKey("Agios Nikolaos"));
  assert.equal(placeKey("Pareklissia"), placeKey("Parekklisia"));
  assert.equal(placeKey("Souni-Zanatzia"), placeKey("Souni"));
  assert.equal(placeKey("  Ágios  Tychonas "), "agios tychonas");
  assert.notEqual(placeKey("Germasogeia"), placeKey("Germasogeia Village"));
  assert.equal(placeKey(null), "");
});

test("canonicalPlaceLabels: one label per place, lower-case link words win, then frequency", () => {
  const labels = canonicalPlaceLabels([
    "Tombs Of The Kings", "Tombs of the Kings", "Tombs of the Kings",
    "Park Of Colours", "Park Of Colours", "Park of Colours",
    "Agios Nikolaos", "Agios Nikolaos", "Agios Nicolaos", "", "Kato Paphos",
  ]);
  assert.equal(labels.get(placeKey("Tombs Of The Kings")), "Tombs of the Kings");
  assert.equal(labels.get(placeKey("Park Of Colours")), "Park of Colours");
  assert.equal(labels.get(placeKey("Agios Nicolaos")), "Agios Nikolaos");
  assert.equal(labels.size, 4);
});

test("locationMatch: an area chip matches every spelling of it", () => {
  const dev = { district: "Paphos", town: null, area: "Tombs Of The Kings" };
  assert.equal(locationMatch(dev, ["paphos"], ["tombs of the kings"]).areaMatches, true);
  assert.equal(locationMatch({ ...dev, area: "Agios Nicolaos", district: "Limassol" }, ["limassol"], ["agios nikolaos"]).areaMatches, true);
});
