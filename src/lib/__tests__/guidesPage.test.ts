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

import fs from "node:fs";
import path from "node:path";
import { CORPORATE_SLUGS } from "../corporatePageSlugs";
import nestedPageRedirects from "../nestedPageRedirects.json";

const ROOT = path.resolve(__dirname, "../../..");

test("wiring: middleware rewrites the guides page and its tree is excluded from the matcher", () => {
  const mw = fs.readFileSync(path.join(ROOT, "src/middleware.ts"), "utf8");
  assert.match(mw, /guidesPageLang\(request\.nextUrl\.pathname\)/, "the rewrite block is missing");
  assert.match(mw, /url\.pathname = `\/preview-guides\/\$\{guidesLang\}`/, "the rewrite target changed");
  const matcher = mw.slice(mw.indexOf("matcher:"));
  assert.ok(matcher.includes("preview-guides"), "preview-guides must be excluded from the middleware matcher (else the rewrite target is rewritten again)");
  // the rewrite must come before the singlepage catch-all logic, so no page with this slug can shadow it
  assert.ok(mw.indexOf("guidesPageLang(request") < mw.indexOf("Singlepage canonicalisation"), "guides rewrite must run before the singlepage canonicalisation");
});

test("slugs: none collides with a corporate page, a reserved section or a nested-page redirect", () => {
  const taken = new Set<string>();
  for (const bySlug of Object.values(CORPORATE_SLUGS)) for (const s of Object.values(bySlug)) taken.add(s);
  for (const r of ["projects", "blog", "developers", "case-studies", "files", "partners", "faq"]) taken.add(r);
  for (const perLang of Object.values(nestedPageRedirects as Record<string, Record<string, string>>)) for (const [leaf, canonical] of Object.entries(perLang)) { taken.add(leaf); taken.add(canonical.split("/")[0]); }
  for (const [lang, slug] of Object.entries(GUIDES_PAGE_SLUG)) assert.equal(taken.has(slug), false, `${lang}: "${slug}" is already used`);
});

import { GUIDE_FACTS } from "../../app/preview-guides/facts";
import { GUIDE_IDS, getGuideContent } from "../guides/registry";

const numbersIn = (text: string): string[] => Array.from(new Set((text.match(/\d[\d.,\u00a0\u202f ]*\d|\d/g) ?? []).map((n) => n.replace(/\D/g, ""))));

test("card facts: every figure is in the guide of the same language, and all languages say the same numbers", () => {
  for (const id of GUIDE_IDS) {
    const reference = numbersIn(Object.values(GUIDE_FACTS[id].en).join(" ")).sort().join(",");
    for (const lang of Object.keys(GUIDE_FACTS[id]) as (keyof (typeof GUIDE_FACTS)[typeof id])[]) {
      const f = GUIDE_FACTS[id][lang];
      const mine = numbersIn(`${f.before} ${f.bold} ${f.after}`);
      assert.equal(mine.slice().sort().join(","), reference, `${id}/${lang}: figures differ from the English card`);
      const inGuide = numbersIn(JSON.stringify(getGuideContent(id, lang)));
      for (const n of mine) assert.ok(inGuide.includes(n), `${id}/${lang}: ${n} is not in the guide`);
    }
  }
});

test("guide popup css: the download link beats the gold link colour, and only the form column scrolls", () => {
  const css = fs.readFileSync(path.join(ROOT, "src/app/components/GuideCta/guideCta.css"), "utf8");
  // ".cvpm__form a" (contactModal.css) colours links gold; on a gold button that made the label invisible.
  const rule = css.match(/\.cvpm\.cvpm--guide \.cvpm__form a\.cvpm__download \{[^}]*\}/)?.[0] ?? "";
  assert.match(rule, /color: #10201b/, "download button text colour");
  assert.match(css, /\.cvpm\.cvpm--guide \{[^}]*overflow: hidden[^}]*grid-template-rows: minmax\(0, 1fr\)/, "popup clips, the row is clamped so the panel scrolls");
});
