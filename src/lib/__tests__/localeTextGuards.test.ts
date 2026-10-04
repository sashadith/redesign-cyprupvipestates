import { test } from "node:test";
import assert from "node:assert/strict";
import { hasHebrew, emptyLocales, scriptLeaks } from "@/lib/ai/localeTextGuards";

const ok = { en: "Sea-view apartments in Limassol.", de: "Wohnungen mit Meerblick in Limassol.", pl: "Apartamenty z widokiem na morze w Limassol.", ru: "Квартиры с видом на море в Лимассоле.", he: "דירות עם נוף לים בלימסול." };

test("clean five-locale output passes", () => {
  assert.ok(hasHebrew(ok.he));
  assert.deepEqual(emptyLocales(ok), []);
  assert.deepEqual(scriptLeaks(ok), []);
});
test("he without Hebrew script is a leak; Hebrew inside en is a leak; Cyrillic inside de is a leak", () => {
  assert.deepEqual(scriptLeaks({ ...ok, he: "Sea-view apartments in Limassol." }), ["he: no Hebrew script"]);
  assert.deepEqual(scriptLeaks({ ...ok, en: "דירות in Limassol" }), ["en: contains Hebrew script"]);
  assert.deepEqual(scriptLeaks({ ...ok, de: "Wohnungen в Лимассоле" }), ["de: contains Cyrillic"]);
});
test("emptyLocales lists blanks in canonical order", () => {
  assert.deepEqual(emptyLocales({ ...ok, de: "  ", he: "" }), ["de", "he"]);
});
