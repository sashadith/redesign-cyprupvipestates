import { test } from "node:test";
import assert from "node:assert/strict";
import { heFeedLabel, heBedrooms } from "@/lib/heFeedVocab";

const FSI = "⁨";
const PDI = "⁩";
const LRI = "⁦";

test("heFeedLabel maps the property types the feeds ship", () => {
  assert.equal(heFeedLabel("Villa"), "וילה");
  assert.equal(heFeedLabel("Apartment"), "דירה");
  assert.equal(heFeedLabel("Townhouse"), "בית טורי");
  assert.equal(heFeedLabel("Penthouse"), "פנטהאוז");
  assert.equal(heFeedLabel("Bungalow"), "בונגלו");
  assert.equal(heFeedLabel("Plot"), "מגרש");
  assert.equal(heFeedLabel("Studio"), "סטודיו");
  assert.equal(heFeedLabel("Maisonette"), "דופלקס");
});

test("heFeedLabel is case- and separator-insensitive", () => {
  assert.equal(heFeedLabel("VILLA"), "וילה");
  assert.equal(heFeedLabel("semi-detached"), "בית דו משפחתי");
  assert.equal(heFeedLabel(" town house "), "בית טורי");
});

test("heFeedLabel maps unit statuses in the feminine — the subject is יחידה", () => {
  assert.equal(heFeedLabel("Available"), "זמינה");
  assert.equal(heFeedLabel("Reserved"), "שמורה");
  assert.equal(heFeedLabel("Sold"), "נמכרה");
  assert.equal(heFeedLabel("Under offer"), "בהצעה");
});

test("heFeedLabel isolates an unknown raw value instead of guessing", () => {
  assert.equal(heFeedLabel("Loft"), `${FSI}Loft${PDI}`);
  assert.equal(heFeedLabel(""), "");
});

test("heBedrooms writes the numeral for one out and postposes it", () => {
  // "1 חדרי שינה" was the ungrammatical string on the card (Pass B, Must fix #9)
  assert.equal(heBedrooms("1"), "חדר שינה אחד");
  assert.doesNotMatch(heBedrooms("1"), /^1 /);
  assert.equal(heBedrooms("3"), "3 חדרי שינה");
});

test("heBedrooms gives a studio no unit word at all", () => {
  assert.equal(heBedrooms("Studio"), "סטודיו");
  assert.equal(heBedrooms("ST"), "סטודיו");
  assert.equal(heBedrooms("0"), "סטודיו");
});

test("heBedrooms keeps a range LTR-isolated and hyphenated, never en-dashed", () => {
  assert.equal(heBedrooms("2-4"), `${LRI}2-4${PDI} חדרי שינה`);
  // an en dash arriving from another producer is normalised to the plain hyphen §3 allows
  assert.equal(heBedrooms("2–4"), `${LRI}2-4${PDI} חדרי שינה`);
  assert.ok(!heBedrooms("2–4").includes("–"));
});

test("heBedrooms passes an empty value through and isolates anything unparseable", () => {
  assert.equal(heBedrooms(""), "");
  assert.equal(heBedrooms("3+1"), `${FSI}3+1${PDI}`);
});
