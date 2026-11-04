import { test } from "node:test";
import assert from "node:assert/strict";
import { PLACEHOLDER_SLUG_RE, placeholderSlug, slugProblem } from "../translationSlug";

test("placeholder slugs match the pattern a publish check rejects, for every language", () => {
  for (const l of ["en", "de", "pl", "ru", "he"]) assert.match(placeholderSlug(l), PLACEHOLDER_SLUG_RE);
  assert.match(placeholderSlug("de", () => "abc12345"), /^draft-de-abc12345$/);
  assert.doesNotMatch("draft-horses-and-carts", PLACEHOLDER_SLUG_RE); // an ordinary slug that starts with "draft"
});

test("a placeholder cannot be published, in any per-language type", () => {
  for (const type of ["blog", "singlepage", "caseStudy", "category"]) {
    const m = slugProblem({ type, language: "de", slug: placeholderSlug("de"), siblings: [] });
    assert.ok(m && /placeholder/.test(m) && /German/.test(m), type);
  }
});

test("a translation that kept the source language's slug is refused, naming both languages", () => {
  const m = slugProblem({ type: "blog", language: "de", slug: "taxes-on-real-estate-in-cyprus", siblings: [{ language: "en", slug: "taxes-on-real-estate-in-cyprus" }, { language: "pl", slug: "podatki" }] });
  assert.ok(m && /English/.test(m) && /German/.test(m));
});

test("own-language slugs pass, with or without siblings", () => {
  assert.equal(slugProblem({ type: "blog", language: "de", slug: "steuern-auf-immobilien-in-zypern", siblings: [{ language: "en", slug: "taxes-on-real-estate-in-cyprus" }] }), null);
  assert.equal(slugProblem({ type: "blog", language: "ru", slug: "nalogi-na-nedvizhimost-na-kipre", siblings: [] }), null);
});

test("shared slugs that are correct stay allowed", () => {
  const sib = (language: string, slug: string) => [{ language, slug }];
  assert.equal(slugProblem({ type: "singlepage", language: "de", slug: "faq", siblings: sib("en", "faq") }), null);
  assert.equal(slugProblem({ type: "singlepage", language: "ru", slug: "kontakty", siblings: sib("pl", "kontakty") }), null);
  assert.equal(slugProblem({ type: "singlepage", language: "ru", slug: "o-nas", siblings: sib("pl", "o-nas") }), null);
  assert.equal(slugProblem({ type: "singlepage", language: "he", slug: "contacts", siblings: sib("en", "contacts") }), null);
  // Hebrew pages deliberately use the English slug, for landing pages and case studies alike
  assert.equal(slugProblem({ type: "caseStudy", language: "he", slug: "relocating-from-the-uk", siblings: sib("en", "relocating-from-the-uk") }), null);
  assert.equal(slugProblem({ type: "singlepage", language: "en", slug: "villas-cyprus", siblings: sib("he", "villas-cyprus") }), null);
});

test("but English <-> Hebrew is the only free pass: Hebrew may not copy a German slug", () => {
  assert.ok(slugProblem({ type: "singlepage", language: "he", slug: "haeuser-auf-zypern", siblings: [{ language: "de", slug: "haeuser-auf-zypern" }] }));
});

test("projects, developers and other types are never checked (their slugs are shared by design)", () => {
  assert.equal(slugProblem({ type: "project", language: "de", slug: "aldo-residences", siblings: [{ language: "en", slug: "aldo-residences" }] }), null);
  assert.equal(slugProblem({ type: "developer", language: "pl", slug: "inex", siblings: [{ language: "de", slug: "inex" }] }), null);
});
