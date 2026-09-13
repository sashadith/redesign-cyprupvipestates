import { test } from "node:test";
import assert from "node:assert/strict";
import { heFeedLabel, heBedrooms, HE_FEED_VOCAB } from "@/lib/heFeedVocab";

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

// ---- amenities (Pass B S17) ----------------------------------------------
// The presentation overlay's amenity chips rendered the raw English feed value
// among Hebrew copy. The terms live in the ONE vocabulary table, not in a
// second table under c/[token]/ (Pass B Systemic S-A).

test("heFeedLabel maps the amenity strings the presentation chips render", () => {
  assert.equal(heFeedLabel("Swimming pool"), "בריכת שחייה");
  assert.equal(heFeedLabel("Private pool"), "בריכה פרטית");
  assert.equal(heFeedLabel("Communal pool"), "בריכה משותפת");
  assert.equal(heFeedLabel("Gym"), "חדר כושר");
  assert.equal(heFeedLabel("Concierge"), "קונסיירז'");
  assert.equal(heFeedLabel("Sea view"), "נוף לים");
  assert.equal(heFeedLabel("Covered parking"), "חניה מקורה");
  assert.equal(heFeedLabel("Storage room"), "מחסן");
  assert.equal(heFeedLabel("Lift"), "מעלית");
  assert.equal(heFeedLabel("Underfloor heating"), "חימום תת-רצפתי");
  assert.equal(heFeedLabel("Solar panels"), "פאנלים סולאריים");
  assert.equal(heFeedLabel("Gated community"), "קהילה מגודרת");
  assert.equal(heFeedLabel("Fitted kitchen"), "מטבח מאובזר");
  assert.equal(heFeedLabel("Fireplace"), "קמין");
});

test("heFeedLabel absorbs the casing, hyphen and underscore variants the feeds ship", () => {
  assert.equal(heFeedLabel("SWIMMING POOL"), heFeedLabel("swimming pool"));
  assert.equal(heFeedLabel("roof-garden"), "מרפסת גג");
  assert.equal(heFeedLabel("smart_home"), "בית חכם");
  assert.equal(heFeedLabel("  Sea  View  "), "נוף לים");
  assert.equal(heFeedLabel("En-suite"), "חדר רחצה צמוד");
  assert.equal(heFeedLabel("Walk-in wardrobe"), "חדר ארונות");
  // norm() does NOT fold plurals or synonyms, so each shipped spelling has its
  // own key — the table is explicit rather than clever.
  assert.equal(heFeedLabel("Sea views"), "נוף לים");
  assert.equal(heFeedLabel("Elevator"), "מעלית");
  assert.equal(heFeedLabel("Fitness"), "חדר כושר");
  assert.equal(heFeedLabel("BBQ"), "אזור מנגל");
  assert.equal(heFeedLabel("Barbecue area"), "אזור מנגל");
  assert.equal(heFeedLabel("A/C"), "מיזוג אוויר");
  assert.equal(heFeedLabel("Air conditioning"), "מיזוג אוויר");
  assert.equal(heFeedLabel("Pressurized water"), "מערכת מים בלחץ");
  assert.equal(heFeedLabel("Pressurised water"), "מערכת מים בלחץ");
});

test("heFeedLabel isolates an amenity we have no approved term for", () => {
  // never a guess, never bare Latin loose in an RTL run
  assert.equal(heFeedLabel("Padel court"), `${FSI}Padel court${PDI}`);
  assert.equal(heFeedLabel("Helipad"), `${FSI}Helipad${PDI}`);
});

test("the 24/7 security chip keeps its digit run LTR-isolated", () => {
  assert.equal(heFeedLabel("24/7 security"), `אבטחה ${LRI}24/7${PDI}`);
  assert.equal(heFeedLabel("24-7 Security"), `אבטחה ${LRI}24/7${PDI}`);
});

test("no vocabulary term smuggles an en dash or em dash into Hebrew", () => {
  for (const [key, value] of Object.entries(HE_FEED_VOCAB)) {
    assert.ok(!value.includes("–"), `${key} contains an en dash`);
    assert.ok(!value.includes("—"), `${key} contains an em dash`);
  }
});
