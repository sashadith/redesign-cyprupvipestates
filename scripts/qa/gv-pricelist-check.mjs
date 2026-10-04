#!/usr/bin/env node
/* Ground-truth check for the G&V price-list reader (src/lib/ai/gvPriceTable.ts)
   and its Drive adapter (src/lib/ai/pdfTablePricelist.ts).

   The fixtures in scripts/qa/fixtures/gv/*.json are REAL pdf.js page data,
   captured from the developer's own five price lists on 2026-09-08. The
   expected prices and statuses below were read off those documents by a human
   and are not negotiable: if this script fails, the reader is wrong.

   Self-contained: the fixtures go straight into gvTableFromPages(), so there is
   no PDF, no pdf.js worker, no network and no API key. The one AI step
   (mapTableColumns) is supplied here as the answer the model returns for each
   layout — but that answer is then run through the REAL, frozen validateMapping
   from availabilityTable.ts, so the reference-policy case below exercises the
   actual production path that turns Tsada Superior Villa's bedroom count into
   its "unit reference".

     node scripts/qa/gv-pricelist-check.mjs

   Exits non-zero on the first failed assertion. */
import { writeFileSync, rmSync, readFileSync } from "node:fs";
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
const GV = await import(await bundle("src/lib/ai/gvPriceTable.ts", "gv-price-table"));
const AD = await import(await bundle("src/lib/ai/pdfTablePricelist.ts", "gv-adapter"));
const AT = await import(await bundle("src/lib/ai/availabilityTable.ts", "availability-table"));
process.on("exit", () => { for (const p of written) rmSync(p, { force: true }); });

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
}

const fixture = (name) => JSON.parse(readFileSync(join(ROOT, "scripts/qa/fixtures/gv", `${name}.json`), "utf8"));

/* The column mapping the model returns for each of the five layouts, recorded
   from the real call. `columns` is its raw answer; it is deliberately NOT
   pre-corrected, because validateMapping's correction of it is part of what is
   under test — most of all for Tsada Superior Villa, whose answer contains no
   `ref` at all because the document has no reference column. */
const MODEL = {
  altamare: {
    title: "", unitKind: "Villa",
    columns: ["ref", "beds", "baths", "areaPlot", "areaBuilt", "areaVeranda", "price"],
    labels: ["No.", "Bedrooms", "Bathrooms", "Land m²", "Covered Area m²", "Covered Veranda m²", "Price"],
  },
  g12: {
    title: "", unitKind: "Apartment",
    columns: ["ref", "beds", "baths", "areaInternal", "areaBuilt", "attr", "areaVeranda", "attr", "price"],
    labels: ["No.", "Bedrooms", "Bathrooms", "Internal Area", "Covered Area m²", "Storage", "Covered veranda m²", "Covered parking", "Price"],
  },
  gr2: {
    title: "", unitKind: "Villa",
    columns: ["ref", "beds", "baths", "areaPlot", "areaBuilt", "areaVeranda", "price"],
    labels: ["No.", "Bedrooms", "Bathrooms", "Land", "Covered area m²", "Covered veranda m²", "Price (no VAT)"],
  },
  sv: {
    title: "", unitKind: "Villa",
    columns: ["beds", "baths", "areaBuilt", "areaInternal", "areaVeranda", "areaVerandaOpen", "attr", "attr", "areaPlot", "price"],
    labels: ["Bedrooms", "Bathrooms", "Covered Area m2", "Internal Area", "Veranda m2", "Uncovered Veranda", "Lift", "Swimming pool", "Land m2", "Price"],
  },
  "tsada-d": {
    title: "", unitKind: "Villa",
    columns: ["ref", "beds", "baths", "areaPlot", "areaBuilt", "areaVeranda", "price"],
    labels: ["No.", "Bedrooms", "Bathrooms", "Land m²", "Covered Area m²", "Covered Veranda m²", "Price"],
  },
};

/** The production path, with the model's one answer supplied instead of called. */
function read(name, pages = fixture(name), projectName = name) {
  const table = GV.gvTableFromPages(pages);
  // "No table at all" is a result, not a crash: a broken reader has to fail the
  // assertion below with a readable message, not take the whole script down
  // before the other four documents have been checked.
  if (!table) return { table: null, mapping: null, validated: { columns: [], corrections: [] }, extraction: { units: [], dropped: [], unresolved: [{ row: name, cell: "(no table found)" }], notes: [] } };
  const model = MODEL[name];
  const validated = AT.validateMapping(table, model.columns);
  const mapping = { ...model, columns: validated.columns, corrections: validated.corrections };
  return { table, mapping, validated, extraction: GV.unitsFromGvTable(table, mapping, { fallbackRef: projectName }) };
}

/* The outcome of a unit as a human reads the document: a price when it is for
   sale, otherwise the status word. Asserted as an ORDERED VECTOR, never as a
   count — a mechanism that swapped two rows' statuses has to fail here. */
const outcomes = (units) => units.map((u) => (u.status === "available" ? u.price : u.status));

/* 1. THE GROUND TRUTH. Five real documents, verified against the developer's
      own PDFs on 2026-09-08. */
{
  const EXPECTED = {
    altamare: [580000, "reserved", "reserved", 475000, 465000, "reserved", "reserved", 450000],
    g12: [290000, 185000, 180000, 300000, 195000, 190000, 310000, 210000, 205000],
    gr2: [415000, 415000],
    sv: [1950000],
    "tsada-d": ["sold", 730000, "reserved", "reserved", 715000, "reserved", "sold"],
  };
  for (const [name, expected] of Object.entries(EXPECTED)) {
    const { extraction } = read(name);
    check(`${name}: prices and statuses, in row order`, outcomes(extraction.units), expected);
    // Never "available" by default: an outcome cell nobody could read has to be
    // reported instead, and none of these five documents has one.
    check(`${name}: every outcome resolved`, extraction.unresolved, []);
  }
  check("altamare: references in row order", read("altamare").extraction.units.map((u) => u.ref), ["1", "2", "3", "4", "5", "6", "7", "8"]);
  check("g12: references in row order", read("g12").extraction.units.map((u) => u.ref), ["101", "102", "103", "201", "202", "203", "301", "302", "303"]);
  check("tsada-d: references in row order", read("tsada-d").extraction.units.map((u) => u.ref), ["1", "2", "3", "4", "5", "6", "7"]);
}

/* 2. A trailing surcharge line is not a unit. Georgia Residences 2 prints
      "SWIMMING POOL EXTRA : € 15,000" directly under its two villas with no
      blank line between them, and the bare "15,000" parses perfectly well as a
      price — so the row reaches the table and must be refused THERE, by name,
      with a reason a human can read in the dry run. */
{
  const { table, extraction } = read("gr2");
  check("gr2: the surcharge line is not a unit", extraction.units.length, 2);
  check("gr2: the surcharge line is refused, with a reason", table?.refused, [
    { row: "SWIMMING POOL EXTRA : € 15,000", reason: "row inside the table that does not open with a unit reference" },
  ]);
  check("gr2: the refusal reaches the dropped list", extraction.dropped[0]?.row, "SWIMMING POOL EXTRA : € 15,000");
  check("gr2: the surcharge never becomes a price", outcomes(extraction.units).includes(15000), false);
  // Refused before the columns are measured — a 3-cell row must never get a
  // vote on where a 7-column table's columns are.
  check("gr2: the refused row did not move the columns", table?.rows?.[0], ["1", "3", "3", "401", "147", "7", "€ 415,000"]);
}

/* 3. THE REFERENCE POLICY. Tsada Superior Villa is one villa on one row with no
      "No." column at all, so every column is fully populated and the frozen
      validateMapping — correctly, for Korantina — commandeers the leftmost one
      as `ref`. That is the bedroom count. */
{
  const { validated, mapping, extraction } = read("sv", fixture("sv"), "Tsada Panorama Superior Villa");
  // The premise: this is what the shared validator really does. If this line
  // ever fails, the policy below is solving a problem that no longer exists.
  check("sv: the shared validator does commandeer the bedroom column", validated.columns[0], "ref");
  check("sv: ...and says so", validated.corrections.length > 0, true);

  check("sv: the ref is the caller's fallback name, not the bedroom count", extraction.units[0]?.ref, "Tsada Panorama Superior Villa");
  check("sv: the override is reported", extraction.notes.length, 1);
  check("sv: ...naming the column and the reason", /column 0 \("Bedrooms"\).*names the beds column/.test(extraction.notes[0] ?? ""), true);
  // The rejected column is not thrown away: it goes back to the field its own
  // label names, so the villa keeps its five bedrooms.
  check("sv: the bedroom count survives the override", extraction.units[0]?.beds, "5");
  check("sv: the price is the millions shorthand, in euros", extraction.units[0]?.price, 1950000);
  // A real reference column must not be second-guessed by the same policy.
  check("altamare: a real reference column is left alone", read("altamare").extraction.notes, []);
  check("altamare: ...and mapping is unchanged", read("altamare").mapping?.columns[0], "ref");
}

/* 4. AN UNREADABLE PRICE IS UNKNOWN, NEVER AVAILABLE — and never invisible
      either. A unit whose price is not printed both fails the row test and sits
      in the middle of the table, so it must be carried through the run, land in
      the grid, and be reported. Alta Mare with villa 4 priced "ON REQUEST". */
{
  const pages = fixture("altamare");
  const row = pages[0].rows.find((r) => r.cells[0]?.t === "4");
  row.cells = [...row.cells.slice(0, 6), { x: 497.7, w: 48.5, t: "ON REQUEST" }];
  const { extraction } = read("altamare", pages);
  check("unreadable price: the row is not published", outcomes(extraction.units), [580000, "reserved", "reserved", 465000, "reserved", "reserved", 450000]);
  check("unreadable price: it is reported as unresolved", extraction.unresolved.map((u) => u.cell), ["ON REQUEST"]);
  check("unreadable price: with the whole row, for a human", (extraction.unresolved[0]?.row ?? "").startsWith("4 | 3 | 2 | 411"), true);
  check("unreadable price: and the table is not cut in two", extraction.units.length + extraction.unresolved.length, 8);
}

/* 4b. WHICH RUN OF ROWS IS THE TABLE. Alta Mare's "OPTIONAL EXTRAS" block is
       five consecutive price-shaped lines ("LANDSCAPED GARDEN  €  6,000.00"),
       further down the same page as the villas. Picking the LONGEST run would
       be enough today only because there happen to be eight villas; a phase
       with three would lose its whole table to the extras block. The rule is
       the run with the most rows that OPEN with a unit reference, and this is
       the case that tells the two rules apart. */
{
  const pages = fixture("altamare");
  const keep = new Set(["1", "2", "3"]);
  // Villas 4-8 removed; the five-line extras block left exactly as printed.
  pages[0].rows = pages[0].rows.filter((r) => !/^[45678]$/.test(r.cells[0]?.t ?? "") || keep.has(r.cells[0]?.t ?? ""));
  const { extraction } = read("altamare", pages);
  check("a three-villa table still beats the five-line extras block", outcomes(extraction.units), [580000, "reserved", "reserved"]);
  check("...and no extras line becomes a unit", extraction.units.map((u) => u.ref), ["1", "2", "3"]);
}

/* 5. THE ADAPTER'S FIELD MAPPING. Georgia 12 is the one G&V layout that prints
      a dedicated Internal Area beside a total covered area, and ExtractedUnit
      has only one built-area field — so the internal figure has to be carried
      as an extra or nine units silently lose it on every sync. Every attribute
      lands in exactly ONE place: a named field, or extras, never both. */
{
  const { extraction } = read("g12");
  const u = extraction.units[0] ? AD.gvUnitToExtracted(extraction.units[0]) : {};
  check("g12: the total covered area is the built area", u.areaBuilt, "106");
  check("g12: the internal area survives, as an extra", u.extras, "Internal area: 85");
  check("g12: YES/NO specs land in their named fields", [u.storage, u.parking], ["YES", "YES"]);
  check("g12: ...and are not repeated in extras", /storage|parking/i.test(u.extras ?? ""), false);
  check("g12: the veranda is its own field", u.areaVeranda, "21");
  check("g12: the property type is the kind of home", [u.type, u.bedrooms, u.price, u.status], ["Apartment", "2", 290000, "available"]);

  // Superior Villa: an attribute matching no named field must still survive.
  const svUnit = read("sv", fixture("sv"), "Tsada Panorama Superior Villa").extraction.units[0];
  const sv = svUnit ? AD.gvUnitToExtracted(svUnit) : {};
  check("sv: the pool dimension is the pool field", sv.pool, "4*12");
  check("sv: Lift matches no named field and lands in extras", sv.extras, "Internal area: 305, Lift: YES");
  check("sv: internal and covered areas stay distinct", [sv.areaBuilt, sv.areaPlot, sv.areaVerandaOpen], ["421", "1100", "85"]);
}

/* 6. VALUE PARSING. The four price forms G&V actually prints, the outcome
      vocabulary they print in the price column, and the shapes that must NOT
      read as a price. */
{
  check("grouped with cents", GV.gvParsePrice("€ 580,000.00"), 580000);
  check("grouped, no cents", GV.gvParsePrice("415,000"), 415000);
  check("dot separator", GV.gvParsePrice("1.800.000"), 1800000);
  check("millions shorthand", GV.gvParsePrice("€1.95M"), 1950000);
  check("ungrouped", GV.gvParsePrice("415000"), 415000);
  check("an area is not a price", GV.gvParsePrice("194.3"), null);
  check("a plot size is not a price", GV.gvParsePrice("401"), null);
  check("a pool dimension is not a price", GV.gvParsePrice("4*12"), null);
  check("a bare cents fragment is not a price", GV.gvParsePrice(",000.00"), null);
  check("a zero amount is not a price", GV.gvParsePrice("0,000.00"), null);

  check("sold", GV.gvReadOutcome("SOLD"), { status: "sold", price: null });
  check("reserved", GV.gvReadOutcome("RESERVED"), { status: "reserved", price: null });
  check("show house is reserved, not sold", GV.gvReadOutcome("SHOW HOUSE"), { status: "reserved", price: null });
  check("a price is available", GV.gvReadOutcome("€ 465,000.00"), { status: "available", price: 465000 });
  for (const blank of ["", " ", "--", "n/a", "TBC"]) {
    check(`unresolved "${blank}" is never available`, GV.gvReadOutcome(blank), null);
  }
}

console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
