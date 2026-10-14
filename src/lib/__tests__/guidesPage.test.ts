import { test } from "node:test";
import assert from "node:assert/strict";
import { GUIDES_PAGE_SLUG, guidesPageAlternates, guidesPageLang, guidesPagePath, guidesPageTranslations } from "../guidesPage";
import { GUIDE_LANGS } from "../guides/types";
import { languageAlternates } from "../seo";

test("paths: one translated slug per guide language, English unprefixed", () => {
  assert.equal(guidesPagePath("en"), "/guides");
  assert.equal(guidesPagePath("de"), "/de/ratgeber");
  assert.equal(guidesPagePath("pl"), "/pl/poradniki");
  assert.equal(guidesPagePath("ru"), "/ru/gajdy");
  assert.equal(guidesPagePath("he"), "/guides"); // no Hebrew version: the English page
  assert.equal(guidesPagePath("xx"), "/guides");
  assert.equal(new Set(Object.values(GUIDES_PAGE_SLUG)).size, GUIDE_LANGS.length, "slugs are unique");
});

test("middleware rewrite: only the exact translated URL of each language matches", () => {
  for (const l of GUIDE_LANGS) {
    assert.equal(guidesPageLang(guidesPagePath(l)), l);
    assert.equal(guidesPageLang(guidesPagePath(l) + "/"), l, "trailing slash");
  }
  for (const no of ["/", "/de", "/guides/x", "/de/guides", "/ratgeber", "/de/gajdy", "/ru/ratgeber", "/he/guides", "/he/ratgeber", "/blog/guides", "/de/blog/ratgeber", "/en/guides", "/guide", "/de/ratgeber/x"]) {
    assert.equal(guidesPageLang(no), null, no);
  }
});

test("seo: canonical and hreflang use each language's own slug, x-default is English", () => {
  const { canonical, languages } = languageAlternates({
    lang: "de",
    slug: GUIDES_PAGE_SLUG.de,
    pathFor: (lg, slug) => (lg === "en" ? `/${slug}` : `/${lg}/${slug}`),
    translations: guidesPageTranslations(),
  });
  assert.equal(canonical, "https://cyprusvipestates.com/de/ratgeber");
  assert.equal(languages.en, "https://cyprusvipestates.com/guides");
  assert.equal(languages.pl, "https://cyprusvipestates.com/pl/poradniki");
  assert.equal(languages.ru, "https://cyprusvipestates.com/ru/gajdy");
  assert.equal(languages.he, undefined);
});

test("sitemap alternates: four languages plus x-default, no Hebrew", () => {
  const alts = guidesPageAlternates((p) => `https://cyprusvipestates.com${p}`);
  assert.deepEqual(
    alts.map((a) => a.hreflang),
    [...GUIDE_LANGS, "x-default"],
  );
  assert.equal(alts.find((a) => a.hreflang === "x-default")!.href, "https://cyprusvipestates.com/guides");
  assert.equal(alts.find((a) => a.hreflang === "ru")!.href, "https://cyprusvipestates.com/ru/gajdy");
});
