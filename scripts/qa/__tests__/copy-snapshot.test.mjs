import { test } from "node:test";
import assert from "node:assert/strict";
import { collectLeaves } from "../copy-snapshot.mjs";

test("top-level locale table: walks obj[locale] and collects nested/array leaves by dotted path", () => {
  const TABLE = {
    en: { hero: { title: "Hello", cta: "Click" }, tags: ["a", "b"] },
    de: { hero: { title: "Hallo", cta: "Klicken" }, tags: ["c", "d"] },
  };
  assert.deepEqual(collectLeaves(TABLE, "en"), {
    "hero.title": "Hello",
    "hero.cta": "Click",
    "tags.0": "a",
    "tags.1": "b",
  });
  assert.deepEqual(collectLeaves(TABLE, "de"), {
    "hero.title": "Hallo",
    "hero.cta": "Klicken",
    "tags.0": "c",
    "tags.1": "d",
  });
});

test("nested-per-section locale table (e.g. SectionLinks' HEADINGS): locale branch found below a non-locale key", () => {
  const HEADINGS = {
    section: { en: "More in this section", de: "Mehr in diesem Bereich" },
    related: { en: "You may also like", de: "Das könnte Sie auch interessieren" },
  };
  assert.deepEqual(collectLeaves(HEADINGS, "en"), {
    section: "More in this section",
    related: "You may also like",
  });
});

test("function leaf returning a string is invoked with the fixed sample args", () => {
  const FN_TABLE = {
    en: (name, url) => `Hello ${name}: ${url}`,
    de: (name, url) => `Hallo ${name}: ${url}`,
  };
  assert.deepEqual(collectLeaves(FN_TABLE, "en"), { "(root)": "Hello Sample: https://x" });
});

test("function leaf returning an object recurses into its fields (e.g. {subject, body} email templates)", () => {
  const EMAIL_TABLE = {
    en: (name, url) => ({ subject: `Subj ${name}`, body: `Body ${url}` }),
    de: (name, url) => ({ subject: `Betreff ${name}`, body: `Inhalt ${url}` }),
  };
  assert.deepEqual(collectLeaves(EMAIL_TABLE, "en"), {
    subject: "Subj Sample",
    body: "Body https://x",
  });
});

test("a locale missing from the table (e.g. he before a WP adds it) falls back to en", () => {
  const NO_HE = { en: { greeting: "Hi" }, de: { greeting: "Hallo" } };
  assert.deepEqual(collectLeaves(NO_HE, "he"), { greeting: "Hi" });
});

test("a present he key is used as-is, not the en fallback", () => {
  const WITH_HE = { en: { greeting: "Hi" }, he: { greeting: "שלום" } };
  assert.deepEqual(collectLeaves(WITH_HE, "he"), { greeting: "שלום" });
});

test("plain (non-locale-keyed) nesting is walked with dotted paths, unrelated to any locale table", () => {
  const PLAIN = { a: { b: { c: "leaf" } } };
  assert.deepEqual(collectLeaves(PLAIN, "en"), { "a.b.c": "leaf" });
});
