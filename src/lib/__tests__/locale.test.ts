import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOCALES, DEFAULT_LOCALE, RTL_LOCALES, LAUNCH_GATED_LOCALES, BCP47, LOCALE_LABELS,
  parsePublicLocales, isLocale, localeDir, nonDefaultLocalePattern, localizedHref, fmtPrice, fmtDate, ltrIsolate,
} from "@/lib/locale";
import { templateClassOf } from "@/lib/seo/templateClass";
import { isDarkHeroPath } from "@/app/components/Header/navShared";

test("he is a known locale, en stays default and prefix-less", () => {
  assert.deepEqual([...LOCALES], ["en", "de", "pl", "ru", "he"]);
  assert.equal(DEFAULT_LOCALE, "en");
  assert.ok(isLocale("he"));
  assert.ok(!isLocale("xx"));
  assert.equal(localizedHref("he", "projects"), "/he/projects");
  assert.equal(localizedHref("en", "projects"), "/projects");
});

test("parsePublicLocales: unset → everything except launch-gated; set → exactly the listed known locales", () => {
  assert.deepEqual(parsePublicLocales(undefined), ["en", "de", "pl", "ru"]);
  assert.deepEqual([...LAUNCH_GATED_LOCALES], ["he"]);
  assert.deepEqual(parsePublicLocales("en,de,pl,ru,he"), ["en", "de", "pl", "ru", "he"]);
  assert.deepEqual(parsePublicLocales(" en , he "), ["en", "he"]);
  assert.deepEqual(parsePublicLocales("xx,de"), ["en", "de"]);
  assert.deepEqual(parsePublicLocales("de,pl,ru"), ["en", "de", "pl", "ru"]);
  // the default locale can never be gated away
  assert.deepEqual(parsePublicLocales("de"), ["en", "de"]);
});

test("direction, BCP-47 and labels are exhaustive", () => {
  assert.deepEqual([...RTL_LOCALES], ["he"]);
  assert.equal(localeDir("he"), "rtl");
  assert.equal(localeDir("de"), "ltr");
  assert.equal(localeDir("junk"), "ltr");
  for (const l of LOCALES) {
    assert.ok(BCP47[l], `BCP47 missing for ${l}`);
    assert.ok(LOCALE_LABELS[l]?.code && LOCALE_LABELS[l]?.name, `label missing for ${l}`);
  }
  assert.equal(BCP47.he, "he-IL");
  assert.equal(LOCALE_LABELS.he.name, "עברית");
});

test("nonDefaultLocalePattern builds an alternation without the default locale", () => {
  assert.equal(nonDefaultLocalePattern(), "de|pl|ru|he");
  assert.equal(nonDefaultLocalePattern(["en", "de", "he"]), "de|he");
  const re = new RegExp(`^/(?:(${nonDefaultLocalePattern()})/)?faq$`);
  assert.equal(re.exec("/he/faq")?.[1], "he");
  assert.equal(re.exec("/faq")?.[1], undefined);
  assert.equal(re.exec("/xx/faq"), null);
});

test("fmtPrice and fmtDate", () => {
  assert.equal(fmtPrice(450000, "he"), "€450,000");
  assert.equal(fmtPrice(450000, "de"), "€450,000");
  assert.match(fmtDate("2026-05-01", "he", { year: "numeric", month: "long" }), /2026/);
  assert.equal(fmtDate("2026-05-01", "en", { year: "numeric", month: "long" }), "May 2026");
});

test("ltrIsolate wraps a string in LRI…PDI so it renders LTR inside RTL prose", () => {
  assert.equal(ltrIsolate("+357 25 123456"), "⁦+357 25 123456⁩");
  assert.equal(ltrIsolate("€450,000"), "⁦€450,000⁩");
  assert.equal(ltrIsolate(""), "⁦⁩");
});

test("he paths classify like the other prefixed locales", () => {
  assert.equal(templateClassOf("/he"), "homepage");
  assert.equal(templateClassOf("/he/projects"), "projects-listing");
  assert.equal(templateClassOf("/he/blog/x"), "blog-post");
  assert.ok(isDarkHeroPath("/he"));
  assert.ok(isDarkHeroPath("/he/projects"));
  assert.ok(!isDarkHeroPath("/he/blog"));
});
