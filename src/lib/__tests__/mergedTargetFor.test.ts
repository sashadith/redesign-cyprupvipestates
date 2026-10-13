import { test } from "node:test";
import nestedPageRedirects from "../nestedPageRedirects.json";
import assert from "node:assert/strict";
import { DE_LANDING_MERGES, EN_LANDING_MERGES, PL_LANDING_MERGES, RU_LANDING_MERGES, mergedTargetFor, nestedCanonicalFor } from "../../middleware";

test("mergedTargetFor answers exactly what each locale's merge map says", () => {
  for (const [k, v] of Object.entries(DE_LANDING_MERGES)) assert.equal(mergedTargetFor(`/de/${k}`), v, `de ${k}`);
  for (const [k, v] of Object.entries(PL_LANDING_MERGES)) assert.equal(mergedTargetFor(`/pl/${k}`), v, `pl ${k}`);
  for (const [k, v] of Object.entries(RU_LANDING_MERGES)) assert.equal(mergedTargetFor(`/ru/${k}`), v, `ru ${k}`);
  for (const [k, v] of Object.entries(EN_LANDING_MERGES)) assert.equal(mergedTargetFor(`/${k}`), v, `en ${k}`);
});

test("retired DE blog articles and non-merged paths", () => {
  assert.equal(
    mergedTargetFor("/de/blog/mieteinnahmen-aus-deutschland-in-zypern-versteuern"),
    "/de/blog/immobilien-zypern-mit-garantierten-mieteinnahmen",
  );
  assert.equal(mergedTargetFor("/de/blog/ratgeber-fuer-deutsche-rentner"), null);
  assert.equal(mergedTargetFor("/blog/anything"), null);
  assert.equal(mergedTargetFor("/"), null);
});

test("nestedCanonicalFor sends a flat leaf to its nested canonical path and leaves everything else alone", () => {
  const map = nestedPageRedirects as Record<string, Record<string, string>>;
  for (const [lang, leaves] of Object.entries(map)) {
    for (const [leaf, canonical] of Object.entries(leaves)) {
      const flat = lang === "en" ? `/${leaf}` : `/${lang}/${leaf}`;
      const want = lang === "en" ? `/${canonical}` : `/${lang}/${canonical}`;
      assert.equal(nestedCanonicalFor(flat), flat === want ? null : want, flat);
      assert.equal(nestedCanonicalFor(want), null, `already canonical: ${want}`);
    }
  }
  assert.equal(nestedCanonicalFor("/"), null);
  assert.equal(nestedCanonicalFor("/projects/anything"), null); // reserved first segment
  assert.equal(nestedCanonicalFor("/no-such-page"), null);
});
