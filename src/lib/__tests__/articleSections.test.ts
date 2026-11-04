import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  ALL_GUIDES_SLUGS,
  GUIDE_CATEGORY_GROUPS,
  articleHref,
  articleSection,
  guidesSectionSlug,
  hasGuidesSection,
  sectionIndexHref,
  sectionSegments,
  sectionWhere,
} from "@/lib/articleSections";
import { GUIDES_PAGE_SLUG } from "@/lib/guidesPage";
import { languageAlternates, pathBuilders } from "@/lib/seo";
import { groupArticles, localeUrls, type ArticleRow } from "@/lib/blog/articleUrls";

const LIFE = "c5d12d7a-e55a-4b8a-b888-c5bcca2061a2"; // "life" guide category
const TRENDS = "625ee4d3-a718-40d7-b1a9-3814b059b5bf"; // investment-and-market-trends: an ordinary blog category

test("the guides slug of each language is the one the free-guides page already uses", () => {
  assert.equal(guidesSectionSlug("en"), "guides");
  assert.equal(guidesSectionSlug("de"), "ratgeber");
  assert.equal(guidesSectionSlug("pl"), "poradniki");
  assert.equal(guidesSectionSlug("ru"), "gajdy");
  assert.deepEqual([...ALL_GUIDES_SLUGS].sort(), Object.values(GUIDES_PAGE_SLUG).sort());
});

test("the guide categories are four, each in all four languages with distinct slugs and ids", () => {
  const cats = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/lib/guideCategories.json"), "utf8"));
  assert.equal(cats.length, 4);
  assert.deepEqual(cats.map((c: any) => c.group), [...GUIDE_CATEGORY_GROUPS]);
  assert.equal(new Set(cats.map((c: any) => c.group)).size, 4);
  for (const lang of ["en", "de", "pl", "ru"]) {
    const slugs = cats.map((c: any) => c[lang].slug);
    assert.equal(new Set(slugs).size, 4, lang);
    for (const c of cats) assert.ok(c[lang].title.length > 0 && c[lang].slug.length > 0);
  }
  // Every article the move script relocates names a real target.
  const moved = JSON.parse(fs.readFileSync(path.join(process.cwd(), "scripts/guides/moved-articles.json"), "utf8"));
  for (const m of moved) assert.ok(cats.some((c: any) => c.key === m.to), m.note);
  assert.equal(new Set(moved.map((m: any) => m.group)).size, moved.length);
});

test("a guide-category article is in the guides section, anything else in the blog", () => {
  assert.equal(articleSection("ru", LIFE), "guides");
  assert.equal(articleSection("ru", TRENDS), "blog");
  assert.equal(articleSection("ru", null), "blog");
  assert.equal(articleSection("ru", undefined), "blog");
  for (const g of GUIDE_CATEGORY_GROUPS) assert.equal(articleSection("de", g), "guides");
});

test("Hebrew has no guides section: its articles stay in the blog whatever the category", () => {
  assert.equal(hasGuidesSection("he"), false);
  assert.equal(articleSection("he", LIFE), "blog");
  assert.equal(articleHref("he", "x", LIFE), "/he/blog/x");
});

test("article hrefs: English has no prefix, the others do, each with its own guides slug", () => {
  assert.equal(articleHref("en", "x", LIFE), "/guides/x");
  assert.equal(articleHref("de", "x", LIFE), "/de/ratgeber/x");
  assert.equal(articleHref("pl", "x", LIFE), "/pl/poradniki/x");
  assert.equal(articleHref("ru", "x", LIFE), "/ru/gajdy/x");
  assert.equal(articleHref("ru", "x", TRENDS), "/ru/blog/x");
  assert.equal(articleHref("en", "y", TRENDS), "/blog/y");
});

test("sectionSegments and sectionIndexHref follow the section", () => {
  assert.deepEqual(sectionSegments("ru", "x", "guides"), ["gajdy", "x"]);
  assert.deepEqual(sectionSegments("ru", "x", "blog"), ["blog", "x"]);
  assert.deepEqual(sectionSegments("ru", "x", undefined), ["blog", "x"]);
  assert.deepEqual(sectionSegments("he", "x", "guides"), ["blog", "x"]);
  assert.equal(sectionIndexHref("de", "guides"), "/de/ratgeber");
  assert.equal(sectionIndexHref("en", "guides"), "/guides");
  assert.equal(sectionIndexHref("pl", "blog"), "/pl/blog");
  assert.equal(sectionIndexHref("he", "guides"), "/he/blog");
});

test("sectionWhere: guides filters by the guide categories, blog is the complement, he is never in guides", () => {
  const g: any = sectionWhere("ru", "guides");
  assert.deepEqual(g.category.is.translationGroupId.in, [...GUIDE_CATEGORY_GROUPS]);
  const b: any = sectionWhere("ru", "blog");
  assert.deepEqual(b.NOT, g);
  assert.deepEqual(sectionWhere("he", "blog"), {});
  assert.notDeepEqual(sectionWhere("he", "guides"), {});
});

test("pathBuilders.blog and languageAlternates follow each language's own section", () => {
  assert.equal(pathBuilders.blog("ru", "x", "guides"), "/ru/gajdy/x");
  assert.equal(pathBuilders.blog("ru", "x"), "/ru/blog/x");
  const { canonical, languages } = languageAlternates({
    lang: "ru",
    slug: "ru-slug",
    section: "guides",
    pathFor: pathBuilders.blog,
    translations: [
      { slug: { en: { current: "en-slug" } }, section: { en: "guides" } },
      { slug: { de: { current: "de-slug" } }, section: { de: "blog" } }, // a sibling in another category: its own URL
    ],
  });
  assert.equal(canonical, "https://cyprusvipestates.com/ru/gajdy/ru-slug");
  assert.equal(languages.en, "https://cyprusvipestates.com/guides/en-slug");
  assert.equal(languages.de, "https://cyprusvipestates.com/de/blog/de-slug");
  assert.equal(languages["x-default"], languages.en);
});

test("MCP article URLs point at the guides URL for a guide-category article", () => {
  const d = new Date("2026-09-01T00:00:00Z");
  const row = (language: string, slug: string, group: string): ArticleRow => ({
    id: language, language, slug, title: "t", status: "PUBLISHED", seo: null, publishedAt: d, updatedAt: d, translationGroupId: "g",
    category: { slug: "c", title: "C", translationGroupId: group },
  });
  const [g] = groupArticles([row("en", "a", LIFE), row("ru", "b", LIFE), row("de", "c", TRENDS)]);
  assert.deepEqual(localeUrls(g), {
    en: "https://cyprusvipestates.com/guides/a",
    de: "https://cyprusvipestates.com/de/blog/c",
    pl: null,
    ru: "https://cyprusvipestates.com/ru/gajdy/b",
  });
});
