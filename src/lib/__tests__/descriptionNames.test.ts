import { test } from "node:test";
import assert from "node:assert/strict";
import { descriptionNamesFound, forbiddenNames } from "@/lib/ai/descriptionNames";
import type { LocaleText } from "@/lib/ai/localeTextGuards";

const text = (en: string, rest: Partial<LocaleText> = {}): LocaleText => ({ en, de: "", pl: "", ru: "", he: "", ...rest } as LocaleText);

test("forbidden names: project as given, developer without tags, and the developer's brand", () => {
  assert.deepEqual(forbiddenNames({ projectNames: ["Zephyr Penthouse"], developer: "Property Gallery" }), ["Zephyr Penthouse", "Property Gallery", "Gallery"]);
  assert.deepEqual(forbiddenNames({ projectNames: ["Hill Residences 2"], developer: "Korantina Homes (SharePoint)" }), ["Hill Residences 2", "Korantina Homes", "Korantina"]);
  assert.deepEqual(forbiddenNames({ projectNames: ["Perneri", null, ""], developer: "Leptos Estates" }), ["Perneri", "Leptos Estates", "Leptos"]);
  assert.deepEqual(forbiddenNames({ projectNames: ["Arya"], developer: "Square One" }), ["Arya", "Square One"]);
});

test("the live Zephyr Penthouse text is caught — in English and in German", () => {
  const names = forbiddenNames({ projectNames: ["Zephyr Penthouse"], developer: "Property Gallery" });
  assert.deepEqual(
    descriptionNamesFound(text("Zephyr Penthouse, by Property Gallery, occupies the top floor."), names),
    { locale: "en", name: "Zephyr Penthouse" },
  );
  assert.deepEqual(
    descriptionNamesFound(text("The top floor of a finished building.", { de: "Das Penthouse von Property Gallery liegt oben." }), names),
    { locale: "de", name: "Property Gallery" },
  );
});

test("the developer's brand alone is caught (the Leptos membership sentences)", () => {
  const names = forbiddenNames({ projectNames: ["Zanatzia"], developer: "Leptos Estates" });
  assert.deepEqual(descriptionNamesFound(text("Membership in the Leptos lifestyle programme adds leisure privileges."), names), { locale: "en", name: "Leptos" });
});

test("ordinary lower-case words that equal a name are not names", () => {
  const plus = forbiddenNames({ projectNames: ["Plus 38"], developer: "Plus Properties" });
  assert.equal(descriptionNamesFound(text("Three bedrooms, plus a roof garden with sea views."), plus), null);
  const harbour = forbiddenNames({ projectNames: ["Harbour"], developer: "Island Blue" });
  assert.equal(descriptionNamesFound(text("Apartments a short walk from the old harbour."), harbour), null);
  assert.deepEqual(descriptionNamesFound(text("Harbour, by Island Blue, brings a new address."), harbour), { locale: "en", name: "Harbour" });
});

test("a name inside a longer word does not count, a name next to punctuation does", () => {
  const names = forbiddenNames({ projectNames: ["Arya"], developer: "Square One" });
  assert.equal(descriptionNamesFound(text("Aryan architecture."), names), null);
  assert.deepEqual(descriptionNamesFound(text("Квартиры в «Arya» на продажу."), names), { locale: "en", name: "Arya" });
});

test("a clean description passes", () => {
  const names = forbiddenNames({ projectNames: ["Zephyr Penthouse"], developer: "Property Gallery" });
  assert.equal(descriptionNamesFound(text("The three-bedroom home occupies the top floor of a completed building in Germasogeia."), names), null);
});
