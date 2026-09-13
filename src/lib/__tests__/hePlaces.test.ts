import { test } from "node:test";
import assert from "node:assert/strict";
import { hePlace, hePlaceOrIsolated, hePlaceList, heBroadestPlace, heLocative, normalizePlaceKey } from "@/lib/hePlaces";

const FSI = "⁨";
const PDI = "⁩";

test("hePlace resolves a known city to its one approved spelling", () => {
  assert.equal(hePlace("Paphos"), "פאפוס");
  assert.equal(hePlace("Limassol"), "לימסול");
  assert.equal(hePlace("Larnaca"), "לרנקה");
});

test("hePlace accepts the spelling variants the feeds actually ship", () => {
  assert.equal(hePlace("Pafos"), "פאפוס");
  assert.equal(hePlace("Lemesos"), "לימסול");
  assert.equal(hePlace("Larnaka"), "לרנקה");
  assert.equal(hePlace("Agia Napa"), "איה נאפה");
  assert.equal(hePlace("Pegeia"), "פייה");
  assert.equal(hePlace("Chlorakas"), "כלורקה");
});

test("hePlace is case-, whitespace- and diacritic-insensitive", () => {
  assert.equal(hePlace("  KATO   PAPHOS "), "קאטו פאפוס");
  assert.equal(hePlace("Pafós"), "פאפוס");
  assert.equal(normalizePlaceKey("  Coral   Bay. "), "coral bay");
});

test("hePlace returns undefined for a place we have no approved spelling for", () => {
  assert.equal(hePlace("Nowhere Village"), undefined);
  assert.equal(hePlace(""), undefined);
});

test("hePlaceOrIsolated falls back to the Latin name, bidi-isolated", () => {
  assert.equal(hePlaceOrIsolated("Paphos"), "פאפוס");
  assert.equal(hePlaceOrIsolated("Nowhere Village"), `${FSI}Nowhere Village${PDI}`);
  assert.equal(hePlaceOrIsolated(""), "");
});

test("hePlaceList translates each comma-separated part on its own", () => {
  assert.equal(hePlaceList("Peyia, Paphos"), "פייה, פאפוס");
  assert.equal(hePlaceList("Kato Paphos,Paphos"), "קאטו פאפוס, פאפוס");
  // half-known values keep the unknown part Latin rather than falling back wholesale
  assert.equal(hePlaceList("Nowhere, Limassol"), `${FSI}Nowhere${PDI}, לימסול`);
  assert.equal(hePlaceList(""), "");
});

test("heBroadestPlace picks the LAST known part — the district carries the search volume", () => {
  assert.equal(heBroadestPlace("Peyia, Paphos"), "פאפוס");
  assert.equal(heBroadestPlace("Konia, Paphos"), "פאפוס");
  // only the narrow part is known → that one is used
  assert.equal(heBroadestPlace("Peyia, Nowhere"), "פייה");
  assert.equal(heBroadestPlace("Nowhere, Elsewhere"), undefined);
});

test("heLocative binds ב by the SCRIPT of the place, never by the locale", () => {
  // Hebrew place → bound prefix, no hyphen
  assert.equal(heLocative("Peyia, Paphos"), "בפאפוס");
  assert.equal(heLocative("Limassol"), "בלימסול");
  assert.ok(!heLocative("Paphos").includes("-"), "a Hebrew place must not take the hyphen");
  // Latin fallback → hyphen + isolated Latin
  assert.equal(heLocative("Nowhere Village"), `ב-${FSI}Nowhere Village${PDI}`);
  assert.equal(heLocative(""), "");
});
