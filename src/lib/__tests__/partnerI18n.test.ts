import { test } from "node:test";
import assert from "node:assert/strict";
import { PartnerType } from "@prisma/client";
import { dict, PARTNER_LOCALES, pickPartnerLocale, fmt, lookup } from "@/lib/partner/i18n";

function shape(o: unknown, p = ""): string[] {
  if (typeof o === "string") return [p];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => shape(v, p ? `${p}.${k}` : k));
}
function strings(o: unknown): string[] {
  return typeof o === "string" ? [o] : Object.values(o as object).flatMap(strings);
}

test("dictionaries have identical keys and no empty strings", () => {
  const base = shape(dict("en")).sort();
  for (const l of PARTNER_LOCALES) {
    assert.deepEqual(shape(dict(l)).sort(), base, l);
    for (const s of strings(dict(l))) assert.ok(s.trim().length > 0);
  }
});
test("dictionaries have no Hebrew and keep the same placeholders", () => {
  const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
  const en = dict("en");
  for (const l of PARTNER_LOCALES) {
    for (const k of shape(en)) {
      assert.doesNotMatch(lookup(l, k)!, /[\u0590-\u05ff]/);
      // PL greetings are deliberately name-less ("Szanowni Państwo,")
      if (!k.endsWith(".greeting")) assert.equal(ph(lookup(l, k)!), ph(lookup("en", k)!), `${l} ${k}`);
    }
  }
});
test("partner types labelled in every locale", () => {
  for (const l of PARTNER_LOCALES)
    assert.deepEqual(Object.keys(dict(l).types).sort(), Object.values(PartnerType).sort());
});
test("fmt replaces placeholders and leaves unknown ones", () => {
  assert.equal(fmt("Hi {name}, {x}", { name: "A" }), "Hi A, {x}");
});
test("pickPartnerLocale priority", () => {
  assert.equal(pickPartnerLocale({ partnerLanguage: "pl", cookie: "de", acceptLanguage: "ru" }), "pl");
  assert.equal(pickPartnerLocale({ cookie: "de", acceptLanguage: "ru" }), "de");
  assert.equal(pickPartnerLocale({ cookie: "xx", acceptLanguage: "ru" }), "ru");
  assert.equal(pickPartnerLocale({ partnerLanguage: "he", acceptLanguage: "pl" }), "pl");
  assert.equal(pickPartnerLocale({ acceptLanguage: "de-CH,de;q=0.9" }), "de");
  assert.equal(pickPartnerLocale({ acceptLanguage: "fr;q=0.9,ru;q=0.5,en;q=0.1" }), "ru");
  assert.equal(pickPartnerLocale({ acceptLanguage: "he" }), "en");
  assert.equal(pickPartnerLocale({}), "en");
});
