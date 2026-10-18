import { test } from "node:test";
import assert from "node:assert/strict";
import { newRefCode } from "@/lib/partner/refCode";
import { parseTerms } from "@/lib/partner/terms";

const r = () => "ab12";

test("slug of company + suffix", () => assert.equal(newRefCode({ company: "Alfa Homes Ltd", lastName: "X" }, r), "alfa-homes-ltd-ab12"));
test("falls back to last name", () => assert.equal(newRefCode({ company: null, lastName: "Smith" }, r), "smith-ab12"));
test("umlauts and sharp s", () => assert.equal(newRefCode({ company: "Müller Bäder Straße", lastName: "x" }, r), "mueller-baeder-s-ab12"));
test("polish diacritics", () => assert.equal(newRefCode({ company: "Łąka Śląsk", lastName: "x" }, r), "laka-slask-ab12"));
test("cyrillic", () => assert.equal(newRefCode({ company: "Северный Дом", lastName: "x" }, r), "severnyy-dom-ab12"));
test("cyrillic company falls to last name when only unknown chars", () => assert.equal(newRefCode({ company: "株式会社", lastName: "Ivanov" }, r), "ivanov-ab12"));
test("empty everything -> partner", () => assert.equal(newRefCode({ company: "", lastName: "!!!" }, r), "partner-ab12"));
test("length cap 16, no trailing dash", () => {
  const c = newRefCode({ company: "Abcdefghijklmno pqrstuvw", lastName: "x" }, r);
  assert.equal(c, "abcdefghijklmno-ab12");
  assert.match(c, /^[a-z0-9-]{1,16}-[a-z0-9]{4}$/);
});
test("terms: valid", () => {
  const t = parseTerms({ handoverShare: "30", fixShare: "50,5", trustMode: true, managerUserId: null });
  assert.deepEqual(t, { ok: true, value: { handoverShare: 30, fixShare: 50.5, trustMode: true, managerUserId: null } });
});
test("terms: rejects bad share, zero, >100", () => {
  for (const v of ["abc", "0", "101", ""]) assert.equal(parseTerms({ handoverShare: v, fixShare: "50", trustMode: false, managerUserId: null }).ok, false);
});
