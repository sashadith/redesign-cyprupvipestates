#!/usr/bin/env node
/* Ground-truth check for the Cybarco price-list reader's cell-level primitives
   (src/lib/ai/cybarcoPriceTable.ts): price parsing, status/outcome reading, and
   column joining. This is Task 5 of the Cybarco connector — the riskiest
   component, split off from Task 6's table-level assembly so a reviewer can
   reject cell-level reading without rejecting the rest.

   Self-contained: no PDF, no pdf.js worker, no network and no API key. The
   strings and the fixture row below were read off real Cybarco price lists on
   2026-09-10.

     node scripts/qa/cybarco-pricelist-check.mjs

   Exits non-zero on the first failed assertion. */
import { writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/* esbuild is a TRANSITIVE dependency here, not a declared one — it is present
   because something else pulls it in, and a future dependency change could
   remove it without any signal. Declaring it just for this dev-only script
   would force a `CVP_RUN_INSTALL=1` on the next production deploy for something
   that never runs in production, so it is imported defensively instead: a
   missing esbuild must say so, not crash with a bare module-not-found. */
let build;
try {
  ({ build } = await import("esbuild"));
} catch {
  console.error("esbuild is not installed (it is only a transitive dependency).\n  npm i -D esbuild   — or run this check from a tree where it is present.");
  process.exit(2);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const written = [];
/* Bundles land INSIDE the tree, not in tmpdir like the Korantina check does,
   because these keep `@anthropic-ai/sdk` and `@prisma/client` external — a
   bundle in /tmp cannot resolve them, and pulling the whole AI SDK into the
   bundle just to never call it is a slow way to prove nothing. */
async function bundle(entry, name) {
  const path = join(ROOT, `.qa-${name}-${process.pid}.mjs`);
  const out = await build({
    entryPoints: [join(ROOT, entry)],
    bundle: true, platform: "node", format: "esm", write: false,
    external: ["@anthropic-ai/sdk", "@prisma/client"],
  });
  writeFileSync(path, out.outputFiles[0].text);
  written.push(path);
  return path;
}
const CP = await import(await bundle("src/lib/ai/cybarcoPriceTable.ts", "cybarco-price-table"));
process.on("exit", () => { for (const p of written) rmSync(p, { force: true }); });

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
}

/* Every string below was read off a real Cybarco price list on 2026-09-10.
   The fragmented ones are the point: pdf.js hands back "5", "60", ",", "0",
   "00" as separate cells for a single price, and a reader that joins cell TEXT
   instead of clustering by x reported Aktea 4 as having zero available units.
   It has several. */
check("plain grouped price", CP.cybarcoParsePrice("990,000"), 990000);
check("fragmented, joined", CP.cybarcoParsePrice("5 60 , 0 00"), 560000);
check("fragmented with leading group", CP.cybarcoParsePrice("600 ,000"), 600000);
check("fragmented, three groups", CP.cybarcoParsePrice("3 70 ,000"), 370000);
check("millions", CP.cybarcoParsePrice("3,900,000"), 3900000);
check("euro sign tolerated", CP.cybarcoParsePrice("€ 1,260,000"), 1260000);
check("area is not a price", CP.cybarcoParsePrice("119"), null);
check("zero is not a price", CP.cybarcoParsePrice("0"), null);
check("empty", CP.cybarcoParsePrice(""), null);
check("status word is not a price", CP.cybarcoParsePrice("SOLD"), null);

/* The digit floor is measured, not guessed (see the comment in
   cybarcoPriceTable.ts). Real prices across all five committed fixtures run
   350,000-6,200,000 (6-7 digits); the largest neighbouring-column impostor is
   4 digits: a 1035 sqm plot (Akamas Villas, unit K5) and bare delivery years
   like 2026. Both must be refused, and the smallest REAL price on record must
   still clear the floor. */
check("plot area (1035 sqm, Akamas Villas K5) is not a price", CP.cybarcoParsePrice("1035"), null);
check("delivery year is not a price", CP.cybarcoParsePrice("2026"), null);
check("smallest real price on record still parses", CP.cybarcoParsePrice("350,000"), 350000);

check("SOLD", CP.cybarcoReadOutcome("SOLD"), { status: "sold", price: null });
check("RESERVED", CP.cybarcoReadOutcome("RESERVED"), { status: "reserved", price: null });
check("price means available", CP.cybarcoReadOutcome("990,000"), { status: "available", price: 990000 });
/* Centro Limassol's linked price list is Russian. An English-only vocabulary
   read it as zero sold units. */
check("ПРОДАНО", CP.cybarcoReadOutcome("ПРОДАНО"), { status: "sold", price: null });
check("РЕЗЕРВ", CP.cybarcoReadOutcome("РЕЗЕРВ"), { status: "reserved", price: null });
check("ПЕРЕГОВОРЫ is reserved, not available",
  CP.cybarcoReadOutcome("ПЕРЕГОВОРЫ"), { status: "reserved", price: null });
check("noise yields nothing", CP.cybarcoReadOutcome("Notes:"), null);
check("area cell yields nothing", CP.cybarcoReadOutcome("155"), null);

const row = { y: 665, cells: [
  { x: 57.6, w: 26, t: "A 101" }, { x: 109.9, w: 14, t: "1st" },
  { x: 476.5, w: 10, t: "5" }, { x: 489.5, w: 20, t: "60" },
  { x: 505.0, w: 4, t: "," }, { x: 510.0, w: 6, t: "0" }, { x: 516.0, w: 12, t: "00" },
] };
check("column join respects x bounds", CP.joinColumn(row, 470, 540), "560,000");
check("column join is empty outside the band", CP.joinColumn(row, 200, 300), "");
check("column join keeps left-to-right order", CP.joinColumn(row, 50, 130), "A 1011st");

/* pdf.js does not guarantee cells are emitted in x order, which is the whole
   reason joinColumn sorts before joining. The three assertions above never
   exercise that sort because the fixture row's cells already happen to be
   listed in ascending-x order — removing `.sort((a, b) => a.x - b.x)` from
   joinColumn and re-running the suite unchanged still prints all-passed. This
   row is deliberately scrambled (array order: "00", "5", ",", "60", "0" —
   none of that is x-ascending) so that only a reader that actually sorts by x,
   not one that trusts array order, produces the right joined text. */
const scrambledRow = { y: 500, cells: [
  { x: 516.0, w: 12, t: "00" }, { x: 476.5, w: 10, t: "5" }, { x: 505.0, w: 4, t: "," },
  { x: 489.5, w: 20, t: "60" }, { x: 510.0, w: 6, t: "0" },
] };
check("column join sorts cells that arrive out of x order", CP.joinColumn(scrambledRow, 470, 540), "560,000");

console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
