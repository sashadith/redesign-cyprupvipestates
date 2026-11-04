import { test } from "node:test";
import assert from "node:assert/strict";
import { siblingAlternatePath } from "../pageAlternates";

const EN_PATHS = [["villas-in-cyprus"], ["villas-in-cyprus", "family-villas"], ["beachfront-villas-cyprus"], ["faq"]];
const PL_PATHS = [["wille-na-cyprze"], ["wille-rodzinne-cypr"], ["wille-przy-plazy-cypr"]];

test("a nested sibling gets its full path, not the flat leaf", () => {
  assert.deepEqual(siblingAlternatePath(EN_PATHS, "family-villas"), ["villas-in-cyprus", "family-villas"]);
  assert.deepEqual(siblingAlternatePath(EN_PATHS, "faq"), ["faq"]);
});

test("a sibling merged into another page yields no alternate", () => {
  const merged = { "wille-przy-plazy-cypr": "/pl/wille-na-cyprze" };
  assert.equal(siblingAlternatePath(PL_PATHS, "wille-przy-plazy-cypr", merged), null);
  assert.deepEqual(siblingAlternatePath(PL_PATHS, "wille-na-cyprze", merged), ["wille-na-cyprze"]);
});

test("a merge key never hides a NESTED page that happens to share the leaf", () => {
  // the middleware only merges the exact flat path, so a child with that leaf keeps resolving
  const merged = { "domy-w-limassol": "/pl/domy-na-cyprze" };
  const paths = [["sprzedaz-domow-na-cyprze", "domy-w-limassol"]];
  assert.deepEqual(siblingAlternatePath(paths, "domy-w-limassol", merged), ["sprzedaz-domow-na-cyprze", "domy-w-limassol"]);
});

test("an unknown leaf yields no alternate", () => {
  assert.equal(siblingAlternatePath(PL_PATHS, "nie-ma-takiej"), null);
  assert.equal(siblingAlternatePath([], "faq"), null);
});
