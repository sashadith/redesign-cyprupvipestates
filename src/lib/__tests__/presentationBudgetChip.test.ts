// Final-review C1 — /c/[token] used to build the two-sided budget range
// eagerly, so a one-sided budget ("Over €2,000,000", "Up to €200,000") called
// `fmt(null)` and 500'd the page in EVERY locale. These tests cover all four
// budget shapes across the LTR locales and `he`.
//
// Pure function only — no DB, no Next, no transport.
import { test } from "node:test";
import assert from "node:assert/strict";
import { budgetChip } from "@/app/c/[token]/budgetChip";
import { COPY, P_LOCALES } from "@/app/c/[token]/copy";

test("both bounds render the range, unchanged for LTR and dash-free for he", () => {
  assert.equal(budgetChip("en", 300000, 500000, COPY.en), "€300,000 – €500,000");
  assert.equal(budgetChip("de", 300000, 500000, COPY.de), "€300,000 – €500,000");
  assert.equal(budgetChip("pl", 300000, 500000, COPY.pl), "€300,000 – €500,000");
  assert.equal(budgetChip("ru", 300000, 500000, COPY.ru), "€300,000 – €500,000");
  const he = budgetChip("he", 300000, 500000, COPY.he);
  assert.equal(he, "⁦€300,000-€500,000⁩");
  assert.doesNotMatch(he as string, /[—–]/);
});

test("min-only uses budgetFrom and never touches the missing bound", () => {
  assert.equal(budgetChip("en", 2000000, null, COPY.en), "from €2,000,000");
  assert.equal(budgetChip("de", 2000000, null, COPY.de), "ab €2,000,000");
  assert.equal(budgetChip("pl", 2000000, null, COPY.pl), "od €2,000,000");
  assert.equal(budgetChip("ru", 2000000, null, COPY.ru), "от €2,000,000");
  assert.equal(budgetChip("he", 2000000, null, COPY.he), "מעל €2,000,000");
});

test("max-only uses budgetUpTo and never touches the missing bound", () => {
  assert.equal(budgetChip("en", null, 200000, COPY.en), "up to €200,000");
  assert.equal(budgetChip("de", null, 200000, COPY.de), "bis €200,000");
  assert.equal(budgetChip("pl", null, 200000, COPY.pl), "do €200,000");
  assert.equal(budgetChip("ru", null, 200000, COPY.ru), "до €200,000");
  assert.equal(budgetChip("he", null, 200000, COPY.he), "עד €200,000");
});

test("no bound at all yields no chip, in every locale", () => {
  for (const l of P_LOCALES) {
    assert.equal(budgetChip(l, null, null, COPY[l]), null);
    assert.equal(budgetChip(l, undefined, undefined, COPY[l]), null);
  }
});

test("every locale survives all four shapes without throwing", () => {
  for (const l of P_LOCALES) {
    for (const [min, max] of [[1, 2], [1, null], [null, 2], [null, null]] as const) {
      assert.doesNotThrow(() => budgetChip(l, min, max, COPY[l]));
    }
  }
});

test("the he lower/upper labels stay two different words", () => {
  assert.notEqual(COPY.he.budgetFrom, COPY.he.budgetUpTo);
  assert.equal(COPY.he.budgetFrom, "מעל");
  assert.equal(COPY.he.budgetUpTo, "עד");
});
