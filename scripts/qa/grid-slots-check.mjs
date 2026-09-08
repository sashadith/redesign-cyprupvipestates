#!/usr/bin/env node
/* Self-test for gridSlots() — the /projects result grid's card/map ordering.

   Guards the 2026-09-08 regression: the map tile REPLACED the third card
   instead of being inserted, so the third result of every desktop page was
   rendered nowhere. With PAGE_SIZE 12 and 246 published projects that hid one
   project per page — about 21 in total, reachable only via the map, the
   search or a direct URL. It surfaced as "why is Synergy missing?" on a
   Larnaca filter that counted 3 results and drew 2 cards.

     node scripts/qa/grid-slots-check.mjs

   Exits non-zero on any failed assertion. */
import { build } from "esbuild";
import { writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";

const scratch = join(process.cwd(), "node_modules", ".grid-slots-check");
mkdirSync(scratch, { recursive: true });
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
const out = await build({
  entryPoints: ["src/app/preview-projects/gridSlots.ts"],
  bundle: true, platform: "node", format: "esm", write: false,
});
const f = join(scratch, "g.mjs");
writeFileSync(f, out.outputFiles[0].text);
const { gridSlots } = await import(f);

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `\n       erwartet ${JSON.stringify(expected)}, war ${JSON.stringify(actual)}`}`);
};
const deck = (n) => Array.from({ length: n }, (_, i) => `c${i}`);
const shape = (slots) => slots.map((s) => (s.kind === "map" ? "MAP" : s.card));
const kept = (slots) => slots.filter((s) => s.kind === "card").map((s) => s.card);

console.log("\nno card is ever lost — the regression this file exists for");
for (const n of [1, 2, 3, 4, 12, 13]) {
  check(`${n} card(s): all ${n} survive on desktop`, kept(gridSlots(deck(n), false)), deck(n));
  check(`${n} card(s): all ${n} survive on mobile`, kept(gridSlots(deck(n), true)), deck(n));
}

console.log("\na full page keeps every one of its 12 results");
{
  const slots = gridSlots(deck(12), false);
  check("12 cards + 1 tile = 13 slots", slots.length, 13);
  check("the third result is still shown", kept(slots).includes("c2"), true);
}

console.log("\nthe map tile sits in the third slot");
{
  check("4 cards: tile is third", shape(gridSlots(deck(4), false)), ["c0", "c1", "MAP", "c2", "c3"]);
  check("3 cards: tile is third", shape(gridSlots(deck(3), false)), ["c0", "c1", "MAP", "c2"]);
}

console.log("\nsmall result sets still get a tile, appended");
{
  check("2 cards: tile last", shape(gridSlots(deck(2), false)), ["c0", "c1", "MAP"]);
  check("1 card: tile last", shape(gridSlots(deck(1), false)), ["c0", "MAP"]);
  check("no cards: no tile at all", shape(gridSlots([], false)), []);
}

console.log("\nmobile opens the map from the filter bar instead");
{
  check("3 cards on mobile: no tile", shape(gridSlots(deck(3), true)), ["c0", "c1", "c2"]);
  check("12 cards on mobile: no tile", gridSlots(deck(12), true).length, 12);
}

console.log("\nexactly one tile, never two");
for (const n of [0, 1, 2, 3, 12]) {
  check(`${n} card(s): tile count`, gridSlots(deck(n), false).filter((s) => s.kind === "map").length, n === 0 ? 0 : 1);
}

/* gridSlots only fixes DOM order; the visible corner is a CSS contract. This
   cannot prove the browser renders it — it asserts the rule the code comments
   point at still exists, is scoped to the grid's own tile, and pins the LAST
   column rather than a hard-coded third one (which only looked right while
   the fluid column count happened to resolve to three). */
console.log("\nthe CSS contract that pins the tile to the corner is intact");
{
  const css = readFileSync("src/app/preview-projects/projects.css", "utf8");
  const rule = css.match(/\.px__grid\s*>\s*\.prjmap\s*\{[^}]*\}/);
  check("the pin rule exists", !!rule, true);
  const body = rule ? rule[0] : "";
  check("it pins the first row", /grid-row:\s*1\b/.test(body), true);
  check("it pins the last column, not a fixed third", /grid-column:\s*-2\s*\/\s*-1/.test(body), true);
  check("no hard-coded column index", /grid-column:\s*3\b/.test(body), false);
  // Below 769px the tile is not rendered at all (isMobile), and a one-column
  // grid there would push the first card under it.
  const guarded = /@media\s*\(min-width:\s*769px\)\s*\{[^{]*\.px__grid\s*>\s*\.prjmap/.test(css);
  check("it is scoped above the mobile breakpoint", guarded, true);
  check("the grid still uses auto-fill, which keeps empty tracks", /repeat\(auto-fill/.test(css), true);
  check("not auto-fit, which would collapse them and move the corner", /repeat\(auto-fit/.test(css), false);
}

console.log(`\n${failures ? `${failures} failed` : "all checks passed"}`);
process.exit(failures ? 1 : 0);
