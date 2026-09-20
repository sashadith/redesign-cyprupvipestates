import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildUrlPairs,
  parseHreflangAlternates,
  parseCanonical,
  parseMetaContent,
  parseOgLocale,
  parseRobotsMeta,
  parseJsonLdInLanguages,
  parsePage,
  assertPair,
  assertUnlocalizedPair,
  assertHeOnlyPage,
  appNoindex,
  samePath,
  PRODUCTION_ORIGIN,
} from "../hreflang-check.mjs";

// --- URL pair list ---------------------------------------------------------

test("buildUrlPairs includes rtl-matrix's page types (minus the synthetic 404 row), the two extra listing types, and all 17 landing slugs", () => {
  const pairs = buildUrlPairs();
  const types = pairs.map((p) => p.type);
  assert.ok(!types.includes("404"), "the 404 row has nothing to assert hreflang/canonical on, so it's excluded");
  for (const t of ["home", "projects", "developers", "blog", "about", "contacts", "faq", "privacy"]) {
    assert.ok(types.includes(t), `missing rtl-matrix type "${t}"`);
  }
  assert.ok(types.includes("case-studies"), "case-studies LISTING (plural) must be its own row, distinct from rtl-matrix's single case-study DETAIL row");
  assert.ok(types.includes("terms"), "terms-and-conditions has no rtl-matrix equivalent and must be added");
  const landingRows = pairs.filter((p) => p.type.startsWith("landing:"));
  assert.equal(landingRows.length, 17, "he-keyword-map.md §4 lists 17 landing slugs");
  assert.ok(landingRows.some((p) => p.en === "/real-estate-cyprus" && p.he === "/he/real-estate-cyprus"));
  assert.ok(landingRows.some((p) => p.en === "/limassol/new-projects" && p.he === "/he/limassol/new-projects"));
});

test("buildUrlPairs has no duplicate EN path", () => {
  const pairs = buildUrlPairs();
  const enPaths = pairs.map((p) => p.en);
  assert.equal(new Set(enPaths).size, enPaths.length);
});

test("buildUrlPairs includes the partners pair, marked unlocalized (decision J)", () => {
  const pairs = buildUrlPairs();
  const partners = pairs.find((p) => p.type === "partners");
  assert.ok(partners, "partners pair must be sampled — it's the exact pair the Task 3 Critical bug shipped on");
  assert.equal(partners.en, "/partners");
  assert.equal(partners.he, "/he/partners");
  assert.equal(partners.unlocalized, true);
});

// --- parsers -----------------------------------------------------------------

test("parseHreflangAlternates reads every alternate link regardless of attribute order", () => {
  const html = `<head>
    <link rel="alternate" hreflang="en" href="https://x/foo">
    <link href="https://x/he/foo" hreflang="he" rel="alternate">
    <link rel="alternate" hreflang="x-default" href="https://x/foo">
    <link rel="stylesheet" href="/ignored.css">
  </head>`;
  assert.deepEqual(parseHreflangAlternates(html), {
    en: "https://x/foo",
    he: "https://x/he/foo",
    "x-default": "https://x/foo",
  });
});

test("parseHreflangAlternates decodes HTML-entity-escaped hrefs (e.g. & in a query string)", () => {
  const html = `<link rel="alternate" hreflang="en" href="https://x/foo?a=1&amp;b=2">`;
  assert.deepEqual(parseHreflangAlternates(html), { en: "https://x/foo?a=1&b=2" });
});

test("parseCanonical reads the canonical link href, or null when absent", () => {
  assert.equal(parseCanonical(`<link rel="canonical" href="https://x/foo">`), "https://x/foo");
  assert.equal(parseCanonical(`<link rel="alternate" hreflang="en" href="https://x/foo">`), null);
});

test("parseMetaContent finds a meta tag by name= or property=, attribute-order agnostic", () => {
  assert.equal(parseMetaContent(`<meta name="robots" content="noindex">`, "robots", "name"), "noindex");
  assert.equal(parseMetaContent(`<meta content="he_IL" property="og:locale">`, "og:locale", "property"), "he_IL");
  assert.equal(parseMetaContent(`<meta name="description" content="x">`, "robots", "name"), null);
});

test("parseOgLocale / parseRobotsMeta are parseMetaContent specialised to their tag", () => {
  const html = `<meta property="og:locale" content="he_IL"><meta name="robots" content="index, follow">`;
  assert.equal(parseOgLocale(html), "he_IL");
  assert.equal(parseRobotsMeta(html), "index, follow");
});

test("parseJsonLdInLanguages collects inLanguage from every JSON-LD script, recursing into nested objects/arrays", () => {
  const html = `
    <script type="application/ld+json">{"@type":"FAQPage","inLanguage":"he-IL"}</script>
    <script type="application/ld+json">{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem"}]}</script>
    <script type="application/ld+json">{"@type":"Article","inLanguage":"he-IL","author":{"@type":"Organization"}}</script>
  `;
  assert.deepEqual(parseJsonLdInLanguages(html), ["he-IL", "he-IL"]);
});

test("parseJsonLdInLanguages skips malformed JSON-LD instead of throwing", () => {
  const html = `<script type="application/ld+json">{not valid json</script>`;
  assert.deepEqual(parseJsonLdInLanguages(html), []);
});

test("parseJsonLdInLanguages returns [] when there is no JSON-LD at all", () => {
  assert.deepEqual(parseJsonLdInLanguages("<html><body>plain page</body></html>"), []);
});

// --- assertPair: the fixture pairs ------------------------------------------

function heHtml({ canonical = "https://design.example/he/paphos", enAlt = "https://design.example/paphos", robots = "index, follow", ogLocale = "he_IL", inLanguage = "he-IL" } = {}) {
  return `<html dir="rtl"><head>
    <link rel="canonical" href="${canonical}">
    <link rel="alternate" hreflang="en" href="${enAlt}">
    <link rel="alternate" hreflang="he" href="${canonical}">
    <link rel="alternate" hreflang="x-default" href="${enAlt}">
    <meta property="og:locale" content="${ogLocale}">
    <meta name="robots" content="${robots}">
    <script type="application/ld+json">{"@type":"WebPage","inLanguage":"${inLanguage}"}</script>
  </head></html>`;
}

function enHtml({ canonical = "https://design.example/paphos", heAlt = "https://design.example/he/paphos", robots = "index, follow" } = {}) {
  return `<html><head>
    <link rel="canonical" href="${canonical}">
    <link rel="alternate" hreflang="en" href="${canonical}">
    <link rel="alternate" hreflang="he" href="${heAlt}">
    <link rel="alternate" hreflang="x-default" href="${canonical}">
    <meta name="robots" content="${robots}">
  </head></html>`;
}

test("assertPair: a fully correct EN/HE pair passes every check", () => {
  const en = parsePage("https://design.example/paphos", 200, enHtml());
  const he = parsePage("https://design.example/he/paphos", 200, heHtml());
  const result = assertPair(en, he);
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.checks, {
    enOk: true,
    heOk: true,
    xDefault: true,
    reciprocal: true,
    canonicalSelf: true,
    origin: true,
    ogLocale: true,
    robots: true,
    inLanguage: true,
  });
  assert.equal(result.originLabel, "matches host");
});

// --- C1 regression: identity checks compare PATHS, origin is separate -----
//
// Every canonical/hreflang URL the app actually emits is absolute against
// the hard-coded production SITE_URL (src/lib/seo.ts:11), never against
// whatever host served the request. Before the C1 fix, assertPair compared
// full URL strings (`en.alternates["x-default"] === en.url`, etc.) against
// `host + path`, so every pair FAILED the instant the fetched host wasn't
// exactly `https://cyprusvipestates.com` — i.e. every run against staging,
// which is the only host where `he` is public pre-launch (see
// docs/i18n/acceptance/phase-7-8.md and the launch-checklist's Schritt 4).

test("samePath compares pathname only, ignoring origin and a trailing slash", () => {
  assert.equal(samePath("https://design.example/paphos", "https://cyprusvipestates.com/paphos"), true);
  assert.equal(samePath("https://design.example/paphos/", "https://cyprusvipestates.com/paphos"), true);
  assert.equal(samePath("https://design.example/paphos", "https://design.example/limassol"), false);
  assert.equal(samePath(undefined, "https://design.example/paphos"), false);
  assert.equal(samePath("not a url", "https://design.example/paphos"), false);
});

test("assertPair: canonical/hreflang pinned to the production origin still passes every identity check when fetched from a staging host (C1)", () => {
  const en = parsePage(
    "https://design.example/paphos", // fetched from staging...
    200,
    enHtml({
      canonical: `${PRODUCTION_ORIGIN}/paphos`, // ...but the app always emits production-absolute URLs
      heAlt: `${PRODUCTION_ORIGIN}/he/paphos`,
    }),
  );
  const he = parsePage(
    "https://design.example/he/paphos",
    200,
    heHtml({
      canonical: `${PRODUCTION_ORIGIN}/he/paphos`,
      enAlt: `${PRODUCTION_ORIGIN}/paphos`,
    }),
  );
  const result = assertPair(en, he);
  assert.equal(result.checks.xDefault, true);
  assert.equal(result.checks.reciprocal, true);
  assert.equal(result.checks.canonicalSelf, true);
  assert.equal(result.checks.origin, true);
  assert.equal(result.originLabel, "production");
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
});

test("assertPair: a canonical origin that is neither the sampled host nor the configured production origin still fails (the path fix must not mask a real cross-domain bug)", () => {
  const en = parsePage(
    "https://design.example/paphos",
    200,
    enHtml({ canonical: "https://evil.example/paphos", heAlt: `${PRODUCTION_ORIGIN}/he/paphos` }),
  );
  const he = parsePage(
    "https://design.example/he/paphos",
    200,
    heHtml({ canonical: `${PRODUCTION_ORIGIN}/he/paphos`, enAlt: "https://evil.example/paphos" }),
  );
  const result = assertPair(en, he);
  // Paths still line up (both /paphos), so the C1 fix alone would pass this —
  // the separate origin check is what still catches it.
  assert.equal(result.checks.canonicalSelf, true);
  assert.equal(result.checks.origin, false);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.includes("origin")));
});

test("assertPair: --canonical-origin overrides the default production origin", () => {
  const en = parsePage(
    "https://design.example/paphos",
    200,
    enHtml({ canonical: "https://alt-prod.example/paphos", heAlt: "https://alt-prod.example/he/paphos" }),
  );
  const he = parsePage(
    "https://design.example/he/paphos",
    200,
    heHtml({ canonical: "https://alt-prod.example/he/paphos", enAlt: "https://alt-prod.example/paphos" }),
  );
  const result = assertPair(en, he, { canonicalOrigin: "https://alt-prod.example" });
  assert.equal(result.checks.origin, true);
  assert.equal(result.originLabel, "production");
  assert.equal(result.ok, true);
});

test("assertPair: fails reciprocity when the HE page's own 'en' alternate points at the wrong URL", () => {
  const en = parsePage("https://design.example/paphos", 200, enHtml());
  const he = parsePage(
    "https://design.example/he/paphos",
    200,
    heHtml({ enAlt: "https://design.example/WRONG" }),
  );
  const result = assertPair(en, he);
  assert.equal(result.ok, false);
  assert.equal(result.checks.reciprocal, false);
  assert.ok(result.issues.some((i) => i.includes("reciprocity")));
  // Unrelated checks still evaluate independently.
  assert.equal(result.checks.canonicalSelf, true);
});

test("assertPair: fails when og:locale on the HE page isn't he_IL", () => {
  const en = parsePage("https://design.example/paphos", 200, enHtml());
  const he = parsePage("https://design.example/he/paphos", 200, heHtml({ ogLocale: "he" }));
  const result = assertPair(en, he);
  assert.equal(result.checks.ogLocale, false);
  assert.equal(result.ok, false);
});

test("assertPair: fails when inLanguage on the HE page isn't he-IL", () => {
  const en = parsePage("https://design.example/paphos", 200, enHtml());
  const he = parsePage("https://design.example/he/paphos", 200, heHtml({ inLanguage: "he" }));
  const result = assertPair(en, he);
  assert.equal(result.checks.inLanguage, false);
});

test("assertPair: passes inLanguage vacuously when the page has no JSON-LD at all", () => {
  const en = parsePage("https://design.example/foo", 200, `<link rel="canonical" href="https://design.example/foo">`);
  const he = parsePage(
    "https://design.example/he/foo",
    200,
    `<link rel="canonical" href="https://design.example/he/foo">
     <link rel="alternate" hreflang="en" href="https://design.example/foo">
     <link rel="alternate" hreflang="he" href="https://design.example/he/foo">
     <link rel="alternate" hreflang="x-default" href="https://design.example/foo">
     <meta property="og:locale" content="he_IL">
     <meta name="robots" content="index, follow">`,
  );
  // No JSON-LD anywhere -> inLanguage check has nothing to assert -> true.
  assert.equal(en.inLanguage.length, 0);
  assert.equal(he.inLanguage.length, 0);
  assert.equal(assertPair(en, he).checks.inLanguage, true);
});

test("assertPair: robots must be noindex on /he/blog*, and indexable everywhere else", () => {
  const enBlog = parsePage("https://design.example/blog", 200, enHtml({ canonical: "https://design.example/blog", heAlt: "https://design.example/he/blog" }));
  const heBlogNoindex = parsePage("https://design.example/he/blog", 200, heHtml({ canonical: "https://design.example/he/blog", enAlt: "https://design.example/blog", robots: "noindex, follow" }));
  assert.equal(assertPair(enBlog, heBlogNoindex).checks.robots, true);

  const heBlogIndexable = parsePage("https://design.example/he/blog", 200, heHtml({ canonical: "https://design.example/he/blog", enAlt: "https://design.example/blog", robots: "index, follow" }));
  assert.equal(assertPair(enBlog, heBlogIndexable).checks.robots, false, "borrowed-content /he/blog must stay noindex (Phase 6)");

  const enFaq = parsePage("https://design.example/faq", 200, enHtml({ canonical: "https://design.example/faq", heAlt: "https://design.example/he/faq" }));
  const heFaqNoindex = parsePage("https://design.example/he/faq", 200, heHtml({ canonical: "https://design.example/he/faq", enAlt: "https://design.example/faq", robots: "noindex, follow" }));
  assert.equal(assertPair(enFaq, heFaqNoindex).checks.robots, false, "any page other than /he/blog* must stay indexable");
});

test("assertPair: a non-200 EN or HE fetch fails the pair without throwing, and skips the dependent checks", () => {
  const en = parsePage("https://design.example/gone", 200, enHtml({ canonical: "https://design.example/gone" }));
  const he404 = parsePage("https://design.example/he/gone", 404, "");
  const result = assertPair(en, he404);
  assert.equal(result.ok, false);
  assert.equal(result.checks.heOk, false);
  assert.equal(result.checks.xDefault, null, "dependent checks are inapplicable (null), not falsely failed, on a 404");
  assert.ok(result.issues.some((i) => i.includes("404")));
});

// --- assertUnlocalizedPair: the partners-shaped pair (decision J) ----------

test("assertUnlocalizedPair passes when the EN page has no he alternate at all and /he/partners 404s", () => {
  const en = parsePage(
    "https://design.example/partners",
    200,
    `<link rel="canonical" href="https://design.example/partners">
     <link rel="alternate" hreflang="en" href="https://design.example/partners">
     <link rel="alternate" hreflang="de" href="https://design.example/de/partners">
     <link rel="alternate" hreflang="x-default" href="https://design.example/partners">`,
  );
  const he = parsePage("https://design.example/he/partners", 404, "");
  const result = assertUnlocalizedPair(en, he);
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.checks, { enOk: true, heIs404: true, noHeAlternate: true });
});

test("assertUnlocalizedPair fails if the EN page still carries a he hreflang alternate (the Task 3 Critical bug, regressed)", () => {
  const en = parsePage(
    "https://design.example/partners",
    200,
    `<link rel="canonical" href="https://design.example/partners">
     <link rel="alternate" hreflang="en" href="https://design.example/partners">
     <link rel="alternate" hreflang="he" href="https://design.example/he/partners">
     <link rel="alternate" hreflang="x-default" href="https://design.example/partners">`,
  );
  const he = parsePage("https://design.example/he/partners", 404, "");
  const result = assertUnlocalizedPair(en, he);
  assert.equal(result.ok, false);
  assert.equal(result.checks.noHeAlternate, false);
  assert.ok(result.issues.some((i) => i.includes("must not carry")));
});

test("assertUnlocalizedPair fails if /he/partners doesn't 404 (e.g. it renders English-fallback content with 200)", () => {
  const en = parsePage(
    "https://design.example/partners",
    200,
    `<link rel="canonical" href="https://design.example/partners">
     <link rel="alternate" hreflang="en" href="https://design.example/partners">
     <link rel="alternate" hreflang="x-default" href="https://design.example/partners">`,
  );
  const he200 = parsePage("https://design.example/he/partners", 200, `<link rel="canonical" href="https://design.example/he/partners">`);
  const result = assertUnlocalizedPair(en, he200);
  assert.equal(result.ok, false);
  assert.equal(result.checks.heIs404, false);
  assert.ok(result.issues.some((i) => i.includes("should 404")));
});

test("assertUnlocalizedPair fails when the EN page itself is down, independent of the he-specific checks", () => {
  const enDown = parsePage("https://design.example/partners", 500, "");
  const he = parsePage("https://design.example/he/partners", 404, "");
  const result = assertUnlocalizedPair(enDown, he);
  assert.equal(result.ok, false);
  assert.equal(result.checks.enOk, false);
  // he/partners is still correctly 404 — that check is independent and still true.
  assert.equal(result.checks.heIs404, true);
});

// --- 2026-09-20 staging run: three sampler assumptions that did not survive
// contact with a real host, each pinned here ---------------------------------

test("buildUrlPairs: the 17 landing rows are heOnly and rtl-matrix's own landing row is dropped (those pages exist only in Hebrew)", () => {
  const pairs = buildUrlPairs();
  assert.ok(!pairs.some((p) => p.type === "landing"), "rtl-matrix's generic landing row would demand an EN twin that does not exist");
  const landingRows = pairs.filter((p) => p.type.startsWith("landing:"));
  assert.equal(landingRows.length, 17);
  for (const p of landingRows) assert.equal(p.heOnly, true, `${p.type} must carry the heOnly contract`);
});

test("appNoindex: a host-wide X-Robots-Tag (present on the EN twin too) is not the page's decision; a meta tag or a he-only header is", () => {
  const hostWide = (url) => parsePage(url, 200, "<html></html>", "noindex, nofollow");
  assert.equal(appNoindex(hostWide("https://s/he/faq"), hostWide("https://s/faq")), false);
  assert.equal(appNoindex(hostWide("https://s/he/faq"), parsePage("https://s/faq", 200, "<html></html>", null)), true, "header only on the HE side is app-level");
  assert.equal(appNoindex(parsePage("https://s/he/faq", 200, '<html><head><meta name="robots" content="noindex"></head></html>', null), hostWide("https://s/faq")), true, "a meta tag always counts");
  assert.equal(appNoindex(hostWide("https://s/he/x"), null), false, "no reference page: a header alone reads as host-wide");
});

test("assertPair: a staging-style host-wide noindex header on both pages still passes the robots check", () => {
  const en = parsePage("https://design.example/paphos", 200, enHtml().replace(/<meta name="robots"[^>]*>/, ""), "noindex, nofollow");
  const he = parsePage("https://design.example/he/paphos", 200, heHtml().replace(/<meta name="robots"[^>]*>/, ""), "noindex, nofollow");
  const result = assertPair(en, he);
  assert.equal(result.checks.robots, true, result.issues.join("; "));
  assert.equal(result.ok, true, result.issues.join("; "));
});

test("assertPair: a /he/blog page must be noindex by META — a host-wide header does not satisfy the Phase 6 rule", () => {
  const en = parsePage("https://design.example/blog", 200, enHtml({ canonical: "https://design.example/blog", heAlt: "https://design.example/he/blog" }).replace(/<meta name="robots"[^>]*>/, ""), "noindex, nofollow");
  const he = parsePage("https://design.example/he/blog", 200, heHtml({ canonical: "https://design.example/he/blog", enAlt: "https://design.example/blog" }).replace(/<meta name="robots"[^>]*>/, ""), "noindex, nofollow");
  const result = assertPair(en, he);
  assert.equal(result.checks.robots, false);
});

function heOnlyHtml({ url = "https://design.example/he/limassol", robots = "index, follow" } = {}) {
  return `<html dir="rtl"><head>
    <link rel="canonical" href="${url}">
    <link rel="alternate" hreflang="he" href="${url}">
    <link rel="alternate" hreflang="x-default" href="${url}">
    <meta property="og:locale" content="he_IL">
    <meta name="robots" content="${robots}">
    <script type="application/ld+json">{"@type":"WebPage","inLanguage":"he-IL"}</script>
  </head></html>`;
}

test("assertHeOnlyPage: EN 404 + a self-only HE hreflang set passes; the app's production-pinned origin is fine on a staging host", () => {
  const en = parsePage("https://design.example/limassol", 404, "<html></html>", "noindex, nofollow");
  const he = parsePage("https://design.example/he/limassol", 200, heOnlyHtml({ url: "https://cyprusvipestates.com/he/limassol" }), "noindex, nofollow");
  const result = assertHeOnlyPage(en, he);
  assert.deepEqual(result.issues, []);
  assert.equal(result.ok, true);
  assert.equal(result.originLabel, "production");
});

test("assertHeOnlyPage: an EN twin that now answers 200, an 'en' alternate, an off-self x-default or a noindex meta each fail", () => {
  const he = parsePage("https://design.example/he/limassol", 200, heOnlyHtml(), null);
  const enLive = parsePage("https://design.example/limassol", 200, enHtml(), null);
  assert.equal(assertHeOnlyPage(enLive, he).checks.enIs404, false);

  const en404 = parsePage("https://design.example/limassol", 404, "", null);
  const withEn = parsePage("https://design.example/he/limassol", 200, heOnlyHtml().replace('hreflang="x-default"', 'hreflang="en"'), null);
  assert.equal(assertHeOnlyPage(en404, withEn).checks.selfOnlyAlternates, false);

  const offSelf = parsePage("https://design.example/he/limassol", 200, heOnlyHtml().replace('hreflang="x-default" href="https://design.example/he/limassol"', 'hreflang="x-default" href="https://design.example/limassol"'), null);
  assert.equal(assertHeOnlyPage(en404, offSelf).checks.selfOnlyAlternates, false);

  const noindexMeta = parsePage("https://design.example/he/limassol", 200, heOnlyHtml({ robots: "noindex" }), null);
  assert.equal(assertHeOnlyPage(en404, noindexMeta).checks.robots, false);
});

test("assertPair: a HE page that is noindex by META passes when its EN twin carries the same meta (parity — e.g. NEW_PROJECTS_INDEXABLE unset on staging), fails when only the HE side has it", () => {
  const en = parsePage("https://design.example/paphos", 200, enHtml({ robots: "noindex, nofollow" }), null);
  const he = parsePage("https://design.example/he/paphos", 200, heHtml({ robots: "noindex, nofollow" }), null);
  assert.equal(assertPair(en, he).checks.robots, true, "parity with EN is not a localization defect");

  const enIndexable = parsePage("https://design.example/paphos", 200, enHtml(), null);
  assert.equal(assertPair(enIndexable, he).checks.robots, false, "HE must not be less indexable than its EN twin");
});
