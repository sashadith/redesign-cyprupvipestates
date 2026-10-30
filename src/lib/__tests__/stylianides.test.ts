import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tablesFromPages, unitsFromTable, validateMapping, type ColumnField, type PdfPage, type RawTable, type TableMapping, type TableUnit } from "@/lib/ai/availabilityTable";
import { findStylianidesPriceList, normalizeStylianidesTable, fixStylianidesMapping, refineStylianidesUnits, mergeTableUnits, refDrift } from "@/lib/stylianides";
import type { DropboxFile } from "@/lib/dropbox";

/* Stylianides Group's eight price lists as of 2026-10-30. The fixtures are the
   REAL pdf.js page data of those PDFs (scripts/qa/fixtures/stylianides/); the
   expected counts, statuses and prices below were read off the documents by a
   human. The one AI step, the column mapping, is supplied here as the answer the
   model gives for each layout and then goes through the real validateMapping —
   everything else is the production path: tablesFromPages → normalize →
   unitsFromTable → merge → refine. */

const FIXTURES = join(process.cwd(), "scripts/qa/fixtures/stylianides");
const pages = (name: string): PdfPage[] => JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8"));

type Col = ColumnField | [ColumnField, string];
function read(name: string, layouts: Col[][], unitKind: string) {
  const { tables } = tablesFromPages(pages(name));
  const perTable: TableUnit[][] = [];
  const normalized: RawTable[] = [];
  tables.forEach((raw, i) => {
    const t = normalizeStylianidesTable(raw);
    normalized.push(t);
    const layout = layouts[Math.min(i, layouts.length - 1)];
    assert.equal(t.headers.length, layout.length, `${name} table ${i + 1}: ${t.headers.length} columns, layout has ${layout.length}: ${JSON.stringify(t.headers)}`);
    const columns = layout.map((c) => (Array.isArray(c) ? c[0] : c));
    const labels = layout.map((c, j) => (Array.isArray(c) ? c[1] : t.headers[j]));
    const validated = validateMapping(t, columns);
    assert.deepEqual(validated.corrections, [], `${name}: the supplied mapping needed corrections`);
    const mapping: TableMapping = fixStylianidesMapping({ title: "", unitKind, columns: validated.columns, labels, corrections: [] }, t.headers);
    const ext = unitsFromTable(t, mapping);
    assert.deepEqual(ext.dropped, [], `${name} table ${i + 1}: rows dropped`);
    perTable.push(ext.units);
  });
  const merged = mergeTableUnits(perTable, name);
  assert.deepEqual(merged.duplicates, []);
  return { tables: normalized, units: refineStylianidesUnits(merged.units) };
}

const by = (units: TableUnit[], ref: string) => { const u = units.find((x) => x.ref === ref); assert.ok(u, `unit ${ref} missing`); return u!; };
const refsWith = (units: TableUnit[], status: string) => units.filter((u) => u.status === status).map((u) => u.ref);
const APT: Col[] = ["ref", "beds", "areaInternal", "areaVeranda", "areaVerandaOpen", ["attr", "Common area"], ["attr", "Storage room"], "areaBuilt", "price"];

test("Mirror Residence: both buildings of one page, 36 apartments", () => {
  const { tables, units } = read("mirror", [APT], "Apartment");
  assert.equal(tables.length, 2);
  assert.equal(units.length, 36);
  assert.deepEqual(refsWith(units, "sold"), ["B101", "B102", "B103", "B104", "B201", "B301"]);
  assert.deepEqual(refsWith(units, "reserved"), ["A401", "B203", "B401", "B403"]);
  assert.equal(refsWith(units, "available").length, 26);
  assert.equal(by(units, "A101").price, 300000);
  assert.equal(by(units, "B502").price, 1050000);
  assert.equal(by(units, "A102").areaInternal, "95");
  assert.equal(by(units, "A102").floor, "1");
  assert.deepEqual(units.filter((u) => u.type === "Penthouse").map((u) => u.ref), ["A501", "A502", "B501", "B502"]);
  // The model's answer on the live run: unitKind with its quotes.
  assert.equal(read("mirror", [APT], '"Apartment"').units[0].type, "Apartment");
});

test("King's Resort: two pages, a separate euro-sign column, studios", () => {
  const KINGS: Col[] = ["ref", "beds", "areaInternal", "areaVeranda", ["attr", "Roof additional room"], "areaVerandaOpen", ["attr", "Common area"], ["attr", "Parking space no."], "areaBuilt", "price"];
  const { tables, units } = read("kings-resort", [KINGS], "Apartment");
  assert.equal(tables.length, 2);
  assert.ok(tables.every((t) => !t.rows.some((r) => r.includes("€"))), "the euro-sign column is gone");
  assert.equal(units.length, 74);
  assert.deepEqual(refsWith(units, "available").filter((r) => r.startsWith("A")), ["A403", "A404", "A602"]);
  assert.deepEqual(refsWith(units, "reserved"), ["A401", "A505", "A506"]);
  assert.equal(refsWith(units, "sold").length, 26);
  assert.equal(units.filter((u) => u.ref.startsWith("B") && u.status === "available").length, 42);
  assert.equal(by(units, "A403").price, 390000);
  assert.equal(by(units, "A602").price, 2700000);
  assert.equal(by(units, "B802").price, 2990000);
  const studio = by(units, "B103");
  assert.equal(studio.type, "Studio");
  assert.equal(studio.beds, "0");
  assert.deepEqual(units.filter((u) => u.type === "Penthouse").map((u) => u.ref), ["A601", "A602", "B801", "B802"]);
  assert.equal(by(units, "B801").floor, "8");
});

test("La Residenza, Palm Residence V, Residence 28: penthouses found from the top-floor terraces", () => {
  const la = read("la-residenza", [["ref", "beds", "baths", "areaInternal", "areaVeranda", ["attr", "Common area"], ["attr", "Store room"], "areaVerandaOpen", "areaBuilt", "price"]], "Apartment").units;
  assert.equal(la.length, 8);
  assert.deepEqual(refsWith(la, "available"), ["301", "302"]);
  assert.equal(by(la, "301").price, 970000);
  assert.deepEqual(la.filter((u) => u.type === "Penthouse").map((u) => u.ref), ["301", "302"]);

  const palm = read("palm-v", [["ref", "beds", "areaInternal", "areaVeranda", ["attr", "Store room"], ["attr", "Common area"], "areaVerandaOpen", "areaBuilt", "price"]], "Apartment").units;
  assert.equal(palm.length, 6);
  assert.deepEqual(refsWith(palm, "available"), ["302"]);
  assert.deepEqual(refsWith(palm, "reserved"), ["102", "301"]);
  assert.equal(by(palm, "302").price, 795000);
  assert.deepEqual(palm.filter((u) => u.type === "Penthouse").map((u) => u.ref), ["301", "302"]);

  const r28 = read("residence-28", [APT], "Apartment").units;
  assert.equal(r28.length, 28);
  assert.deepEqual(refsWith(r28, "available"), ["A401", "A402", "B401", "B402"]);
  assert.equal(by(r28, "B402").price, 1100000);
  assert.deepEqual(r28.filter((u) => u.type === "Penthouse").map((u) => u.ref), ["A401", "A402", "B401", "B402"]);
});

test("Harmony Villas and Melrose: SOLD/RESERVED printed in the completion column", () => {
  const HARMONY: Col[] = ["ref", "areaPlot", "beds", "baths", ["attr", "Internal ground floor"], ["attr", "Internal upper floor"], "areaVeranda", ["attr", "Covered parking"], "areaVerandaOpen", "areaBuilt", ["attr", "Pool"], "price", ["attr", "Completion"], ["attr", "model got this wrong"]];
  const h = read("harmony", [HARMONY], "Villa").units;
  assert.equal(h.length, 14);
  assert.deepEqual(refsWith(h, "available"), ["1", "2", "3", "7", "8", "9", "10", "11", "12"]);
  assert.deepEqual(refsWith(h, "reserved"), ["5"]);
  assert.deepEqual(refsWith(h, "sold"), ["4", "6", "13", "14"]);
  assert.equal(by(h, "7").price, 335000);
  assert.equal(by(h, "1").areaInternal, "164", "76 + 88");
  assert.equal(by(h, "4").areaInternal, "105", "a bungalow: ground floor only");
  assert.ok(!by(h, "4").attrs.some((a) => a.name === "Completion" && /sold/i.test(a.value)), "the status left the completion column");
  assert.ok(by(h, "1").attrs.some((a) => a.name === "Completion" && a.value === "18 months"));
  assert.ok(h.every((u) => u.type === "Villa" && !u.floor));
  // What the model actually answered on 2026-10-30: the ground floor as "the" interior.
  const asMapped = read("harmony", [HARMONY.map((c, i) => (i === 4 ? (["areaInternal", "Internal Gr. Floor Area M2"] as Col) : c))], "Villa").units;
  assert.equal(by(asMapped, "1").areaInternal, "164", "the ground floor is not the interior, the added sum is");
  assert.ok(!by(asMapped, "1").attrs.some((a) => /floor/i.test(a.name)), "the per-floor parts are not specs");
  // A non-floor column taken as the interior (here the TOTAL) must lose to the added sum, not win by coming first.
  const totalAsInterior = read("harmony", [HARMONY.map((c, i) => (i === 9 ? (["areaInternal", "Total Cover Area"] as Col) : c))], "Villa").units;
  assert.equal(by(totalAsInterior, "1").areaInternal, "164");

  const MELROSE: Col[] = ["ref", "beds", "areaPlot", ["attr", "Basement"], ["attr", "Internal ground floor"], ["attr", "Internal 1st floor"], "areaVeranda", ["attr", "Covered parking"], "areaVerandaOpen", "areaBuilt", ["attr", "Swimming pool"], "price", ["attr", "Completion"], ["attr", "model got this wrong"]];
  const m = read("melrose", [MELROSE], "Villa").units;
  assert.equal(m.length, 8);
  assert.deepEqual(refsWith(m, "available"), ["1", "3a", "4a", "4c", "4d"]);
  assert.deepEqual(refsWith(m, "reserved"), ["2"]);
  assert.deepEqual(refsWith(m, "sold"), ["3b", "4b"]);
  assert.equal(by(m, "4d").price, 1700000);
  assert.equal(by(m, "4d").beds, "4 / 6", "\"4. / 6\" tidied");
  assert.equal(by(m, "1").areaInternal, "326", "166 + 160, basement not counted");
});

test("Trianon: plot-group rows are not reported as dropped units", () => {
  // Columns 7–12 as the model answered them live on 2026-10-30 — ground-floor
  // interior as "covered veranda", the floor labels swapped — plus the three
  // added totals answered wrongly on purpose: none of it may reach a unit.
  const TRIANON: Col[] = [["attr", "Plot"], "ref", ["ignore", "No."], "areaPlot", "beds", "baths", ["attr", "Basement covered area"],
    ["areaVeranda", "Covered Area M2"], ["attr", "Ground Floor Covered Veranda Area M2"], "areaVerandaOpen", ["attr", "Ground Floor Covered Area M2"],
    ["attr", "1st Floor Covered Veranda Area M2"], ["attr", "1st Floor Uncovered Veranda Area M2"], ["attr", "Covered parking"], "areaBuilt", "price",
    ["ignore", "x"], ["attr", "y"], ["attr", "z"]];
  const { tables, units } = read("trianon", [TRIANON], "Villa");
  assert.deepEqual(tables[0].strayRows, []);
  assert.equal(units.length, 16);
  assert.deepEqual(refsWith(units, "reserved"), ["6D"]);
  assert.deepEqual(refsWith(units, "sold"), ["8A", "9A", "9D"]);
  assert.equal(refsWith(units, "available").length, 12);
  assert.equal(by(units, "6E").price, 3450000);
  assert.equal(by(units, "6A").areaInternal, "263", "130 + 133, basement and verandas not counted");
  assert.equal(by(units, "9A").areaInternal, "197", "no basement: 96 + 101");
  assert.equal(by(units, "6A").areaVeranda, "59", "covered verandas 30 + 29");
  assert.equal(by(units, "6A").areaVerandaOpen, "70", "70 + 0");
  assert.equal(by(units, "8B").areaVerandaOpen, "60", "30 + 30");
  assert.ok(by(units, "6A").attrs.some((a) => a.name === "Basement covered area" && a.value === "260"), "the basement stays a spec");
  assert.ok(!by(units, "6A").attrs.some((a) => /floor/i.test(a.name)), "no per-floor specs with the model's swapped labels");
});

test("the price list is the dated PDF at the root, not the brochure or an analysis", () => {
  const f = (name: string, modifiedTime = "2026-10-01T00:00:00Z"): DropboxFile => ({ id: `/${name}`, name, mimeType: "application/pdf", modifiedTime });
  const pick = (files: DropboxFile[]) => findStylianidesPriceList(files)?.name ?? null;
  assert.equal(pick([f("MIRROR_RESIDENCE  BLD A & B 27-10-2026.pdf")]), "MIRROR_RESIDENCE  BLD A & B 27-10-2026.pdf");
  assert.equal(pick([f("SOUNI VILLAS 24-09-2026.pdf"), { ...f("HARMONY VILLAS - SOUNI.docx"), mimeType: "x" }]), "SOUNI VILLAS 24-09-2026.pdf");
  assert.equal(pick([f("La Residenza Pictures.pdf"), f("LA RESIDENZA PRICE LIST  SEPT 2026.pdf")]), "LA RESIDENZA PRICE LIST  SEPT 2026.pdf");
  assert.equal(pick([f("KR_TOWERS_BROCHURE_NEW_PLANS.pdf"), f("KINGS RESORT ARCH PLANS.pdf"), f("THE KING RESIDENCE  PRICE LIST TOWER A -B - 16-07-26 1.pdf")]), "THE KING RESIDENCE  PRICE LIST TOWER A -B - 16-07-26 1.pdf");
  assert.equal(pick([f("RIVERSIDE BUSINESS CENTRE  ANALYSIS OCT 26.pdf"), f("Riverside Business Park Mini-Brochure.pdf")]), null);
  assert.equal(pick([f("X PRICE LIST 01-09-2026.pdf", "2026-09-01T00:00:00Z"), f("X PRICE LIST 28-10-2026.pdf", "2026-10-29T00:00:00Z")]), "X PRICE LIST 28-10-2026.pdf", "newest wins");
});

test("a reference drift refuses the write; a normal list passes", () => {
  const existing = ["6A", "6B", "6C", "6D", "6E", "7A"];
  assert.equal(refDrift(existing, ["6A", "6B", "6C", "6D", "6E", "7A", "7B"], "Trianon"), null);
  assert.equal(refDrift(existing, ["6A", "6B", "6C"], "Trianon"), null, "half kept is still a list");
  assert.match(refDrift(existing, ["12", "13", "14", "15", "16", "17"], "Trianon") ?? "", /only 0 of 6/);
  assert.equal(refDrift(["1", "2"], ["9"], "X"), null, "too few to judge");
});
