import { test } from "node:test";
import assert from "node:assert/strict";
import { looksLikeContentPath, resolveMissing, type MissingEnv, type MissingRepo, type SlugRow } from "../missingPageResolve";

const row = (language: string, slug: string, g: string | null = null): SlugRow => ({ language, slug, translationGroupId: g });
const PUBLIC = new Set(["en", "de", "pl", "ru", "he"]);
const env: MissingEnv = {
  isPublicLocale: (l) => PUBLIC.has(l),
  href: (lang, segs) => `${lang === "en" ? "" : "/" + lang}/${segs.join("/")}`.replace(/\/$/, "") || "/",
};
function repo(blog: SlugRow[], page: SlugRow[]): MissingRepo {
  return {
    blogsBySlug: async (s) => blog.filter((r) => r.slug === s),
    blogSibling: async (g, l) => blog.find((r) => r.translationGroupId === g && r.language === l) ?? null,
    pagesBySlug: async (s) => page.filter((r) => r.slug === s),
    pagesEndingWith: async (l, last) => page.filter((r) => r.language === l && r.slug.endsWith("/" + last)),
    pageSibling: async (g, l) => page.find((r) => r.translationGroupId === g && r.language === l) ?? null,
    pageExists: async (l, s) => page.some((r) => r.language === l && r.slug === s),
  };
}
const BLOG = [
  row("de", "steuern-auf-immobilien-in-zypern", "g1"),
  row("pl", "podatki-od-nieruchomosci-na-cyprze", "g1"),
  row("en", "taxes-on-real-estate-in-cyprus", "g1"),
  row("de", "ratgeber-fuer-deutsche-rentner", null), // single-language article
  row("ru", "kak-poluchit-pmzh", "g2"),
  row("en", "how-to-get-pr", "g2"),
];
const PAGE = [
  row("pl", "wille-na-cyprze", "p1"),
  row("en", "villas-in-cyprus", "p1"),
  row("pl", "sprzedaz-domow-na-cyprze", "p2"),
  row("pl", "sprzedaz-domow-na-cyprze/domy-z-basenem-na-cyprze", "p3"),
  row("de", "haeuser-auf-zypern", null),
];
const run = (kind: any, lang: string, segs: string[]) => resolveMissing(repo(BLOG, PAGE), env, { kind, lang, segments: segs });

test("blog: right slug under the wrong prefix goes to the sibling in the requested language", async () => {
  assert.equal(await run("blog", "pl", ["steuern-auf-immobilien-in-zypern"]), "/pl/blog/podatki-od-nieruchomosci-na-cyprze");
  assert.equal(await run("blog", "en", ["steuern-auf-immobilien-in-zypern"]), "/blog/taxes-on-real-estate-in-cyprus");
});

test("blog: no sibling in the requested language -> the article in its own language", async () => {
  assert.equal(await run("blog", "he", ["steuern-auf-immobilien-in-zypern"]), "/blog/taxes-on-real-estate-in-cyprus"); // prefers en
  assert.equal(await run("blog", "pl", ["ratgeber-fuer-deutsche-rentner"]), "/de/blog/ratgeber-fuer-deutsche-rentner");
  assert.equal(await run("blog", "en", ["kak-poluchit-pmzh"]), "/blog/how-to-get-pr");
});

test("blog: unknown slug -> the blog index of the requested locale", async () => {
  assert.equal(await run("blog", "de", ["nonexistent-article"]), "/de/blog");
  assert.equal(await run("blog", "en", ["nonexistent-article"]), "/blog");
});

test("page: sibling, own-language page, nested child, parent fallback, homepage", async () => {
  assert.equal(await run("page", "en", ["wille-na-cyprze"]), "/villas-in-cyprus");
  assert.equal(await run("page", "de", ["wille-na-cyprze"]), "/villas-in-cyprus"); // no de sibling -> english sibling
  assert.equal(await run("page", "ru", ["sprzedaz-domow-na-cyprze"]), "/pl/sprzedaz-domow-na-cyprze"); // no group -> own language
  assert.equal(await run("page", "pl", ["domy-z-basenem-na-cyprze"]), "/pl/sprzedaz-domow-na-cyprze/domy-z-basenem-na-cyprze"); // child without parent
  assert.equal(await run("page", "pl", ["sprzedaz-domow-na-cyprze", "nie-ma-takiej"]), "/pl/sprzedaz-domow-na-cyprze"); // nearest parent
  assert.equal(await run("page", "ru", ["nothing-here"]), "/ru");
  assert.equal(await run("page", "en", ["nothing-here"]), "/");
});

test("sections: project / developer / case study -> their index in the requested locale", async () => {
  assert.equal(await run("project", "pl", ["marea-residences"]), "/pl/projects");
  assert.equal(await run("project", "en", ["marea-residences"]), "/projects");
  assert.equal(await run("developer", "de", ["x"]), "/de/developers");
  assert.equal(await run("caseStudy", "ru", ["x"]), "/ru/case-studies");
});

test("never redirects a URL to itself (loop guard)", async () => {
  // slug exists in the requested language but the page still 404s (e.g. a draft-only child): fall through, not loop
  assert.notEqual(await run("blog", "de", ["steuern-auf-immobilien-in-zypern"]), "/de/blog/steuern-auf-immobilien-in-zypern");
  assert.equal(await run("blog", "de", ["blog"]), "/de/blog"); // index of the same section, different path than the page
});

test("scanner junk keeps its 404 (null), real content-like paths do not", async () => {
  for (const segs of [["wp-admin"], ["xmlrpc"], ["index.php"], [".env"], ["a", "b", "c", "d", "e"], ["wp-login"], [""]]) {
    assert.equal(await run("page", "en", segs), null, JSON.stringify(segs));
  }
  assert.equal(looksLikeContentPath(["nowe-inwestycje-pafos"]), true);
  assert.equal(looksLikeContentPath(["wille-na-cyprze", "wille-w-pafos"]), true);
  assert.equal(looksLikeContentPath(["Новостройки-кипра"]), true);
});

test("a single-slash absolute link to our own host is mapped to the page the author meant", async () => {
  assert.equal(await run("page", "ru", ["https:", "cyprusvipestates.com", "en", "case-studies"]), "/case-studies");
  assert.equal(await run("page", "de", ["https:", "www.cyprusvipestates.com", "de", "blog"]), "/de/blog");
  assert.equal(await run("page", "pl", ["https:", "cyprusvipestates.com"]), "/pl");
  assert.equal(await run("page", "ru", ["https:", "evil.example", "en", "x"]), null); // other host: not ours
});

test("never ends on a page that itself redirects: merged/retired targets are followed to the end", async () => {
  const merged: Record<string, string> = {
    "/pl/sprzedaz-domow-na-cyprze": "/pl/domy-premium", // retired landing page, row still PUBLISHED
    "/pl/domy-premium": "/pl/domy-flagowe",             // merged twice
  };
  const chainEnv: MissingEnv = { ...env, redirected: (p) => merged[p] ?? null };
  const r = (kind: any, lang: string, segs: string[]) => resolveMissing(repo(BLOG, PAGE), chainEnv, { kind, lang, segments: segs });
  assert.equal(await r("page", "ru", ["sprzedaz-domow-na-cyprze"]), "/pl/domy-flagowe"); // own-language page, then both hops
  assert.equal(await r("page", "en", ["wille-na-cyprze"]), "/villas-in-cyprus"); // sibling is not retired: untouched
  // a redirect map that points back at the requested URL must not loop
  const loopEnv: MissingEnv = { ...env, redirected: (p) => (p === "/de/blog/steuern-auf-immobilien-in-zypern" ? "/pl/blog/steuern-auf-immobilien-in-zypern" : null) };
  const out = await resolveMissing(repo(BLOG, PAGE), loopEnv, { kind: "blog", lang: "pl", segments: ["steuern-auf-immobilien-in-zypern"] });
  assert.notEqual(out, "/pl/blog/steuern-auf-immobilien-in-zypern");
});
