// Reading DOMO's master price list (2026-11-14).
//
// Every coordinate below was taken out of the real 2026-11-12 list, not invented:
// Siena's page is a verbatim slice of page 8 (header band, column header, first
// three units), and the header-band fixtures are the three real shapes the stale
// delivery layer takes. The rendered pages were read by eye the same day, so the
// expectations here are what a human sees on paper, which is the only thing that
// makes the geometry rule trustworthy.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  domoMapping,
  looksLikeUnitRow,
  mergeWrappedCells,
  priceListPdfUrl,
  readBuildingPrice,
  readHeaderBand,
  readPriceList,
  readPricePage,
  refineDomoUnits,
  stripRedundantBlockLetter,
} from "@/lib/domo/priceList";
import type { PdfPage, PdfRow, RawTable, TableUnit } from "@/lib/ai/availabilityTable";

const row = (y: number, cells: [number, number, string][]): PdfRow => ({ y, cells: cells.map(([x, w, t]) => ({ x, w, t })) });

/* Page 8 of the 2026-11-12 list, verbatim. Visible on paper: "SIENA. Delivery:
   Q4 2027", then 101 at €240,000, 102 SOLD, 103 at €200,000. */
const SIENA: PdfPage = {
  page: 8,
  width: 487.5,
  height: 562.5,
  rows: [
    row(523.96, [[18.91, 54.49, "SIENA"], [23.17, 54.5, "SIENA"], [77.66, 5.78, "."], [400.31, 80.07, "DOMO"], [400.31, 80.07, "DOMO"]]),
    row(506.02, [[18.7, 114.24, "Delivery: Q3 2027"], [22.8, 106.48, "Delivery: Q4 2027"]]),
    row(344.21, [[20.29, 9.42, "Ap."], [61.68, 27.38, "Bedrooms"], [109.39, 17.7, "Indoor"], [138.66, 37, "Cov. Veranda"], [191.58, 12.96, "Roof"], [223.55, 28.87, "Total Area"], [262.36, 38.88, "Common Area"], [315.93, 20.97, "Parking"], [358.27, 21.64, "Storage"], [432.14, 13.75, "Price"]]),
    row(335.97, [[111.52, 13.44, "Area"], [187.76, 20.59, "Garden"]]),
    row(305.32, [[20.82, 8.36, "101"], [74.3, 2.15, "1"], [111.49, 14.79, "50m²"], [150.36, 13.59, "10m²"], [196.62, 2.86, "-"], [230.52, 14.93, "60m²"], [276.37, 12.16, "9 m²"], [325.34, 2.15, "1"], [363.73, 10.71, "3m²"], [424.26, 29.5, "€240,000"]]),
    row(276.89, [[20.22, 9.57, "102"], [73.7, 3.35, "2"], [111.9, 13.98, "75m²"], [150.65, 13.02, "19m²"], [196.62, 2.86, "-"], [230.7, 14.57, "94m²"], [276.37, 10.87, "9m²"], [325.34, 2.15, "1"], [363.73, 10.71, "3m²"], [431.75, 14.52, "SOLD"]]),
    row(248.36, [[20.23, 9.55, "103"], [72.58, 5.59, "1S"], [111.03, 14.43, "42m²"], [150.72, 12.88, "12m²"], [196.62, 2.86, "-"], [231.41, 14.43, "54m²"], [276.37, 10.87, "9m²"], [325.34, 2.15, "1"], [363.73, 10.71, "3m²"], [424.09, 29.86, "€200,000"]]),
  ],
};

/* ── The stale delivery layer ─────────────────────────────────────────────── */

test("Siena: of two delivery lines at the same height, the one under the title wins", () => {
  // The page shows Q4 2027. Q3 2027 is the designer's previous header, hidden
  // behind the black band — 4pt to the left of the title, which is how we know.
  const band = readHeaderBand(SIENA.rows, 8);
  assert.equal(band.title, "SIENA");
  assert.equal(band.delivery, "Q4 2027");
  assert.deepEqual(band.problems, []);
});

test("Aalto: a stale title and delivery one line higher are ignored", () => {
  const rows = [
    row(532.2, [[6.57, 61, "AALTO"]]),
    row(523.9, [[23.17, 61, "AALTO"], [82.1, 5.78, "."], [400.31, 80.07, "DOMO"]]),
    row(513.45, [[5.99, 114.65, "Delivery: Q4 2027"]]),
    row(506.02, [[22.85, 106.37, "Delivery: Q3 2028"]]),
  ];
  assert.deepEqual(readHeaderBand(rows, 11), { title: "AALTO", delivery: "Q3 2028", problems: [] });
});

test("Liora: a stale line only 3pt off the template still loses", () => {
  const rows = [
    row(534.0, [[26.2, 58, "LIORA"]]),
    row(523.9, [[23.17, 57, "LIORA"], [80.5, 5.78, "."], [400.31, 80.07, "DOMO"]]),
    row(516.24, [[26.2, 108.14, "Delivery: Q1 2028"]]),
    row(506.02, [[22.44, 107.2, "Delivery: Q4 2028"]]),
  ];
  assert.equal(readHeaderBand(rows, 16).delivery, "Q4 2028");
});

test("a band that no longer matches the template yields no date and says so", () => {
  const moved = [
    row(523.9, [[23.17, 57, "LIORA"]]),
    row(506.02, [[60, 107.2, "Delivery: Q4 2028"]]), // nowhere near the title
  ];
  const band = readHeaderBand(moved, 16);
  assert.equal(band.delivery, null);
  assert.match(band.problems[0], /0 delivery line\(s\) aligned/);

  const twoTitles = [
    row(523.9, [[23.17, 57, "LIORA"], [23.2, 57, "AALTO"]]),
    row(506.02, [[22.44, 107.2, "Delivery: Q4 2028"]]),
  ];
  assert.equal(readHeaderBand(twoTitles, 16).title, null);
});

test("a delivery that is not a quarter or a year is refused", () => {
  const rows = [
    row(523.9, [[23.17, 57, "LIORA"]]),
    row(506.02, [[22.44, 107.2, "Delivery: soon"]]),
  ];
  const band = readHeaderBand(rows, 16);
  assert.equal(band.delivery, null);
  assert.match(band.problems[0], /not a quarter or a year/);
});

/* ── Table repairs ────────────────────────────────────────────────────────── */

test("a status that wraps onto a second line is folded back into its row", () => {
  // Milford Heights prints "UNDER OFFER" on two lines for two of its 20 units.
  const rows = [
    row(470.9, [[20, 5, "A"], [63, 8, "101"], [103, 2, "1"], [139, 2, "2"], [177, 14, "85m²"], [450, 22, "UNDER"]]),
    row(464.5, [[451, 20, "OFFER"]]),
    row(442.0, [[20, 5, "A"], [63, 8, "102"], [103, 2, "1"], [139, 2, "2"], [177, 14, "87m²"], [447, 29, "€455,000"]]),
  ];
  const merged = mergeWrappedCells(rows);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].cells[merged[0].cells.length - 1].t, "UNDER OFFER");
  assert.equal(merged[1].cells[merged[1].cells.length - 1].t, "€455,000");
});

test("a lone cell far from the row above is left where it is", () => {
  const rows = [
    row(470.9, [[20, 5, "A"], [63, 8, "101"], [450, 22, "UNDER"]]),
    row(400.0, [[451, 20, "OFFER"]]), // 70pt below: a different part of the page
  ];
  assert.equal(mergeWrappedCells(rows).length, 2);
});

test("Liora's Block B refs lose the letter the block column already carries", () => {
  const table: RawTable = {
    page: 17, index: 0,
    headers: ["Block", "Ap.", "Price"],
    rows: [["B", "B101", "€255,000"], ["B", "B102", "€255,000"]],
    strayRows: [],
  };
  assert.deepEqual(stripRedundantBlockLetter(table).rows, [["B", "101", "€255,000"], ["B", "102", "€255,000"]]);
});

test("a block letter that only one ref repeats is left alone", () => {
  const table: RawTable = {
    page: 17, index: 0,
    headers: ["Block", "Ap.", "Price"],
    rows: [["B", "B101", "€255,000"], ["B", "201", "€255,000"]],
    strayRows: [],
  };
  assert.deepEqual(stripRedundantBlockLetter(table).rows[0], ["B", "B101", "€255,000"]);
});

/* ── The column vocabulary ────────────────────────────────────────────────── */

test("every column DOMO print maps to a field, and the two verandas stay apart", () => {
  const headers = ["Block", "Ap.", "Floor", "Bedrooms", "Indoor Area", "Cov. Veranda", "Uncovered Veranda", "Roof Garden", "Total Area", "Common Area", "Green Terrace", "Parking", "Storage", "Asking Price"];
  const { mapping, problems } = domoMapping(headers, "p7", "EVORA");
  assert.deepEqual(problems, []);
  assert.deepEqual(mapping.columns, ["block", "ref", "floor", "beds", "areaInternal", "areaVeranda", "areaVerandaOpen", "attr", "areaBuilt", "attr", "attr", "attr", "attr", "price"]);
  assert.equal(mapping.labels[7], "Roof garden");
  assert.equal(mapping.unitKind, "Apartment");
});

test("the project's own name off the location map is stripped from a column label", () => {
  const { mapping, problems } = domoMapping(["Ap.", "SIENA Common Area", "Price"], "p8", "SIENA");
  assert.deepEqual(problems, []);
  assert.deepEqual(mapping.columns, ["ref", "attr", "price"]);
  assert.equal(mapping.labels[1], "Common area");
});

test("a column word the list has never used is reported, never guessed", () => {
  const { mapping, problems } = domoMapping(["Ap.", "Sea view", "Price"], "p8", "SIENA");
  assert.equal(mapping.columns[1], "ignore");
  assert.match(problems[0], /unknown column "Sea view"/);
});

test("a table with no price column is refused", () => {
  const { problems } = domoMapping(["Ap.", "Bedrooms"], "p8", "SIENA");
  assert.match(problems.join(" "), /no price column/);
});

/* ── A whole page ─────────────────────────────────────────────────────────── */

test("Siena's page: three units, the sold one priceless, the areas split correctly", () => {
  const page = readPricePage(SIENA);
  assert.deepEqual(page.problems, []);
  assert.equal(page.delivery, "Q4 2027");
  assert.equal(page.unitRows, 3);
  assert.equal(page.units.length, 3);

  const [a, b, c] = page.units;
  assert.equal(a.ref, "101");
  assert.equal(a.price, 240000);
  assert.equal(a.status, "available");
  assert.equal(a.beds, "1");
  assert.equal(a.areaInternal, "50"); // indoor
  assert.equal(a.areaBuilt, "60"); // indoor + veranda, as the sheet totals it
  assert.equal(a.areaVeranda, "10");
  assert.equal(a.floor, "1"); // from the reference: no Floor column on this page
  assert.equal(a.storage, "yes");
  assert.deepEqual(a.attrs.find((x) => x.name === "Parking"), { name: "Parking", value: "1" });

  assert.equal(b.status, "sold");
  assert.equal(b.price, null);
  assert.equal(c.beds, "1S"); // DOMO's own notation, kept as printed
});

test("a unit row that cannot be read is counted as missing, not silently dropped", () => {
  // A row whose price cell stops being a price or a status is not a data row to
  // the engine, and a wide one reads as the NEXT table's header — so the table
  // ends there and this page loses more than the one row. Whatever the engine
  // makes of it, the page is counted off the paper: three unit rows, and however
  // many fewer units came back is a reported problem, never a quiet shortfall.
  const broken: PdfPage = {
    ...SIENA,
    rows: SIENA.rows.map((r) => (r.y === 276.89 ? { ...r, cells: r.cells.map((c) => (c.t === "SOLD" ? { ...c, t: "ask us" } : c)) } : r)),
  };
  const page = readPricePage(broken);
  assert.equal(page.unitRows, 3);
  assert.ok(page.units.length < 3, `expected fewer than 3 units, got ${page.units.length}`);
  assert.match(page.problems.join(" "), new RegExp(`3 unit rows on the page but ${page.units.length} imported`));
});

test("looksLikeUnitRow counts the rows a human counts", () => {
  assert.equal(looksLikeUnitRow(SIENA.rows[4]), true);
  assert.equal(looksLikeUnitRow(SIENA.rows[2]), false); // the column header
  assert.equal(looksLikeUnitRow(row(100, [[20, 40, "Ground Floor"], [100, 20, "373 m²"]])), false);
});

/* ── Whole-building pages ─────────────────────────────────────────────────── */

test("rent is told from sale by the words in the cell, not by the column", () => {
  const blackfriars = [row(254.9, [[259, 30, "€4,800,000"], [330, 40, "€49,000/month"]])];
  assert.deepEqual(readBuildingPrice(blackfriars), { sale: 4800000, rent: 49000 });
  // Roman House prints its sale price in the column the other two use for rent.
  const roman = [row(276.9, [[249, 60, "Entire Building (Sale)"], [334, 30, "€6,000,000"]])];
  assert.deepEqual(readBuildingPrice(roman), { sale: 6000000, rent: null });
});

/* ── Penthouses ───────────────────────────────────────────────────────────── */

const u = (ref: string, floor: string, roof: string | null, block: string | null = null): TableUnit => ({
  ref, label: null, block, floor, type: "Apartment", beds: "1", baths: null,
  areaInternal: "50", areaBuilt: "63", areaPlot: null, areaVeranda: "13", areaVerandaOpen: null,
  price: 1, status: "available", attrs: roof ? [{ name: "Roof garden", value: roof }] : [],
});

test("a top-floor flat is a penthouse with a roof garden, or alone on its floor", () => {
  const liora = refineDomoUnits([u("201", "2", null), u("301", "3", "30m²"), u("303", "3", null), u("305", "3", null)]);
  assert.deepEqual(liora.map((x) => x.type), ["Apartment", "Penthouse", "Apartment", "Apartment"]);

  // Milford Heights A401: alone on floor 4, no roof garden, still the penthouse.
  const milford = refineDomoUnits([u("A 301", "3", null, "A"), u("A 302", "3", null, "A"), u("A 401", "4", null, "A")]);
  assert.equal(milford[2].type, "Penthouse");
  assert.equal(milford[0].type, "Apartment");
});

test("floors are counted per block, so block B's top floor is its own", () => {
  const units = refineDomoUnits([u("A 401", "4", null, "A"), u("B 301", "3", "40m²", "B"), u("B 201", "2", null, "B")]);
  assert.deepEqual(units.map((x) => x.type), ["Penthouse", "Penthouse", "Apartment"]);
});

/* ── Pages to projects ────────────────────────────────────────────────────── */

test("a page whose title is not the expected project imports nothing", () => {
  const { projects } = readPriceList([SIENA], [{ slug: "evora", name: "Evora", pages: [8] }]);
  assert.equal(projects[0].units.length, 0);
  assert.equal(projects[0].completion, null);
  assert.match(projects[0].problems[0], /titled "SIENA", not "Evora"/);
});

test("the expected project's own page imports", () => {
  const { projects, pageProblems } = readPriceList([SIENA], [{ slug: "siena", name: "Siena", pages: [8] }]);
  assert.deepEqual(pageProblems, []);
  assert.deepEqual(projects[0].problems, []);
  assert.equal(projects[0].completion, "Q4 2027");
  assert.equal(projects[0].units.length, 3);
});

test("two pages of one project that disagree on the date get no completion", () => {
  const second: PdfPage = {
    ...SIENA,
    page: 9,
    rows: SIENA.rows.map((r) => (r.y === 506.02 ? row(506.02, [[22.8, 106.48, "Delivery: Q1 2030"]]) : r)),
  };
  const { projects } = readPriceList([SIENA, second], [{ slug: "siena", name: "Siena", pages: [8, 9] }]);
  assert.equal(projects[0].completion, null);
  assert.match(projects[0].problems.join(" "), /disagree on the delivery date/);
  // The units still parse — only the date is withheld.
  assert.equal(projects[0].units.length, 3);
});

test("a page listed in the data file but absent from the PDF is reported", () => {
  const { pageProblems } = readPriceList([SIENA], [{ slug: "siena", name: "Siena", pages: [8, 99] }]);
  assert.match(pageProblems.join(" "), /page 99 is not in the PDF/);
});

/* ── Finding the list ─────────────────────────────────────────────────────── */

test("the price list is the one PDF linked from /mp", () => {
  assert.equal(priceListPdfUrl('<a href="https://framerusercontent.com/assets/abc.pdf">list</a>'), "https://framerusercontent.com/assets/abc.pdf");
  assert.throws(() => priceListPdfUrl("<p>no link</p>"), /found 0/);
  assert.throws(() => priceListPdfUrl('<a href="https://x/a.pdf"></a><a href="https://x/b.pdf"></a>'), /found 2/);
});
