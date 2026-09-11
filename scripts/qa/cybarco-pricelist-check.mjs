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
import { readFileSync, writeFileSync, rmSync } from "node:fs";
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
   4 digits: a 1035 sqm plot (Akamas Villas, villa 7, type K4) and bare delivery years
   like 2026. Both must be refused, and the smallest REAL price on record must
   still clear the floor. */
check("plot area (1035 sqm, Akamas Villas villa 7) is not a price", CP.cybarcoParsePrice("1035"), null);
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

/* ── Table level: whole documents into units ─────────────────────────────
   The fixtures below are real pdf.js page data for the five committed price
   lists. The EXPECTED NUMBERS ARE NOT DERIVED FROM THEM: every count in this
   section was read off the rendered PDF pages by eye on 2026-09-11 (each PDF
   rasterised page by page and counted row by row), precisely so that a reader
   which silently loses a building, a section or a status cannot be validated
   by the same extraction it is supposed to be checked against. If one of these
   numbers disagrees with the reader, the reader is wrong. */
const plx = (n) => JSON.parse(readFileSync(join(ROOT, "scripts/qa/fixtures/cybarco", `pl-${n}.json`), "utf8"));
const units = (n) => CP.cybarcoUnitsFromPages(plx(n));
const by = (list, s) => list.filter((u) => u.status === s).length;
/* A unit that is not there must FAIL by name, not crash the run: a reader that
   drops a row is exactly what these assertions exist to catch, and a stack
   trace hides which of them noticed. */
const unit = (list, ref) => list.find((u) => u.ref === ref) || { ref: `NO SUCH UNIT: ${ref}` };

const NAFTIKOS = units("naftikos");
check("naftikos: every unit has a ref", NAFTIKOS.every((u) => !!u.ref), true);
check("naftikos: refs unique", new Set(NAFTIKOS.map((u) => u.ref)).size, NAFTIKOS.length);
check("naftikos: A 101 price", unit(NAFTIKOS, "A 101").price, 990000);
check("naftikos: A 101 status", unit(NAFTIKOS, "A 101").status, "available");
check("naftikos: A 101 beds", unit(NAFTIKOS, "A 101").beds, "3");
check("naftikos: A 101 internal area", unit(NAFTIKOS, "A 101").areaInternal, "119");
check("naftikos: A 101 total covered", unit(NAFTIKOS, "A 101").areaBuilt, "155");
/* One printed reference must yield one string. Naftikos prints "A 101" as a
   single cell and "A 501" as "A" + "5" + "01"; joining the fragments tight gave
   "A501" for four units of the same document, in the field that is the unit's
   identity. (Marina's "B22", further down, is printed without a space and must
   not gain one.) */
check("naftikos: fragmented ref keeps its printed space",
  NAFTIKOS.filter((u) => /^A 50/.test(u.ref)).map((u) => u.ref),
  ["A 501", "A 502", "A 503", "A 504", "A 505"]);
check("naftikos: A 102 is reserved", unit(NAFTIKOS, "A 102").status, "reserved");
check("naftikos: A 103 is sold", unit(NAFTIKOS, "A 103").status, "sold");
check("naftikos: block carried from the BUILDING heading",
  unit(NAFTIKOS, "A 101").block, "BUILDING A");
/* Page 2 is a SECOND table under its own BUILDING B heading. A reader that
   stops at the first page, or that carries page 1's heading forward, gets this
   wrong without losing a single row. */
check("naftikos: page 2 keeps its own heading",
  unit(NAFTIKOS, "B 103").block, "BUILDING B");
check("naftikos: B 103 price", unit(NAFTIKOS, "B 103").price, 910000);

/* Aktea 4 is the fragmented-price document. A text-joining reader found zero
   available units here; there are several. */
const AKTEA = units("aktea4");
check("aktea4: has available units", AKTEA.some((u) => u.status === "available"), true);
check("aktea4: 101 price survives fragmentation", unit(AKTEA, "101").price, 560000);
check("aktea4: 201 price survives fragmentation", unit(AKTEA, "201").price, 600000);
check("aktea4: 102 is sold", unit(AKTEA, "102").status, "sold");
check("aktea4: 103 is reserved", unit(AKTEA, "103").status, "reserved");

/* Centro is Russian throughout. */
const CENTRO = units("centro-ru");
check("centro: has sold units", CENTRO.some((u) => u.status === "sold"), true);
check("centro: 101 price", unit(CENTRO, "101").price, 530000);
check("centro: 102 is sold", unit(CENTRO, "102").status, "sold");
check("centro: no unit is left status-less", CENTRO.every((u) => !!u.status), true);
/* Building Б repeats building А's apartment numbers, so the block is the only
   thing telling 101-А (530,000) apart from 101-Б (ПРОДАНО). Both must survive,
   and the Cyrillic heading must be read as a heading. Note the heading's letter:
   page 1 is "ЗДАНИЕ" + a LATIN "A" (U+0041), page 2 a Cyrillic "Б" (U+0411) —
   one document, two alphabets in the same word. */
check("centro: Russian heading becomes the block",
  unit(CENTRO, "101").block, "ЗДАНИЕ A");
check("centro: both buildings are present", new Set(CENTRO.map((u) => u.block)).size, 2);
check("centro: 101 exists twice, once per building",
  CENTRO.filter((u) => u.ref === "101").map((u) => u.status), ["available", "sold"]);
/* "Общая крытая площадь" CONTAINS "крытая площадь": a header vocabulary that
   tests the internal-area label first labels the total-covered column twice and
   never finds the real internal area. */
check("centro: internal area, not total covered",
  unit(CENTRO, "101").areaInternal, "87");
check("centro: total covered area", unit(CENTRO, "101").areaBuilt, "103");

/* Villas: a different shape, with Plot Area m². */
const AKAMAS = units("akamas-villas");
check("akamas: plot area captured", unit(AKAMAS, "7").areaPlot, "1035");
check("akamas: villa 7 is sold", unit(AKAMAS, "7").status, "sold");
check("akamas: every unit has a plot", AKAMAS.every((u) => !!u.areaPlot), true);

/* Limassol Marina lists ONLY available properties, has several sections in one
   document, and extra columns. Absent sold rows must not be read as an empty
   project, and the sections must not become several projects. */
const MARINA = units("marina");
check("marina: units found", MARINA.length > 0, true);
check("marina: no sold rows in an available-only list",
  MARINA.some((u) => u.status === "sold"), false);
check("marina: an unspaced ref stays unspaced", MARINA.some((u) => u.ref === "B22"), true);
check("marina: B22 is reserved", unit(MARINA, "B22").status, "reserved");
check("marina: B31 price", unit(MARINA, "B31").price, 5700000);
check("marina: sections become blocks, not projects",
  new Set(MARINA.map((u) => u.block)).size > 1, true);
/* The second section is a VILLA table with its own, different header (Plot
   Area, Basement, Berths). Reusing the apartment header from the section above
   it reads villa 85's plot area as its floor and shifts every later column. */
check("marina: the second section gets its own header",
  unit(MARINA, "85").areaPlot, "229");
check("marina: villa 85 price", unit(MARINA, "85").price, 3900000);
check("marina: apartments have no plot area",
  unit(MARINA, "B31").areaPlot, null);
/* Villa 85 has 12 m² of covered terrace and 89 m² of basement in two adjacent
   columns. The first version of this reader let the stranded "m²" superscript
   act as a stepping stone between the two header labels, merged the columns and
   reported a 1,289 m² veranda — with every count still correct. */
check("marina: terrace and basement stay apart",
  unit(MARINA, "85").areaVeranda, "12");

/* The veranda is the COVERED terrace. Three of these documents print a second
   and a third terrace column beside it — "Roof Terraces" (Naftikos A 501: 52
   covered, 48 roof) and "Uncovered Terraces" (Akamas villa 7: 36 covered, 29
   uncovered) — and all of them contain the word "terrace". */
check("naftikos: roof terrace is not the veranda",
  unit(NAFTIKOS, "A 501").areaVeranda, "52");
check("akamas: uncovered terrace is not the veranda",
  unit(AKAMAS, "7").areaVeranda, "36");

/* Nothing may be silently dropped: totals and per-status counts are asserted so
   a regression that loses a building, or that turns a reserved row into an
   available one, shows up as a number rather than as a missing row nobody
   notices. Counted by eye off the rendered pages on 2026-09-11:

     naftikos  p1 BUILDING A 25 rows (4 available, 3 reserved, 18 sold)
               p2 BUILDING B 12 rows (4 available, 1 reserved,  7 sold)
     aktea4    p1            24 rows (8 available, 2 reserved, 14 sold)
     centro    p1 ЗДАНИЕ A   30 rows (16 available, 2 reserved, 12 sold)
               p2 ЗДАНИЕ Б   30 rows ( 1 available, 3 reserved, 26 sold)
     akamas    p1            24 rows (6 available, 1 reserved, 17 sold)
     marina    p1 Castle Residences 3 rows (2 available, 1 reserved, 0 sold)
               p1 Island Villas     2 rows (1 available, 1 reserved, 0 sold) */
check("naftikos total", NAFTIKOS.length, 37);
check("naftikos available", by(NAFTIKOS, "available"), 8);
check("naftikos reserved", by(NAFTIKOS, "reserved"), 4);
check("naftikos sold", by(NAFTIKOS, "sold"), 25);
check("aktea4 total", AKTEA.length, 24);
check("aktea4 available", by(AKTEA, "available"), 8);
check("aktea4 reserved", by(AKTEA, "reserved"), 2);
check("aktea4 sold", by(AKTEA, "sold"), 14);
check("centro total", CENTRO.length, 60);
check("centro available", by(CENTRO, "available"), 17);
check("centro reserved", by(CENTRO, "reserved"), 5);
check("centro sold", by(CENTRO, "sold"), 38);
check("akamas total", AKAMAS.length, 24);
check("akamas available", by(AKAMAS, "available"), 6);
check("akamas reserved", by(AKAMAS, "reserved"), 1);
check("akamas sold", by(AKAMAS, "sold"), 17);
check("marina total", MARINA.length, 5);
check("marina available", by(MARINA, "available"), 3);
check("marina reserved", by(MARINA, "reserved"), 2);
check("marina sold", by(MARINA, "sold"), 0);

console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
