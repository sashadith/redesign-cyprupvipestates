import test from "node:test";
import assert from "node:assert/strict";
import { toQuarterCompletion, normalizeCompletionWrite } from "../completionDate";

/* Delivery is stored as a quarter. Feeds and price lists say "October 2027";
   the write path turns exactly that form into "Q4 2027" and nothing else. */

test("a month and year becomes its quarter", () => {
  assert.equal(toQuarterCompletion("October 2027"), "Q4 2027");
  assert.equal(toQuarterCompletion("january 2028"), "Q1 2028");
  assert.equal(toQuarterCompletion("March 2028"), "Q1 2028");
  assert.equal(toQuarterCompletion("April 2028"), "Q2 2028");
  assert.equal(toQuarterCompletion("September 2026"), "Q3 2026");
  assert.equal(toQuarterCompletion(" December 2026 "), "Q4 2026");
});

test("everything else is left exactly as written", () => {
  for (const v of ["Q4 2027", "2026", "24 months from signing", "24 Months from Signing", "22 months from contract signing", "January-April 2027", "TBA", "Ready", "Smarch 2027", ""]) {
    assert.equal(toQuarterCompletion(v), v);
  }
  assert.equal(toQuarterCompletion(null), null);
  assert.equal(toQuarterCompletion(undefined), undefined);
});

test("every Prisma write shape is normalised, other fields untouched", () => {
  const update = { where: { id: "d1" }, data: { completion: "October 2028", area: "Paphos" } };
  normalizeCompletionWrite(update);
  assert.deepEqual(update.data, { completion: "Q4 2028", area: "Paphos" });

  const set = { data: { completion: { set: "July 2028" } } };
  normalizeCompletionWrite(set);
  assert.equal(set.data.completion.set, "Q3 2028");

  const upsert = { create: { completion: "May 2029" }, update: { completion: "November 2026" } };
  normalizeCompletionWrite(upsert);
  assert.equal(upsert.create.completion, "Q2 2029");
  assert.equal(upsert.update.completion, "Q4 2026");

  const many = { data: [{ completion: "September 2027" }, { completion: "24 months from signing" }, { completion: null }] };
  normalizeCompletionWrite(many);
  assert.deepEqual(many.data.map((r) => r.completion), ["Q3 2027", "24 months from signing", null]);

  const noCompletion = { data: { area: "Tala" } };
  normalizeCompletionWrite(noCompletion);
  assert.deepEqual(noCompletion.data, { area: "Tala" });
  normalizeCompletionWrite(undefined);
});
