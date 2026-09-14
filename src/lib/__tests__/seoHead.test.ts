import { test } from "node:test";
import assert from "node:assert/strict";
import { ogLocale, sitemapLocalesForType } from "@/lib/seo";
import { BCP47 } from "@/lib/locale";

// --- ogLocale ---------------------------------------------------------------
//
// Every existing openGraph.locale call site interpolated the raw route-param
// locale code directly (`locale: lang`) — not the OG-spec "language_TERRITORY"
// format. Fixing that for en/de/pl/ru would be an LTR-visible metadata change
// with no coverage in this task, so ogLocale() is deliberately byte-identical
// to the old `lang` value for every locale except `he`.

test("ogLocale returns the OG-spec he_IL for Hebrew", () => {
  assert.equal(ogLocale("he"), "he_IL");
  assert.equal(ogLocale("he"), BCP47.he.replace("-", "_"));
});

test("ogLocale is byte-identical to the raw locale code for en/de/pl/ru (LTR unchanged)", () => {
  for (const lang of ["en", "de", "pl", "ru"]) {
    assert.equal(ogLocale(lang), lang);
  }
});

test("ogLocale passes through an unrecognised code unchanged (same non-throwing behaviour every call site already relied on)", () => {
  assert.equal(ogLocale("xx"), "xx");
});

// --- sitemapLocalesForType ---------------------------------------------------
//
// Every listing type simply follows whatever locale set is passed in (the
// route always passes PUBLIC_LOCALES) — "he" gets a sitemap row for a type
// once it's public, full stop — except "blog", which additionally holds
// "he" back while it's borrowing English content (Phase 6: fewer than 5 own
// PUBLISHED Hebrew posts, see blogIndexInSitemap in lib/blogIndexMode.ts).
// PUBLISHED-only filtering itself happens in the row-builder queries
// (prisma findMany `status: "PUBLISHED"` in sanity.utils.ts) — this helper
// only decides the locale axis, so heBlogCount stands in for "how many
// PUBLISHED he blog rows exist" without this test touching the database.

test("sitemapLocalesForType: he is excluded from every type while gated (not in publicLocales)", () => {
  const gated = ["en", "de", "pl", "ru"];
  for (const type of ["projects", "developers", "case-studies", "pages", "developments", "blog"] as const) {
    const locales = sitemapLocalesForType(type, { publicLocales: gated, heBlogCount: 999 });
    assert.ok(!locales.includes("he"), `${type} must not include he while it isn't in publicLocales`);
    assert.deepEqual(locales.filter((l) => l !== "he"), gated.filter((l) => l !== "he"));
  }
});

test("sitemapLocalesForType: he is included for non-blog types as soon as it's public, regardless of blog content", () => {
  const withHe = ["en", "de", "pl", "ru", "he"];
  for (const type of ["projects", "developers", "case-studies", "pages", "developments"] as const) {
    const locales = sitemapLocalesForType(type, { publicLocales: withHe, heBlogCount: 0 });
    assert.ok(locales.includes("he"), `${type} must include he once it's public — no PUBLISHED-count gate applies outside blog`);
  }
});

test("sitemapLocalesForType('blog'): he is held back while borrowing English content (< 5 own PUBLISHED posts)", () => {
  const withHe = ["en", "de", "pl", "ru", "he"];
  assert.ok(!sitemapLocalesForType("blog", { publicLocales: withHe, heBlogCount: 0 }).includes("he"));
  assert.ok(!sitemapLocalesForType("blog", { publicLocales: withHe, heBlogCount: 4 }).includes("he"));
});

test("sitemapLocalesForType('blog'): he is included once it has its own 5+ PUBLISHED posts", () => {
  const withHe = ["en", "de", "pl", "ru", "he"];
  const locales = sitemapLocalesForType("blog", { publicLocales: withHe, heBlogCount: 5 });
  assert.ok(locales.includes("he"));
  // every other locale is unaffected by the blog-specific gate
  assert.deepEqual(locales, withHe);
});

test("sitemapLocalesForType defaults publicLocales to PUBLIC_LOCALES when not given (doesn't throw, returns an array)", () => {
  const locales = sitemapLocalesForType("projects");
  assert.ok(Array.isArray(locales));
  assert.ok(locales.includes("en"), "en is never gated away");
});
