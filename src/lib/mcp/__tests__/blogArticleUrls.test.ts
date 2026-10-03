import { test } from "node:test";
import assert from "node:assert/strict";
import { groupArticles, listEntry, localeUrls, type ArticleRow } from "@/lib/blog/articleUrls";

const d = new Date("2026-09-01T00:00:00Z");
const row = (o: Partial<ArticleRow> & { id: string; language: string; slug: string }): ArticleRow => ({
  title: `Title ${o.language}`, status: "PUBLISHED", seo: { metaDescription: `Desc ${o.language}` }, publishedAt: d, updatedAt: d, translationGroupId: "g1", category: { slug: "guides", title: "Guides" }, ...o,
});

test("URLs come from the language switcher's helper: en without prefix, others prefixed, per-locale slugs", () => {
  const [g] = groupArticles([row({ id: "1", language: "en", slug: "apartment-or-villa" }), row({ id: "2", language: "de", slug: "wohnung-oder-villa" }), row({ id: "3", language: "ru", slug: "kvartira-ili-villa" })]);
  assert.deepEqual(localeUrls(g), {
    en: "https://cyprusvipestates.com/blog/apartment-or-villa",
    de: "https://cyprusvipestates.com/de/blog/wohnung-oder-villa",
    pl: null,
    ru: "https://cyprusvipestates.com/ru/blog/kvartira-ili-villa",
  });
});

test("a missing translation is the string \"missing\", never an empty entry; an empty title becomes null", () => {
  const [g] = groupArticles([row({ id: "1", language: "en", slug: "a" }), row({ id: "2", language: "pl", slug: "a-pl", title: "  " })]);
  const e = listEntry(g);
  assert.equal(e.locales.de, "missing");
  assert.equal(e.locales.ru, "missing");
  assert.equal(typeof e.locales.en === "object" && e.locales.en.title, "Title en");
  assert.equal(typeof e.locales.pl === "object" && e.locales.pl.title, null);
  assert.equal(e.slug, "a");
  assert.equal(e.category, "guides");
});

test("unpublished and gated-locale rows never form or join an article; a row without a group is its own article", () => {
  const groups = groupArticles([
    row({ id: "1", language: "en", slug: "a" }),
    row({ id: "2", language: "de", slug: "a-de", status: "DRAFT" }),
    row({ id: "3", language: "he", slug: "a-he" }),
    row({ id: "4", language: "en", slug: "solo", translationGroupId: null }),
  ]);
  assert.equal(groups.length, 2);
  const a = listEntry(groups.find((g) => g.key === "g1")!);
  assert.equal(a.locales.de, "missing");
  assert.equal(listEntry(groups.find((g) => g.key.startsWith("solo:"))!).slug, "solo");
});

test("publishedAt is the earliest and updatedAt the latest across translations", () => {
  const [g] = groupArticles([row({ id: "1", language: "en", slug: "a", publishedAt: new Date("2026-08-01T00:00:00Z"), updatedAt: new Date("2026-08-02T00:00:00Z") }), row({ id: "2", language: "de", slug: "b", publishedAt: new Date("2026-07-01T00:00:00Z"), updatedAt: new Date("2026-09-05T00:00:00Z") })]);
  const e = listEntry(g);
  assert.equal(e.publishedAt?.toISOString(), "2026-07-01T00:00:00.000Z");
  assert.equal(e.updatedAt.toISOString(), "2026-09-05T00:00:00.000Z");
});
