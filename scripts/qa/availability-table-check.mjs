#!/usr/bin/env node
/* Regression check for the deterministic half of the Korantina availability-list
   reader (src/lib/ai/availabilityTable.ts) — the half that produces every unit
   VALUE and every unit STATUS, and therefore the half that must never drift.

   Self-contained: it feeds synthetic pdf.js page data straight into
   tablesFromPages(), so it needs no PDF files, no network and no API key. Every
   case below is a real defect found while building the adapter against Korantina's
   16 live availability lists on 2026-08-26, written down here so the next change
   to the geometry cannot quietly undo one of them.

     node scripts/qa/availability-table-check.mjs

   Exits non-zero on the first failed assertion. */
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/* esbuild is a TRANSITIVE dependency here, not a declared one — it is present
   because something else pulls it in, and a future dependency change could remove
   it without any signal. Declaring it just for this dev-only script would force a
   `CVP_RUN_INSTALL=1` on the next production deploy for something that never runs
   in production, so it is imported defensively instead: a missing esbuild must say
   so, not crash with a bare module-not-found. */
let build;
try {
  ({ build } = await import("esbuild"));
} catch {
  console.error("esbuild is not installed (it is only a transitive dependency).\n  npm i -D esbuild   — or run this check from a tree where it is present.");
  process.exit(2);
}

async function bundle(entry, name, stubs = false) {
  const path = join(tmpdir(), `${name}-${process.pid}.mjs`);
  // sharepointAvailabilitySync pulls in Prisma and the whole sync stack; only its
  // pure naming/media helpers are under test, so those imports are stubbed out.
  const stubPlugin = {
    name: "stub",
    setup(b) {
      b.onResolve({ filter: /^@\/lib\/prisma$|^\.\/(prisma|dropboxAvailabilitySync|developmentDistances|developmentDerivedState|imageMirror|unitRef)$|^\.\/ai\/(availabilityTable|projectInfoExtract|projectDescription)$/ }, (a) => ({ path: a.path, namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export const prisma={};export const extractPdfTables=async()=>({tables:[],unparsedPages:[]});export const mapTableColumns=async()=>({});export const unitsFromTable=()=>({units:[],dropped:[]});export const extractTextFromPdf=async()=>'';export const generateProjectDescription=async()=>null;export const extractAmenitiesFromText=async()=>[];export const normalizeRef=(s)=>s.toLowerCase();export const recomputeDevelopmentDistances=async()=>{};export const recomputeDevelopmentDerivedState=async()=>{};export const storeUploadedImage=async()=>null;export const devKeyFor=(s)=>s;export const pdfPagesToJpegs=async()=>[];export const scheduleAppRestart=()=>{};export const beginSyncWindow=()=>()=>{};", loader: "js" }));
    },
  };
  const out = await build({ entryPoints: [entry], bundle: true, platform: "node", format: "esm", write: false, ...(stubs ? { plugins: [stubPlugin] } : {}) });
  writeFileSync(path, out.outputFiles[0].text);
  return path;
}

const bundlePath = await bundle("src/lib/ai/availabilityTable.ts", "availability-table-check");
const bundleSync = await bundle("src/lib/sharepointAvailabilitySync.ts", "sharepoint-sync-check", true);
const bundleSp = await bundle("src/lib/sharepoint.ts", "sharepoint-check");
const AT = await import(bundlePath);
process.on("exit", () => { for (const p of [bundlePath, bundleSync, bundleSp]) rmSync(p, { force: true }); });

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
}

/* Builds a page from a compact "column x-position -> text" description. Cell
   widths are approximated from the text length, which is all the column
   clustering needs (it works on centres). */
const COL_X = [30, 90, 150, 210, 270, 330, 390, 450];
const row = (y, cells) => ({
  y,
  cells: cells.flatMap((t, i) => (t === null || t === "" ? [] : [{ x: COL_X[i], w: Math.min(50, String(t).length * 5), t: String(t) }])),
});
const page = (n, rows) => ({ page: n, width: 842, height: 595, rows });

/* 1. An empty cell must stay empty and must NOT shift the columns after it.
      Sunset View leaves "Cov. Parking" blank on 19 of 26 rows; a left-to-right
      text read moved the total area and the price one column left on exactly
      those rows. */
{
  const p = page(1, [
    row(500, ["Villa No", "Type", "Plot", "Covered", "Parking", "Total", "Price"]),
    row(470, ["1", "A", "285", "160.65", null, "194.3", "SOLD"]),
    row(450, ["2", "A", "305", "160.65", "16.8", "211.1", "€ 545,000"]),
  ]);
  const { tables } = AT.tablesFromPages([p]);
  check("blank cell keeps its column", tables[0].rows[0], ["1", "A", "285", "160.65", "", "194.3", "SOLD"]);
  const mapping = { title: "", unitKind: "Villa", labels: tables[0].headers, corrections: [],
    columns: ["ref", "type", "areaPlot", "areaInternal", "attr", "areaBuilt", "price"] };
  const { units } = AT.unitsFromTable(tables[0], mapping);
  check("blank-cell row parses", [units[0].ref, units[0].areaBuilt, units[0].status], ["1", "194.3", "sold"]);
  check("second row price", [units[1].price, units[1].status], [545000, "available"]);
}

/* 2. A price column split in two by centring. Hill Panorama centres "SOLD" and
      "€ 2.850.000" far enough apart that clustering saw two columns — sold units
      in one, priced units in the other. Whichever half had been mapped as `price`,
      every unit in the other half would have been dropped. */
{
  const p = page(1, [
    row(500, ["Villa", "Plot", "Beds", "Total", "Price"]),
    // "SOLD" sits at x 390, the euro amounts at x 450 — two clusters, one column.
    { y: 470, cells: [{ x: 30, w: 10, t: "1" }, { x: 90, w: 20, t: "955" }, { x: 150, w: 10, t: "5" }, { x: 210, w: 30, t: "365.35" }, { x: 390, w: 30, t: "SOLD" }] },
    { y: 450, cells: [{ x: 30, w: 10, t: "2" }, { x: 90, w: 20, t: "930" }, { x: 150, w: 10, t: "6" }, { x: 210, w: 30, t: "400.40" }, { x: 450, w: 60, t: "€ 2.850.000" }] },
    { y: 430, cells: [{ x: 30, w: 10, t: "3" }, { x: 90, w: 20, t: "975" }, { x: 150, w: 10, t: "5" }, { x: 210, w: 30, t: "393.90" }, { x: 390, w: 30, t: "SOLD" }] },
  ]);
  const { tables } = AT.tablesFromPages([p]);
  check("split price column is merged", tables[0].rows.map((r) => r[r.length - 1]), ["SOLD", "€ 2.850.000", "SOLD"]);
}

/* 3. Two tables with DIFFERENT columns on one page (Golden View's MAIN PHASE and
      PHASE 6). Clustering per page merged them into one phantom 18-column table. */
{
  const p = page(1, [
    row(560, ["VILLA", "PLOT", "BEDROOMS", "TOTAL", "PRICE"]),
    row(540, ["V47", "123", "3", "124.55", "SOLD"]),
    row(520, ["V58", "250", "3", "148", "SOLD"]),
    row(430, ["Villa No", "Plot Size", "BDR", "Covered", "Veranda", "Total", "Net Price"]),
    row(410, ["1", "210", "4", "135.00", "28.50", "183.10", "SOLD"]),
    row(390, ["2", "201", "4", "135.00", "28.50", "184.00", "€ 520.000"]),
  ]);
  const { tables } = AT.tablesFromPages([p]);
  check("two tables on one page", tables.length, 2);
  check("first table columns", tables[0].rows[0].length, 5);
  check("second table columns", tables[1].rows[0].length, 7);
  check("second table header not polluted by the first table's rows", tables[1].headers[0], "Villa No");
}

/* 4. A table continued on the next page (Soho's towers run 4 pages) must be ONE
      table, or each tower becomes two "projects". Identical headers only —
      Royal Bay's villa page and apartment page must stay separate. */
{
  const hdr = ["APT NO.", "FLOOR", "BEDS", "TOTAL", "PRICE"];
  const p1 = page(2, [row(500, hdr), row(470, ["A-01", "1", "3", "193", "SOLD"]), row(450, ["A-02", "1", "2", "158", "SOLD"])]);
  const p2 = page(3, [row(500, hdr), row(470, ["A-03", "2", "2", "149", "€1.250.000"]), row(450, ["A-04", "2", "3", "189", "SOLD"])]);
  const p3 = page(4, [row(500, ["VILLA", "TYPE", "PLOT", "TOTAL", "PRICE"]), row(470, ["V1", "F", "814", "375", "SOLD"]), row(450, ["V2", "B", "757", "423", "SOLD"])]);
  const { tables } = AT.tablesFromPages([p1, p2, p3]);
  check("continuation page merges", tables.length, 2);
  check("merged table row count", tables[0].rows.length, 4);
  check("different headers stay separate", tables[1].rows.length, 2);
}

/* 5. Price and status parsing. Both thousands separators appear in the same
      developer's own documents, and four different "not applicable" spellings do
      too. An unreadable cell must yield null — never a default of "available". */
{
  check("dot separator", AT.parsePrice("€ 1.800.000"), 1800000);
  check("comma separator", AT.parsePrice("€ 995,000"), 995000);
  check("no space after symbol", AT.parsePrice("€1.250.000"), 1250000);
  check("bare digits", AT.parsePrice("545000"), 545000);
  check("not a price", AT.parsePrice("SOLD"), null);
  check("area is not a price", AT.parsePrice("194.3"), null);

  check("sold", AT.readOutcome("SOLD"), { status: "sold", price: null });
  check("reserved with trailing space", AT.readOutcome("RESERVED "), { status: "reserved", price: null });
  check("developer's own RESRVED typo", AT.readOutcome("RESRVED"), { status: "reserved", price: null });
  check("priced is available", AT.readOutcome("€ 598,000"), { status: "available", price: 598000 });
  for (const blank of ["", "--", "---", "===", "n/a", "N/A", "TBC"]) {
    check(`unresolved "${blank}" is never available`, AT.readOutcome(blank), null);
  }
}

/* 6. A row whose outcome cannot be read is dropped and reported, and a block
      column is prefixed onto the ref UNCONDITIONALLY — Cap St Georges genuinely
      has a villa 1 in phase H and another in phase P. */
{
  const p = page(1, [
    row(500, ["Phase", "Villa No", "Type", "Beds", "Plot", "Covered", "Price"]),
    row(470, ["H", "1", "A", "3", "662.0", "275.75", "€ 1.800.000"]),
    row(450, ["P", "1", "C", "5", "915", "306", "RESERVED"]),
    row(430, ["P", "2", "C", "5", "915", "306", "SOLD"]),
  ]);
  const { tables } = AT.tablesFromPages([p]);
  const mapping = { title: "", unitKind: "Villa", labels: ["Phase", "Villa No", "Type", "Beds", "Plot", "Covered", "Price"], corrections: [],
    columns: ["block", "ref", "type", "beds", "areaPlot", "areaBuilt", "price"] };
  const { units } = AT.unitsFromTable(tables[0], mapping);
  check("block-prefixed refs are unique", units.map((u) => u.ref), ["H 1", "P 1", "P 2"]);
  check("label is human-readable", units[0].label, "Phase H · 1");
  check("variant letter is a spec, not the property type", [units[0].type, units[0].attrs[0]], ["Villa", { name: "Type", value: "A" }]);
}

/* 7. A model answer that mis-maps a sparse column must be corrected against the
      column's own data. City Colors' vertically-merged FLOOR cell lands on one row
      in five and looks exactly like an identifier; accepted as `ref`, four of every
      five units would arrive with no reference. */
{
  const p = page(1, [
    row(500, ["FLOOR", "APARTMENT NO", "BDR", "INTERNAL", "TOTAL", "PRICE"]),
    row(470, [null, "101", "3", "115", "162", "€ 598,000"]),
    row(450, ["1ST FLOOR", "102", "3", "113", "152", "€ 585,000"]),
    row(430, [null, "103", "1", "52", "65", "RESERVED"]),
    row(410, [null, "104", "2", "81", "103", "SOLD"]),
    row(390, [null, "105", "2", "94", "133", "€ 495,000"]),
  ]);
  const { tables } = AT.tablesFromPages([p]);
  const bad = ["ref", "attr", "beds", "areaInternal", "areaBuilt", "price"]; // FLOOR wrongly chosen as ref
  const fixed = AT.validateMapping(tables[0], bad);
  check("sparse ref column is rejected", fixed.columns[0] !== "ref", true);
  check("a real ref column is chosen instead", fixed.columns[1], "ref");
  check("the override is reported", fixed.corrections.length > 0, true);
  const { units } = AT.unitsFromTable(tables[0], { title: "", unitKind: "Apartment", labels: tables[0].headers, ...fixed });
  check("every unit keeps its reference", units.map((u) => u.ref), ["101", "102", "103", "104", "105"]);
  check("statuses survive the correction", units.map((u) => u.status), ["available", "available", "reserved", "sold", "available"]);
}

/* 8. Greek lookalike letters. Korantina type their lists on a Greek keyboard, so
      villa type "Α" is U+0391, not "A". Two spellings of one ref would create the
      same unit twice the day they fix their template. */
{
  check("Greek Alpha normalised", AT.deGreek("Α4"), "A4");
  check("Greek Nu normalised", AT.deGreek("Νο"), "No");
  check("Latin text untouched", AT.deGreek("Villa 12"), "Villa 12");
}

/* 9. A page holding a priced row but no readable table must be REPORTED, while a
      cover page or a prose description must not be — City Landmark's commercial
      floors are the one case that matters, and burying it among cover pages is how
      it would be missed. */
{
  const commercial = page(2, [
    row(500, ["FLOOR", "BLOCK", "USE", "COVERED", "TOTAL", "PRICE"]),
    row(470, ["GROUND", "B", "Office", "76", "126", "€ 2.000.000"]),
    row(450, ["1ST", "B", "Office", "76", "126", null]),
    row(430, ["2ND", "B", "Office/Apt", "67", "114", null]),
  ]);
  const prose = page(1, [
    row(500, ["SOHO is the new best residential address, featuring the first High Rise Buildings"]),
    row(480, ["located in one of the most privileged areas of Kato Paphos."]),
    row(460, ["The elegant community boasts exceptional facilities including reception,"]),
    row(440, ["concierge, a full treatment and relaxation area with spa, gym and sauna."]),
  ]);
  const a = AT.tablesFromPages([commercial]);
  check("unreadable priced page is reported", a.unparsedPages, [2]);
  const b = AT.tablesFromPages([prose]);
  check("prose cover page is not reported", b.unparsedPages, []);
}

/* 10. Table naming. The 2026-08-26 dry run against production showed the model
       naming page 2 of Hill's list "Hill Residences" — the name of page 1 — and
       returning nothing at all for Royal Bay's two tables, which also silently
       collapsed their photo/plan split onto one project. */
{
  const SS = await import(bundleSync);
  const hdrHill1 = ["Villa No", "Villa Type", "Plot (m2)", "Bedrooms", "Ground & 1st Floors", "Basement Floor", "Covered Verandas", "Total Covered Area", "Price (+VAT)"];
  const hdrHill2 = ["Villa No", "Plot (m2)", "Bedrooms", "Ground Floor", "First Floor", "Covered Verandas", "Storage - Mech. room", "Total Covered Area", "Price (+VAT)"];
  const hill = SS.resolveTableNames("/Hill Residences & Hill Panorama by Cap St. Georges", [
    { title: "", unitKind: "Villa", headers: hdrHill1 },
    { title: "Hill Residences", unitKind: "Villa", headers: hdrHill2 }, // the model's wrong answer
  ]);
  check("folder splits on & into per-table names", hill.map((h) => h.name), ["Hill Residences By Cap St. Georges", "Hill Panorama By Cap St. Georges"]);
  check("the model's mislabel is not used", hill[1].label, "Hill Panorama");
  check("the shared by-clause is kept out of the matching label", hill.map((h) => h.label), ["Hill Residences", "Hill Panorama"]);
  const SP0 = await import(bundleSp);
  check("Panorama photo folder now clears the threshold", SP0.nameOverlap("Pictures Hill Panorama", "Hill Panorama") >= 0.34, true);
  check("...and does not also match Hill Residences", SP0.nameOverlap("Pictures Hill Panorama", "Hill Residences") < 0.34, true);

  const royal = SS.resolveTableNames("/Royal Bay Resort", [
    { title: "", unitKind: "Villa", headers: ["VILLA", "TYPE", "PLOT", "BEDROOM", "TOTAL COVERED", "PRICE +VAT"] },
    { title: "", unitKind: "Apartment", headers: ["Apartment", "Level", "Bedroom", "Total Covered Area", "Price + VAT"] },
  ]);
  check("unit kind separates unnamed tables", royal.map((r) => r.name), ["Royal Bay Resort – Villas", "Royal Bay Resort – Apartments"]);
  check("label is the distinguishing part only", royal.map((r) => r.label), ["Villas", "Apartments"]);

  const golden = SS.resolveTableNames("/Golden View Villas", [
    { title: "Main Phase", unitKind: "Villa", headers: ["MAIN VILLA", "PHASE PLOT", "BEDROOMS", "PRICE"] },
    { title: "Phase 6", unitKind: "Villa", headers: ["PHASE 6 Villa No", "Plot Size", "BDR", "Net Price"] },
  ]);
  check("a corroborated title is kept", golden.map((r) => r.label), ["Main Phase", "Phase 6"]);

  const invented = SS.resolveTableNames("/Seascape Villas", [
    { title: "Seaside Collection", unitKind: "Villa", headers: ["Villa No", "Plot", "Price"] },
    { title: "", unitKind: "Villa", headers: ["Villa No", "Plot", "Price"] },
  ]);
  check("an uncorroborated title falls back to Part N", invented.map((r) => r.label), ["Part 1", "Part 2"]);

  const single = SS.resolveTableNames("/Gardens View Villas", [{ title: "", unitKind: "Villa", headers: [] }]);
  check("one table keeps the plain folder name", single[0].name, "Gardens View Villas");

  // Media matching must survive the singular/plural mismatch between a folder
  // called "Villas" and a unit kind of "Villa".
  const SP = await import(bundleSp);
  check("plural folder matches singular label", SP.nameOverlap("Villas", "Villa") >= 0.34, true);
  check("apartments folder does not match villas label", SP.nameOverlap("Apartments", "Villas") < 0.34, true);
}

console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
