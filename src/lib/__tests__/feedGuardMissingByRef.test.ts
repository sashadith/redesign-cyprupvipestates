import { test } from "node:test";
import assert from "node:assert/strict";
import { unitsMissingFromFeed } from "@/lib/feedSync";

/* The completeness guard counts a stored unit as missing only when its ref is
   gone from today's feed for its project — never because its status changed.
   Real case 2026-10-13 (Medousa): 42 reservations turned into sales overnight
   and the old count comparison read them as missing units. */

const refs = (o: Record<string, string[]>) => new Map(Object.entries(o).map(([k, v]) => [k, new Set(v)]));
const u = (feedProjectId: string | null, ref: string | null) => ({ feedProjectId, ref });

test("a unit still in the feed is not missing, whatever its status there", () => {
  // the guard only sees refs; a reserved→sold switch keeps the ref in the feed
  const stored = Array.from({ length: 42 }, (_, i) => u("PRJ-10034", String(i)));
  assert.equal(unitsMissingFromFeed(stored, refs({ "PRJ-10034": stored.map((s) => s.ref!) })), 0);
});

test("a unit whose ref left its project's feed is missing", () => {
  assert.equal(unitsMissingFromFeed([u("A", "1"), u("A", "2"), u("A", "3")], refs({ A: ["1"] })), 2);
});

test("a whole project gone from the feed counts every stored unit", () => {
  const stored = [u("A", "1"), u("B", "1"), u("B", "2"), u("B", "3")];
  assert.equal(unitsMissingFromFeed(stored, refs({ A: ["1"] })), 3);
});

test("refs are matched per project, not across projects", () => {
  assert.equal(unitsMissingFromFeed([u("B", "7")], refs({ A: ["7"] })), 1);
});

test("a unit without a ref or without a project id can never be confirmed present", () => {
  assert.equal(unitsMissingFromFeed([u("A", null), u(null, "1")], refs({ A: ["1"] })), 2);
});

test("the Medousa night of 2026-10-14: 13 missing, not 56", () => {
  const stored = [
    ...Array.from({ length: 148 }, (_, i) => u(i < 120 ? "PRJ-10034" : "PRJ-29943", String(i))), // still in the feed
    ...Array.from({ length: 3 }, (_, i) => u("PRJ-15357", `a${i}`)), // Adonidos Gardens, left the feed
    ...Array.from({ length: 10 }, (_, i) => u("PRJ-31439", `z${i}`)), // Azure Living, left the feed
  ];
  const feed = refs({
    "PRJ-10034": Array.from({ length: 120 }, (_, i) => String(i)),
    "PRJ-29943": Array.from({ length: 28 }, (_, i) => String(120 + i)),
  });
  assert.equal(unitsMissingFromFeed(stored, feed), 13);
});
