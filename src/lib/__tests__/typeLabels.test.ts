import { test } from "node:test";
import assert from "node:assert/strict";
import { typeLabel, typeLabelList } from "@/lib/typeLabels";
import { heFeedLabel } from "@/lib/heFeedVocab";

test("apartment is Wohnung / Apartament / Квартира, English stays raw", () => {
  assert.equal(typeLabel("Apartment", "de"), "Wohnung");
  assert.equal(typeLabel("Apartment", "pl"), "Apartament");
  assert.equal(typeLabel("Apartment", "ru"), "Квартира");
  assert.equal(typeLabel("Apartment", "en"), "Apartment");
});

test("every canonical unit type has a de/pl/ru label", () => {
  const types = ["Apartment","Penthouse","Studio","Maisonette","Duplex","Villa","Townhouse","Office","Shop","Commercial","Hotel","Restaurant"];
  for (const t of types) for (const l of ["de","pl","ru"]) {
    assert.ok(typeLabel(t, l), `${t}/${l}`);
  }
  assert.equal(typeLabel("Office", "de"), "Büro");
  assert.equal(typeLabel("Shop", "pl"), "Sklep");
  assert.equal(typeLabel("Duplex", "pl"), "Dupleks");
  assert.equal(typeLabel("Maisonette", "ru"), "Мезонет");
});

test("case, plurals and feed spellings resolve; unknown stays raw", () => {
  assert.equal(typeLabel("apartments", "pl"), "Apartament");
  assert.equal(typeLabel("VILLA", "ru"), "Вилла");
  assert.equal(typeLabel("Town House", "de"), "Reihenhaus");
  assert.equal(typeLabel("Residential", "pl"), "Residential");
  assert.equal(typeLabel("", "pl"), "");
});

test("compound values are split, mapped and rejoined", () => {
  assert.equal(typeLabelList("Apartment · Villa · Townhouse", "pl"), "Apartament · Willa · Dom szeregowy");
  assert.equal(typeLabelList("Apartment · Villa", "de"), "Wohnung · Villa");
  assert.equal(typeLabelList("Apartment · Villa", "en"), "Apartment · Villa");
  assert.equal(typeLabelList("", "pl"), "");
});

test("he is unchanged: same output as heFeedLabel", () => {
  assert.equal(typeLabel("Villa", "he"), heFeedLabel("Villa"));
  assert.equal(typeLabelList("Apartment · Penthouse", "he"), `${heFeedLabel("Apartment")} · ${heFeedLabel("Penthouse")}`);
});
