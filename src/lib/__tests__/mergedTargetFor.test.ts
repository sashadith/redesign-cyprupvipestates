import { test } from "node:test";
import nestedPageRedirects from "../nestedPageRedirects.json";
import assert from "node:assert/strict";
import { DE_LANDING_MERGES, EN_BLOG_RENAMES, EN_LANDING_MERGES, PL_LANDING_MERGES, RU_LANDING_MERGES, mergedTargetFor, nestedCanonicalFor } from "../../middleware";

test("mergedTargetFor answers exactly what each locale's merge map says", () => {
  for (const [k, v] of Object.entries(DE_LANDING_MERGES)) assert.equal(mergedTargetFor(`/de/${k}`), v, `de ${k}`);
  for (const [k, v] of Object.entries(PL_LANDING_MERGES)) assert.equal(mergedTargetFor(`/pl/${k}`), v, `pl ${k}`);
  for (const [k, v] of Object.entries(RU_LANDING_MERGES)) assert.equal(mergedTargetFor(`/ru/${k}`), v, `ru ${k}`);
  for (const [k, v] of Object.entries(EN_LANDING_MERGES)) assert.equal(mergedTargetFor(`/${k}`), v, `en ${k}`);
});

test("the P01/P02 duplicates redirect to the hub of their own query", () => {
  assert.equal(mergedTargetFor("/de/immobilien-zypern-kaufen"), "/de/immobilien-auf-zypern");
  assert.equal(mergedTargetFor("/de/top-100-immobilien-auf-zypern"), "/de/immobilien-auf-zypern");
  assert.equal(mergedTargetFor("/de/haeuser-in-zypern"), "/de/haeuser-auf-zypern");
  assert.equal(mergedTargetFor("/de/neubau-haeuser-zypern"), "/de/haeuser-auf-zypern");
  assert.equal(mergedTargetFor("/de/immobilien-auf-zypern"), null);
  assert.equal(mergedTargetFor("/de/haeuser-auf-zypern"), null);
  assert.equal(mergedTargetFor("/de/haeuser-in-zypern-fuer-investoren"), null);
});

test("retired DE blog articles and non-merged paths", () => {
  assert.equal(
    mergedTargetFor("/de/blog/auswandern-nach-zypern-aus-deutschland"),
    "/de/blog/wie-nach-zypern-auswandern",
  );
  assert.equal(
    mergedTargetFor("/de/blog/mieteinnahmen-aus-deutschland-in-zypern-versteuern"),
    "/de/blog/steuern-zypern-vs-deutschland-oesterreich-schweiz",
  );
  assert.equal(mergedTargetFor("/de/blog/ratgeber-fuer-deutsche-rentner"), null);
  assert.equal(mergedTargetFor("/blog/anything"), null);
  assert.equal(mergedTargetFor("/"), null);
});

test("renamed EN blog articles redirect single-hop to their new slug", () => {
  for (const [k, v] of Object.entries(EN_BLOG_RENAMES)) {
    assert.equal(mergedTargetFor(`/${k}`), v, k);
    assert.equal(mergedTargetFor(v), null, `target must not redirect again: ${v}`);
  }
  assert.equal(
    mergedTargetFor("/blog/cyprus-permanent-residency-golden-visa-guide"),
    "/blog/cyprus-permanent-residency-category-6-2-guide",
  );
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
