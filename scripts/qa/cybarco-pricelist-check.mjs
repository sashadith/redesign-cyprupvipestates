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
   cybarcoPriceTable.ts). Real prices across all NINE committed fixtures run
   320,000-6,200,000 (6-7 digits); the largest neighbouring-column impostor is
   4 digits: a 1035 sqm plot (Akamas Villas, villa 7, type K4), Limassol Greens'
   comma-grouped "1,600" plot (villa 47) and bare delivery years like 2026. All
   must be refused, and the smallest REAL price on record must still clear the
   floor — it dropped from 350,000 to 320,000 when the last three documents were
   read, which is exactly the direction that erodes this margin. */
check("plot area (1035 sqm, Akamas Villas villa 7) is not a price", CP.cybarcoParsePrice("1035"), null);
check("a comma-grouped plot (1,600 sqm, Limassol Greens villa 47) is not a price",
  CP.cybarcoParsePrice("1,600"), null);
check("delivery year is not a price", CP.cybarcoParsePrice("2026"), null);
check("smallest real price on record still parses", CP.cybarcoParsePrice("320,000"), 320000);
check("the previous record holder still parses too", CP.cybarcoParsePrice("350,000"), 350000);

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
   The fixtures below are real pdf.js page data for the six committed price
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
/* Centro prints 101 twice, once per building, so some rows can only be named by
   the pair that is actually their identity. */
const unitIn = (list, block, ref) =>
  list.find((u) => u.block === block && u.ref === ref) || { ref: `NO SUCH UNIT: ${block} / ${ref}` };
/* The identity a database keyed on (block, ref) would use. A null block is a
   real, distinct key here — two of these documents print no heading at all — so
   it is spelled out rather than collapsed into the empty string. */
const identity = (u) => JSON.stringify([u.block, u.ref]);

const NAFTIKOS = units("naftikos");
check("naftikos: every unit has a ref", NAFTIKOS.every((u) => !!u.ref), true);
check("naftikos: refs unique", new Set(NAFTIKOS.map((u) => u.ref)).size, NAFTIKOS.length);
check("naftikos: A 101 price", unit(NAFTIKOS, "A 101").price, 990000);
check("naftikos: A 101 status", unit(NAFTIKOS, "A 101").status, "available");
check("naftikos: A 101 beds", unit(NAFTIKOS, "A 101").beds, "3");
check("naftikos: A 101 internal area", unit(NAFTIKOS, "A 101").areaInternal, "119");
/* The floor is a produced field like any other, and until this assertion existed
   it had none anywhere: deleting BOTH floor header keys nulled the floor of all
   150 units and the suite still printed "all checks passed". The page prints
   "1st", not "1" — the reader passes the cell through verbatim. */
check("naftikos: A 101 floor", unit(NAFTIKOS, "A 101").floor, "1st");
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
check("aktea4: 101 floor", unit(AKTEA, "101").floor, "1st");
check("aktea4: 101 bedrooms", unit(AKTEA, "101").beds, "2");

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
/* "Спальни" and "Крытые террасы" are the only way into the bedroom and veranda
   fields of a Russian list, and neither had an assertion: deleting both keys
   nulled beds and areaVeranda for all sixty Centro units with every count still
   exact. Read off page 1 of the rendered PDF: 101 is 2 bedrooms, 16 m² of
   covered terrace. */
check("centro: Russian bedroom header", unit(CENTRO, "101").beds, "2");
check("centro: Russian covered-terrace header", unit(CENTRO, "101").areaVeranda, "16");
check("centro: Russian floor header", unit(CENTRO, "101").floor, "1");

/* Villas: a different shape, with Plot Area m². */
const AKAMAS = units("akamas-villas");
check("akamas: plot area captured", unit(AKAMAS, "7").areaPlot, "1035");
check("akamas: villa 7 is sold", unit(AKAMAS, "7").status, "sold");
check("akamas: every unit has a plot", AKAMAS.every((u) => !!u.areaPlot), true);
/* Villa bedroom counts are printed as "4+1" (four bedrooms and a maid's room),
   not as a number. The field is a string on purpose and must stay verbatim. */
check("akamas: villa 7 bedrooms", unit(AKAMAS, "7").beds, "4+1");
/* A villa list has no floor column at all. Null here is the document's answer,
   not a reading failure, and the difference matters to a sync that would
   otherwise overwrite a good value with a null. */
check("akamas: a villa list has no floor", unit(AKAMAS, "7").floor, null);

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
/* Two shapes in ONE document: the apartment table has a Floor No column, the
   villa table below it does not. Villa 54's floor is null because the page has
   no such column for it — while B22's, on the same page, is a two-storey
   "2nd/3rd" printed with superscript ordinals that arrive as separate
   fragments. */
check("marina: apartment floor, superscripts joined", unit(MARINA, "B22").floor, "2nd/3rd");
check("marina: the villa table has no floor column", unit(MARINA, "54").floor, null);
check("marina: villa 54 bedrooms", unit(MARINA, "54").beds, "4+2");

/* Trilogy Limassol Seafront: THREE sections on one page, each with its own
   complete header, and headings the first version of this reader did not
   recognise at all — "EAST TOWER" is not "BUILDING x", and "NORTH RESIDENCES
   (A)" carries a parenthesised designator. Every Trilogy unit came out with
   block null and not one count moved, because the rows themselves were read
   fine. This fixture was captured on 2026-09-11 from
   https://www.cybarco.com/wp-content/uploads/2017/04/Trilogy-Pricelist-ENG-060826.pdf
   (updated 05.08.2026) and counted by eye off the rendered page. */
const TRILOGY = units("trilogy");
check("trilogy: towers become blocks",
  Array.from(new Set(TRILOGY.map((u) => u.block))).sort(),
  ["EAST TOWER", "NORTH RESIDENCES (A)", "NORTH RESIDENCES (B)"]);
check("trilogy: EAST TOWER heading reaches its unit", unit(TRILOGY, "1701").block, "EAST TOWER");
check("trilogy: a parenthesised designator survives", unit(TRILOGY, "304").block, "NORTH RESIDENCES (A)");
check("trilogy: the third section is its own block", unit(TRILOGY, "1005").block, "NORTH RESIDENCES (B)");
check("trilogy: 1701 is reserved", unit(TRILOGY, "1701").status, "reserved");
check("trilogy: 304 price", unit(TRILOGY, "304").price, 710000);
check("trilogy: 1006 price", unit(TRILOGY, "1006").price, 1650000);
check("trilogy: no unit has a plot area", TRILOGY.every((u) => u.areaPlot === null), true);

/* The veranda is the COVERED terrace. Three of these documents print a second
   and a third terrace column beside it — "Roof Terraces" (Naftikos A 501: 52
   covered, 48 roof) and "Uncovered Terraces" (Akamas villa 7: 36 covered, 29
   uncovered) — and all of them contain the word "terrace". */
check("naftikos: roof terrace is not the veranda",
  unit(NAFTIKOS, "A 501").areaVeranda, "52");
check("akamas: uncovered terrace is not the veranda",
  unit(AKAMAS, "7").areaVeranda, "36");

/* ── Every produced field, once per document shape ───────────────────────────
   A count can be exactly right while a whole column is null: relabel a header
   in the source document ("Floor No." to "Level", "Крытые террасы" to
   "Балконы") and the reader keeps every row, keeps every status, and quietly
   hands the sync a null where a good value used to be. So one complete row per
   shape is pinned here, field by field. Each of these eight rows was read off
   the rendered page by eye on 2026-09-11, cell by cell across the row — they
   are the document's answer, not the reader's. */
check("naftikos: A 101, every field", unit(NAFTIKOS, "A 101"), {
  ref: "A 101", block: "BUILDING A", floor: "1st", beds: "3",
  areaInternal: "119", areaVeranda: "36", areaBuilt: "155", areaPlot: null,
  price: 990000, status: "available",
});
check("aktea4: 101, every field", unit(AKTEA, "101"), {
  ref: "101", block: null, floor: "1st", beds: "2",
  areaInternal: "87", areaVeranda: "28", areaBuilt: "115", areaPlot: null,
  price: 560000, status: "available",
});
check("centro: 101 of building A, every field", unitIn(CENTRO, "ЗДАНИЕ A", "101"), {
  ref: "101", block: "ЗДАНИЕ A", floor: "1", beds: "2",
  areaInternal: "87", areaVeranda: "16", areaBuilt: "103", areaPlot: null,
  price: 530000, status: "available",
});
check("akamas: villa 7, every field", unit(AKAMAS, "7"), {
  ref: "7", block: null, floor: null, beds: "4+1",
  areaInternal: "292", areaVeranda: "36", areaBuilt: "328", areaPlot: "1035",
  price: null, status: "sold",
});
check("marina: apartment B22, every field", unit(MARINA, "B22"), {
  ref: "B22", block: "Castle Residences", floor: "2nd/3rd", beds: "3",
  areaInternal: "182", areaVeranda: "31", areaBuilt: "248", areaPlot: null,
  price: null, status: "reserved",
});
check("marina: villa 54, every field", unit(MARINA, "54"), {
  ref: "54", block: "Island Villas", floor: null, beds: "4+2",
  areaInternal: "230", areaVeranda: "72", areaBuilt: "511", areaPlot: "644",
  price: null, status: "reserved",
});
check("trilogy: 1701, every field", unit(TRILOGY, "1701"), {
  ref: "1701", block: "EAST TOWER", floor: "17", beds: "3",
  areaInternal: "135", areaVeranda: "25", areaBuilt: "215", areaPlot: null,
  price: null, status: "reserved",
});
check("trilogy: 304, every field", unit(TRILOGY, "304"), {
  ref: "304", block: "NORTH RESIDENCES (A)", floor: "3", beds: "1",
  areaInternal: "57", areaVeranda: "18", areaBuilt: "98", areaPlot: null,
  price: 710000, status: "available",
});

/* ── The identity invariant ──────────────────────────────────────────────────
   The next task writes these units to a database keyed on (block, ref). That
   pair is unique in all six documents and `ref` alone is NOT — Centro prints
   101-106 once per building — so the pair is asserted for every document rather
   than left as a property nobody wrote down.

   Half of that key is null twice over: Aktea 4 and Akamas print no section
   heading at all. That is stated here too, because it is exactly the fact that
   breaks silently. If a future Aktea list gains a "BUILDING A" heading, the same
   physical unit's key moves from (null, "101") to ("BUILDING A", "101") and the
   sync writes duplicates instead of updates — with every count still correct. A
   failure here is the warning that the key changed shape. */
for (const [name, list] of [
  ["naftikos", NAFTIKOS], ["aktea4", AKTEA], ["centro", CENTRO],
  ["akamas", AKAMAS], ["marina", MARINA], ["trilogy", TRILOGY],
]) {
  check(`${name}: (block, ref) is unique`, new Set(list.map(identity)).size, list.length);
}
check("centro: ref alone is NOT unique — which is why the key is the pair",
  new Set(CENTRO.map((u) => u.ref)).size < CENTRO.length, true);
check("aktea4: no heading in the document, so every block is null",
  AKTEA.every((u) => u.block === null), true);
check("akamas: no heading in the document, so every block is null",
  AKAMAS.every((u) => u.block === null), true);
check("every other document gives every unit a block",
  [...NAFTIKOS, ...CENTRO, ...MARINA, ...TRILOGY].every((u) => typeof u.block === "string"), true);

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
               p1 Island Villas     2 rows (1 available, 1 reserved, 0 sold)

   Trilogy was counted the same way on 2026-09-11, off its own rendered page:

     trilogy   p1 EAST TOWER            1 row  (0 available, 1 reserved, 0 sold)
               p1 NORTH RESIDENCES (A)  3 rows (3 available, 0 reserved, 0 sold)
               p1 NORTH RESIDENCES (B)  3 rows (3 available, 0 reserved, 0 sold) */
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
check("trilogy total", TRILOGY.length, 7);
check("trilogy available", by(TRILOGY, "available"), 6);
check("trilogy reserved", by(TRILOGY, "reserved"), 1);
check("trilogy sold", by(TRILOGY, "sold"), 0);
check("trilogy: EAST TOWER has one unit",
  TRILOGY.filter((u) => u.block === "EAST TOWER").length, 1);
check("trilogy: NORTH RESIDENCES (A) has three",
  TRILOGY.filter((u) => u.block === "NORTH RESIDENCES (A)").length, 3);
check("trilogy: NORTH RESIDENCES (B) has three",
  TRILOGY.filter((u) => u.block === "NORTH RESIDENCES (B)").length, 3);

/* ── The three documents that had never been read ────────────────────────────
   Park Residences, Limassol Greens and Seaview Heights were captured on
   2026-09-11 from the project pages listed below and are the last of Cybarco's
   nine price lists. Between them they hold 217 of the connector's 374 units —
   more than the six that were already committed — and until this section
   existed not one of their rows had ever been through the reader.

   Every count and every field below was read off the RENDERED pages by eye
   (pdfjs-dist + canvas at scale 2.2, one PNG per page, counted row by row),
   never off the extracted JSON, because that extraction is what is under test.
   Where a number here disagrees with the reader, the READER is wrong. It was
   wrong four times, and all four are pinned below.

     park-residences  .../2017/04/Park-Residences-Pricelist-ENG-060826.pdf  (05.08.2026)
     limassol-greens  .../2021/03/Limassol-Greens-Pricelist-ENG-040926.pdf  (03.09.2026)
     seaview-heights  .../2021/03/Seaview-Heights-Pricelist-ENG-040926.pdf  (04.09.2026)
   all under https://www.cybarco.com/wp-content/uploads/ */

/* "UNDER OFFER" is Limassol Greens' third status word and the reader had never
   seen it. An unknown outcome DROPS the row, so eleven units — four Block A
   apartments, one villa and all six under-offer townhouses — were absent from a
   115-row document whose every other count came out exact. It reads as reserved
   for the same reason ПЕРЕГОВОРЫ does: not for sale today, not sold either.
   The second spelling is what a column join produces if a future list ever
   prints the two words as two cells. */
check("UNDER OFFER is reserved, not available",
  CP.cybarcoReadOutcome("UNDER OFFER"), { status: "reserved", price: null });
check("UNDER OFFER survives a tight column join",
  CP.cybarcoReadOutcome("UNDEROFFER"), { status: "reserved", price: null });

/* Park Residences: one page, twelve rows, no section heading of any kind — the
   project's name is set as vector art, not text, so nothing on the page is
   heading-shaped and every block is null. This is the ONLY one of the three the
   reader already read correctly, in every field, before this task.

     park  p1  (no heading)  12 rows (4 available, 0 reserved, 8 sold) */
const PARK = units("park-residences");
check("park total", PARK.length, 12);
check("park available", by(PARK, "available"), 4);
check("park reserved", by(PARK, "reserved"), 0);
check("park sold", by(PARK, "sold"), 8);
check("park: no heading in the document, so every block is null",
  PARK.every((u) => u.block === null), true);
check("park: (block, ref) is unique", new Set(PARK.map(identity)).size, PARK.length);
/* Park adds a "Common Area m²" column between the uncovered terraces and the
   price. It has no key, so it must stay out of every produced field — in
   particular it must not be read as the veranda or the total covered area. */
check("park: 101, every field", unit(PARK, "101"), {
  ref: "101", block: null, floor: "1st", beds: "2",
  areaInternal: "89", areaVeranda: "20", areaBuilt: "109", areaPlot: null,
  price: null, status: "sold",
});
check("park: 302, every field", unit(PARK, "302"), {
  ref: "302", block: null, floor: "3rd", beds: "3",
  areaInternal: "127", areaVeranda: "43", areaBuilt: "170", areaPlot: null,
  price: 495000, status: "available",
});
/* 104 and 204 are printed "10" + "4" and "20" + "4", one gap too narrow to be a
   space. The same join that KEEPS Naftikos' "A 501" spaced must drop this one. */
check("park: a ref split mid-number is joined without a space",
  PARK.filter((u) => /4$/.test(u.ref)).map((u) => u.ref), ["104", "204"]);

/* Limassol Greens: SIX pages, FOUR tables, four different reference labels and
   two tables that run over a page break without repeating either their heading
   or their header. It broke the reader in three separate ways and accounts for
   every one of the 42 units that were being lost.

     greens  p1 Starlings Apartments Block A  37 rows (16 avail, 5 reserved, 4 under offer, 12 sold)
             p2 same block, no heading and NO HEADER
                                               5 rows ( 1 avail, 0 reserved, 0 under offer,  4 sold)
             p3 Villas Pricelist              41 rows (15 avail, 0 reserved, 1 under offer, 25 sold)
             p4 same block, no heading and NO HEADER
                                               1 row  ( 1 avail, 0 reserved, 0 under offer,  0 sold)
             p5 Ibis Townhouses Pricelist     18 rows ( 0 avail, 0 reserved, 6 under offer, 12 sold)
             p6 Kinglet Villas Pricelist      13 rows (13 avail, 0 reserved, 0 under offer,  0 sold)

   115 rows; 46 available, 53 sold, and 5 + 11 = 16 reserved once the under-offer
   rows land where they belong. */
const GREENS = units("limassol-greens");
const G_APTS = "Starlings Apartments Block A";
const G_VILLAS = "Villas Pricelist";
const G_TOWN = "Ibis Townhouses Pricelist";
const G_KING = "Kinglet Villas Pricelist";
check("greens total", GREENS.length, 115);
check("greens available", by(GREENS, "available"), 46);
check("greens reserved", by(GREENS, "reserved"), 16);
check("greens sold", by(GREENS, "sold"), 53);
check("greens: the four sections become the four blocks",
  Array.from(new Set(GREENS.map((u) => u.block))).sort(),
  [G_APTS, G_TOWN, G_KING, G_VILLAS].sort());
check("greens: Block A has 42", GREENS.filter((u) => u.block === G_APTS).length, 42);
check("greens: the villas have 42", GREENS.filter((u) => u.block === G_VILLAS).length, 42);
check("greens: the townhouses have 18", GREENS.filter((u) => u.block === G_TOWN).length, 18);
check("greens: the Kinglet villas have 13", GREENS.filter((u) => u.block === G_KING).length, 13);
check("greens: every unit has a block", GREENS.every((u) => typeof u.block === "string"), true);

/* The reason the section captions HAD to become blocks. The townhouses are
   numbered 1-18 and the Kinglet villas 1-13, so thirteen references are printed
   twice in this one document. With every block null the pair (block, ref) — the
   key the sync writes on — collides thirteen times and two physical houses fold
   into one row. */
check("greens: (block, ref) is unique", new Set(GREENS.map(identity)).size, GREENS.length);
check("greens: ref alone collides 13 times, across the townhouse and Kinglet tables",
  GREENS.length - new Set(GREENS.map((u) => u.ref)).size, 13);
check("greens: townhouse 1 and Kinglet 1 are two different units",
  [unitIn(GREENS, G_TOWN, "1").areaPlot, unitIn(GREENS, G_KING, "1").areaPlot],
  ["402", "407"]);

/* Page 2 is five more Block A apartments and page 4 is one more villa, each
   under a heading and a header printed only on the page before. A reader that
   starts every page from nothing loses all six and says nothing at all. */
check("greens: a table continued over a page break keeps its header",
  GREENS.filter((u) => ["A406", "A407", "A408", "A501", "A502"].includes(u.ref)).length, 5);
check("greens: and keeps its heading",
  Array.from(new Set(GREENS.filter((u) => /^A[45]0/.test(u.ref)).map((u) => u.block))), [G_APTS]);
check("greens: the villa table's continuation page too",
  unitIn(GREENS, G_VILLAS, "105").price, 1980000);

/* The under-offer rows, one per table that prints any. */
check("greens: A007 is under offer, so reserved", unitIn(GREENS, G_APTS, "A007").status, "reserved");
check("greens: villa 51 is under offer", unitIn(GREENS, G_VILLAS, "51").status, "reserved");
check("greens: six townhouses are under offer",
  GREENS.filter((u) => u.block === G_TOWN && u.status === "reserved").map((u) => u.ref),
  ["13", "14", "15", "16", "17", "18"]);

/* One complete row per shape, read off the rendered page cell by cell. The
   apartment table has NO floor column at all — null there is the document's
   answer — and a "Garden Area m²" column that has no key and must stay out of
   every field. */
check("greens: apartment A001, every field", unitIn(GREENS, G_APTS, "A001"), {
  ref: "A001", block: G_APTS, floor: null, beds: "2",
  areaInternal: "89", areaVeranda: "24", areaBuilt: "127", areaPlot: null,
  price: 620000, status: "available",
});
check("greens: apartment A501 (page 2), every field", unitIn(GREENS, G_APTS, "A501"), {
  ref: "A501", block: G_APTS, floor: null, beds: "3",
  areaInternal: "162", areaVeranda: "70", areaBuilt: "258", areaPlot: null,
  price: 1980000, status: "available",
});
check("greens: villa 31, every field", unitIn(GREENS, G_VILLAS, "31"), {
  ref: "31", block: G_VILLAS, floor: null, beds: "3",
  areaInternal: "182", areaVeranda: "45", areaBuilt: "227", areaPlot: "609",
  price: 1880000, status: "available",
});
check("greens: townhouse 1, every field", unitIn(GREENS, G_TOWN, "1"), {
  ref: "1", block: G_TOWN, floor: null, beds: "2",
  areaInternal: "115", areaVeranda: "26", areaBuilt: "141", areaPlot: "402",
  price: null, status: "sold",
});
/* The Kinglet table is the one that sets "Kinglet" and "No." side by side on a
   single line, 29.8 pt apart — wider than COLUMN_GAP — so "No." becomes a
   column of its own and the reference column's right edge lands at x=71.6 with
   the reference cells centred at x=67.7. Under four points of room: if this row
   ever comes back empty, that is where to look. Its areas are printed in
   fragments too ("1" + "46" for 146, "1" + "83" for 183). */
check("greens: Kinglet villa 1, every field", unitIn(GREENS, G_KING, "1"), {
  ref: "1", block: G_KING, floor: null, beds: "3",
  areaInternal: "146", areaVeranda: "37", areaBuilt: "183", areaPlot: "407",
  price: 1260000, status: "available",
});
/* A KNOWN loss, pinned so that it is a recorded fact rather than a surprise.
   Villa 104's plot area is printed 5.04 pt above the rest of its row, and
   scripts/pdf-table-extract-worker.mjs groups a row at 4.5 pt, so the value
   never reaches this reader: it is a stray one-cell row in the extraction, not
   something the reader dropped. The document says 750. The unit itself, its
   price and its status are all correct, and villa 105 on the next page has the
   same 750 to compare against. If the extractor's row tolerance is ever
   retuned, this assertion is what will say so. */
check("greens: villa 104's plot is lost by the EXTRACTOR, not the reader",
  unitIn(GREENS, G_VILLAS, "104").areaPlot, null);
check("greens: villa 104 is otherwise whole",
  [unitIn(GREENS, G_VILLAS, "104").areaBuilt, unitIn(GREENS, G_VILLAS, "104").price],
  ["285", 1970000]);

/* Seaview Heights: four pages, seven sections, every row of it counted
   correctly by the reader as it stood — the one thing it lost here was a field,
   not a row.

     seaview  p1 BUILDING A 12 rows (12 available, 0 reserved,  0 sold)
              p1 BUILDING B 14 rows ( 2 available, 0 reserved, 12 sold)
              p2 BUILDING C 16 rows ( 2 available, 1 reserved, 13 sold)
              p2 BUILDING D 16 rows ( 8 available, 0 reserved,  8 sold)
              p3 BUILDING E 12 rows ( 4 available, 0 reserved,  8 sold)
              p3 BUILDING F 11 rows ( 0 available, 2 reserved,  9 sold)
              p4 VILLAS      9 rows ( 6 available, 0 reserved,  3 sold)

   Building F prints no F102 — the gap is the document's, not a dropped row. */
const SEAVIEW = units("seaview-heights");
check("seaview total", SEAVIEW.length, 90);
check("seaview available", by(SEAVIEW, "available"), 34);
check("seaview reserved", by(SEAVIEW, "reserved"), 3);
check("seaview sold", by(SEAVIEW, "sold"), 53);
check("seaview: seven sections become seven blocks",
  Array.from(new Set(SEAVIEW.map((u) => u.block))).sort(),
  ["BUILDING A", "BUILDING B", "BUILDING C", "BUILDING D", "BUILDING E", "BUILDING F", "VILLAS"]);
check("seaview: every unit has a block", SEAVIEW.every((u) => typeof u.block === "string"), true);
check("seaview: (block, ref) is unique", new Set(SEAVIEW.map(identity)).size, SEAVIEW.length);
for (const [letter, n] of [["A", 12], ["B", 14], ["C", 16], ["D", 16], ["E", 12], ["F", 11]]) {
  check(`seaview: BUILDING ${letter} has ${n}`,
    SEAVIEW.filter((u) => u.block === `BUILDING ${letter}`).length, n);
}
check("seaview: VILLAS has 9", SEAVIEW.filter((u) => u.block === "VILLAS").length, 9);
check("seaview: the document itself skips F102", SEAVIEW.some((u) => u.ref === "F102"), false);
check("seaview: apartment A101, every field", unitIn(SEAVIEW, "BUILDING A", "A101"), {
  ref: "A101", block: "BUILDING A", floor: "1st", beds: "3",
  areaInternal: "118", areaVeranda: "35", areaBuilt: "153", areaPlot: null,
  price: 650000, status: "available",
});
check("seaview: D104, every field", unitIn(SEAVIEW, "BUILDING D", "D104"), {
  ref: "D104", block: "BUILDING D", floor: "1st", beds: "1",
  areaInternal: "56", areaVeranda: "19", areaBuilt: "75", areaPlot: null,
  price: 320000, status: "available",
});
check("seaview: C104 is the reserved one on its page",
  unitIn(SEAVIEW, "BUILDING C", "C104").status, "reserved");
/* The villa table heads its plot column "Plot Size", not "Plot Area". Every one
   of these nine villas was read, with the right price and the right status, and
   every one of them had a null plot area — the silent-null failure that no
   count can ever catch. */
check("seaview: villa 1, every field", unitIn(SEAVIEW, "VILLAS", "1"), {
  ref: "1", block: "VILLAS", floor: null, beds: "3",
  areaInternal: "146", areaVeranda: "65", areaBuilt: "211", areaPlot: "406",
  price: 990000, status: "available",
});
check("seaview: every villa has a plot area",
  SEAVIEW.filter((u) => u.block === "VILLAS").every((u) => !!u.areaPlot), true);
/* An apartment list has no plot column and the villa list no floor column.
   Both nulls are the document's answer and both must survive. */
check("seaview: apartments have no plot area",
  SEAVIEW.filter((u) => u.block !== "VILLAS").every((u) => u.areaPlot === null), true);
check("seaview: villas have no floor",
  SEAVIEW.filter((u) => u.block === "VILLAS").every((u) => u.floor === null), true);
/* Page 4 also carries a site plan whose callouts are loose digits and letters
   sitting below a live header. None of them is a unit — the count above is what
   proves it, and this is what names it. */
check("seaview: the site plan's callouts are not units",
  SEAVIEW.filter((u) => u.block === "VILLAS").map((u) => u.ref),
  ["1", "2", "3", "4", "5", "6", "7", "8", "9"]);

/* ── What the reader REFUSES, and says so ────────────────────────────────────
   Two findings, one channel. cybarcoReadPages returns the units AND the notes;
   cybarcoUnitsFromPages (used by every assertion above) is the units-only view
   of it, so the counts and the diagnostics are measured off the same read.

   Both failures below were found by MUTATING a committed fixture, because
   neither can be reproduced from the nine documents as they stand — which is
   the point: they are what happens the next time Cybarco print a word this
   reader has not seen, and there have already been four such surprises in nine
   documents. Fixtures are never edited on disk; each mutation is a deep copy. */
const clone = (pages) => JSON.parse(JSON.stringify(pages));
/** Rewrites the text of every cell matching `from` on one page. */
function relabel(pages, pageIndex, from, to) {
  let hits = 0;
  for (const row of pages[pageIndex].rows) {
    for (const cell of row.cells) if (cell.t.trim() === from) { cell.t = to; hits++; }
  }
  if (!hits) throw new Error(`fixture mutation found no "${from}" on page ${pageIndex + 1} — the fixture changed shape`);
  return pages;
}

/* A clean document must be SILENT. Nine documents, 374 units, not one note —
   otherwise the two notes below are noise a reader learns to skip past, and
   Limassol Greens would carry one every single night: its page 4 prints a bare
   "2026" delivery year that REF_RE accepts as a reference with an empty price
   cell, which is why an EMPTY price cell is deliberately not reported. */
for (const name of ["naftikos", "aktea4", "centro-ru", "akamas-villas", "marina",
  "trilogy", "park-residences", "limassol-greens", "seaview-heights"]) {
  check(`${name}: a document the reader can read produces no note`,
    CP.cybarcoReadPages(plx(name)).notes, []);
}

/* ── Finding B: an unrecognised header must yield NOTHING, loudly ─────────────
   Carrying `columns` across a page break is a real fix — two Limassol Greens
   tables continue onto a page that repeats no header — but it also means a page
   whose header is UNRECOGNISED stopped yielding zero rows and started yielding
   rows read through the PREVIOUS page's columns. Seaview Heights page 4 is the
   demonstration: relabel its villa header from "Villa No." to "Bungalow No." (a
   fifth spelling of the reference label; there have already been four in nine
   documents) and the page used to produce nine units carrying page 3's APARTMENT
   columns — every one of them publishing floor "406", which is the plot size read
   through the floor column, with areaPlot null. The count stayed 90 and nothing
   reached the notes. */
const BUNGALOW = CP.cybarcoReadPages(relabel(clone(plx("seaview-heights")), 3, "Villa No.", "Bungalow No."));
check("guard: an unreadable header yields no units at all, not nine wrong ones",
  BUNGALOW.units.length, 90 - 9);
check("guard: and the villa section is simply absent",
  BUNGALOW.units.filter((u) => u.block === "VILLAS").length, 0);
/* The signature of the bug itself: a plot size published as a floor. */
check("guard: no unit publishes a plot size as its floor",
  BUNGALOW.units.filter((u) => u.floor === "406").length, 0);
check("guard: the refusal names the page and the labels it could not read",
  BUNGALOW.notes.length === 1 &&
  /^page 4: a table header with a price column but NO recognised reference label \(.*"Bungalow No\."/.test(BUNGALOW.notes[0]),
  true);
/* Everything BEFORE the unreadable header is still read: the guard drops the
   table it cannot read, not the document. */
check("guard: the six apartment buildings are untouched",
  ["A", "B", "C", "D", "E", "F"].map((l) => BUNGALOW.units.filter((u) => u.block === `BUILDING ${l}`).length),
  [12, 14, 16, 16, 12, 11]);

/* THE TWO PAGES THE GUARD MUST NOT BREAK. Limassol Greens p2 (five more Block A
   apartments) and p4 (one more villa) carry no heading, no reference label and no
   trailing price label, so neither trigger fires and both inherit as designed.
   The counts above already pin the rows; these two name the mechanism, because a
   guard that cleared `columns` on either of them would take 6 units with it and
   the failure would read as a fixture problem rather than as this guard. */
check("continuation: Greens page 2 still inherits its header (5 apartments)",
  GREENS.filter((u) => ["A406", "A407", "A408", "A501", "A502"].includes(u.ref)).length, 5);
check("continuation: Greens page 4 still inherits its header (villa 105)",
  unitIn(GREENS, G_VILLAS, "105").price, 1980000);
check("continuation: and neither page produces a refusal note",
  CP.cybarcoReadPages(plx("limassol-greens")).notes, []);
/* The note row those pages DO carry is why the price-label trigger is anchored
   at the end of a line: five of the nine documents print "- Price includes a
   parking space and a storeroom" under their table, Greens p2 among them, and an
   unanchored test would treat each of those as a header and clear the columns of
   a page that reads perfectly. */
check("continuation: a '- Price includes …' note line is not a header",
  GREENS.filter((u) => u.block === G_APTS).length, 42);

/* ── Finding C: a row refused for its price cell must be counted ──────────────
   `if (!outcome) continue` drops the row, which is the right call — a row whose
   price cannot be read must never be published as available — but it had no
   diagnostic channel at all. "UNDER OFFER" is the measured cost: eleven of
   Limassol Greens' 115 rows printed it, 9.6% of the document, under the 25%
   collapse threshold in cybarcoSync.ts, and on a first sync that guard is inert
   anyway because nothing is stored to compare against. The next word goes the
   same way — so here is the next word. */
const CONTRACT = CP.cybarcoReadPages(relabel(clone(plx("naftikos")), 0, "SOLD", "UNDER CONTRACT"));
/* Naftikos page 1 prints SOLD on 18 of its 25 rows (page 2's seven are left
   alone, so the document still reads and only one table loses rows). */
check("refusal: every row printing an unknown status word is still DROPPED",
  CONTRACT.units.length, 37 - 18);
check("refusal: and every one of them is counted, with the offending text",
  CONTRACT.notes, ['18 row(s) with a reference but an unreadable price cell were DROPPED: "UNDER CONTRACT" x18 (first p1, ref A 103) — an unknown status word, or a number the 6-digit price floor refused']);
/* One row, not a whole document: a single surprise must be just as visible as
   twenty-five, because one row is how the next vocabulary change starts. */
const ONE_ROW = clone(plx("naftikos"));
for (const row of ONE_ROW[0].rows) {
  if (Math.abs(row.y - 624.6) > 0.05) continue;
  for (const cell of row.cells) if (cell.t.trim() === "SOLD") cell.t = "UNDER OFFER (STC)";
}
const STC = CP.cybarcoReadPages(ONE_ROW);
check("refusal: one row out of 37 is reported too", STC.units.length, 36);
check("refusal: the note quotes that one row's text",
  STC.notes, ['1 row(s) with a reference but an unreadable price cell were DROPPED: "UNDER OFFER (STC)" x1 (first p1, ref A 103) — an unknown status word, or a number the 6-digit price floor refused']);
/* And the row comes BACK the moment the vocabulary learns the word — the fix a
   reader of that note would make. */
check("refusal: teaching the vocabulary the word restores the row",
  CP.cybarcoReadOutcome("UNDER OFFER"), { status: "reserved", price: null });

console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
