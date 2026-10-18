import { test } from "node:test";
import assert from "node:assert/strict";
import { leadSearchParts, paletteActions } from "../crm/leadSearch";

test("queries under 2 characters do not search", () => {
  assert.equal(leadSearchParts(""), null);
  assert.equal(leadSearchParts(" a "), null);
});

test("a name query is text only", () => {
  const p = leadSearchParts("  Anna ");
  assert.ok(p);
  assert.equal(p.digits, null);
  assert.ok(Array.isArray((p.text as { OR: unknown[] }).OR));
  assert.equal((p.text as { OR: unknown[] }).OR.length, 4);
});

test("a phone query yields its digits", () => {
  assert.equal(leadSearchParts("+49 171 5551")?.digits, "491715551");
  assert.equal(leadSearchParts("1234")?.digits, null);
});

test("palette actions follow the user's rights", () => {
  const ids = (a: boolean, o: boolean) => paletteActions(a, o).map((x) => x.id);
  assert.deepEqual(ids(false, false), ["today", "pipeline", "new-lead"]);
  const all = ids(true, true);
  for (const id of ["inbox", "team", "commissions", "old-crm"]) assert.ok(all.includes(id));
  assert.ok(!ids(true, false).includes("old-crm"));
  assert.ok(!ids(false, true).includes("team"));
});
