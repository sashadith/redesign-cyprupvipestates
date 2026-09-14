import { test } from "node:test";
import assert from "node:assert/strict";
import { ogLocale, sitemapLocalesForType, staticAlternates } from "@/lib/seo";
import { BCP47, localesForStaticRoute } from "@/lib/locale";

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
  // NOTE: this is the TYPE axis only ("does the 'pages' sitemap type emit any
  // he rows at all") — it does NOT mean every individual route within a type
  // gets a he row. A route deliberately excluded in some locale (e.g.
  // /partners in he, decision J) is filtered at the per-route level by
  // localesForStaticRoute()/staticAlternates() (lib/locale.ts, lib/seo.ts),
  // tested separately below — that is what Task 3's review found missing
  // here, not this type-level decision, which stands as documented.
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

// --- localesForStaticRoute / staticAlternates: per-route exclusion ---------
//
// Task 3's Critical finding: /partners (decision J, spec §4.4/§8) must never
// get a `he` sitemap row or a `he` hreflang alternate, because Partners is
// deliberately NOT translated (PARTNERS_COPY.he is a straight `en` alias).
// UNLOCALIZED_ROUTES (lib/locale.ts) is the single source of truth for this;
// these tests exercise it directly and through staticAlternates(), and
// confirm a genuinely-translated static route (privacy-policy) is
// unaffected — it keeps its `he` alternate exactly as before.

test("localesForStaticRoute excludes he for partners once he is public", () => {
  const withHe = ["en", "de", "pl", "ru", "he"] as const;
  const locales = localesForStaticRoute("partners", withHe);
  assert.ok(!locales.includes("he"), "partners must never include he (decision J)");
  assert.deepEqual(locales, ["en", "de", "pl", "ru"]);
});

test("localesForStaticRoute includes he for a route with no UNLOCALIZED_ROUTES entry (e.g. privacy-policy)", () => {
  const withHe = ["en", "de", "pl", "ru", "he"] as const;
  const locales = localesForStaticRoute("privacy-policy", withHe);
  assert.deepEqual(locales, withHe);
});

test("localesForStaticRoute defaults to PUBLIC_LOCALES when no publicLocales is given (doesn't throw, excludes he from partners either way)", () => {
  // Whatever this process's PUBLIC_LOCALES is (he gated or live), partners
  // must never include he: either he isn't public at all, or it's public
  // and gets filtered out by UNLOCALIZED_ROUTES — both land on "not present".
  const locales = localesForStaticRoute("partners");
  assert.ok(Array.isArray(locales));
  assert.ok(locales.includes("en"), "en is never gated away");
  assert.ok(!locales.includes("he"));
});

test("staticAlternates('partners'): no locale's page gets a he alternate", () => {
  const withHe = ["en", "de", "pl", "ru", "he"] as const;
  for (const lang of ["en", "de", "pl", "ru"]) {
    const { languages } = staticAlternates(lang, "partners", { publicLocales: withHe });
    assert.ok(!("he" in languages), `${lang}'s /partners alternates must not include he`);
  }
});

test("staticAlternates('partners', 'he'): the he page itself (if ever rendered) gets canonical only, no cross-locale alternates", () => {
  const withHe = ["en", "de", "pl", "ru", "he"] as const;
  const { canonical, languages } = staticAlternates("he", "partners", { publicLocales: withHe });
  assert.deepEqual(languages, { he: canonical });
});

test("staticAlternates('privacy-policy'): he alternate stays intact for a genuinely translated static route", () => {
  const withHe = ["en", "de", "pl", "ru", "he"] as const;
  const { languages } = staticAlternates("en", "privacy-policy", { publicLocales: withHe });
  assert.ok("he" in languages, "privacy-policy is a real Phase 5b translation and must keep its he alternate");
  const he = staticAlternates("he", "privacy-policy", { publicLocales: withHe });
  assert.ok("en" in he.languages && "de" in he.languages, "the he page itself still cross-links normally for a localized route");
});
