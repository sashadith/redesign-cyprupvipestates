import { test } from "node:test";
import assert from "node:assert/strict";
import { blogIndexMode, blogIndexInSitemap } from "@/lib/blogIndexMode";

test("blogIndexMode: he below 5 own articles borrows EN and is noindex", () => {
  assert.deepEqual(blogIndexMode("he", 0), { sourceLang: "en", noindex: true });
  assert.deepEqual(blogIndexMode("he", 4), { sourceLang: "en", noindex: true });
});

test("blogIndexMode: he at/above 5 own articles serves its own locale, indexable", () => {
  assert.deepEqual(blogIndexMode("he", 5), { sourceLang: "he", noindex: false });
  assert.deepEqual(blogIndexMode("he", 12), { sourceLang: "he", noindex: false });
});

test("blogIndexMode: non-he locales are always their own source and always indexable, heCount is ignored", () => {
  assert.deepEqual(blogIndexMode("en", 0), { sourceLang: "en", noindex: false });
  assert.deepEqual(blogIndexMode("de", 0), { sourceLang: "de", noindex: false });
  assert.deepEqual(blogIndexMode("de", 100), { sourceLang: "de", noindex: false });
});

test("blogIndexInSitemap mirrors the noindex flag", () => {
  assert.equal(blogIndexInSitemap("he", 0), false);
  assert.equal(blogIndexInSitemap("he", 4), false);
  assert.equal(blogIndexInSitemap("he", 5), true);
  assert.equal(blogIndexInSitemap("en", 0), true);
});
