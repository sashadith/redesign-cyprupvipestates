import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DTA_PROJECTS, dtaFeedKey, findDtaProjectFolder, findDtaPriceFolder, findDtaPriceList,
  parseDtaPriceList, planDtaWrite, priceRangeAfter, type DtaExistingUnit,
} from "@/lib/dta";
import type { DropboxFile } from "@/lib/dropbox";

/* DTA Group's price lists, as SYNTHETIC rows modelled on the two texts observed
   on 2026-11-13 (row = the cells' texts, left to right, as the pdf.js worker
   groups them): Athina — a full table, refs 101–110 / 201–210, last cell a price
   or SOLD / RESERVED, "Last updated: 12/11/2026" in the header; iHome — only the
   units for sale, price followed by "VAT paid". Prices and areas are invented. */

const F = "application/vnd.dropbox.folder";
const dir = (name: string, path = `/${name}`): DropboxFile => ({ id: path, name, mimeType: F, modifiedTime: "" });
const pdf = (name: string, modifiedTime = "2026-11-12T10:00:00Z", path = `/x/${name}`): DropboxFile => ({ id: path, name, mimeType: "application/pdf", modifiedTime });
const project = (slug: string) => DTA_PROJECTS.find((p) => p.slug === slug)!;

const ATHINA_HEADER = [
  ["ATHINA RESIDENCES — PRICE LIST"],
  ["Last updated: 12/11/2026"],
  ["UNIT", "BEDROOMS", "INTERNAL AREA m²", "COVERED VERANDA m²", "TOTAL COVERED m²", "STORAGE m²", "PRICE €"],
];
// 101–110 and 201–210: a few available, the rest sold or reserved.
const athinaRow = (ref: string, outcome: string) => [ref, "1", "50.6", "10.5", "61.1", "4", outcome];
const ATHINA_OUTCOMES: Record<string, string> = {
  "101": "RESERVED", "102": "SOLD", "103": "SOLD", "104": "SOLD", "105": "RESERVED", "106": "RESERVED", "107": "180,000", "108": "SOLD", "109": "SOLD", "110": "SOLD",
  "201": "SOLD", "202": "SOLD", "203": "195,000", "204": "197,000", "205": "RESERVED", "206": "199,000", "207": "SOLD", "208": "SOLD", "209": "SOLD", "210": "SOLD",
};
const athinaRows = (outcomes = ATHINA_OUTCOMES) => [
  ...ATHINA_HEADER,
  ...Object.entries(outcomes).map(([ref, o]) => athinaRow(ref, o)),
  ["All prices are subject to VAT."],
  ["1"], // page number
];
const athinaDb = (): DtaExistingUnit[] =>
  Object.entries(ATHINA_OUTCOMES).map(([ref, o], i) => ({
    id: `ath-${ref}`, ref, beds: "1",
    status: /sold/i.test(o) ? "sold" : /reserved/i.test(o) ? "reserved" : "available",
    price: /\d/.test(o) ? Number(o.replace(/,/g, "")) : null,
    pinnedFields: [],
  }));

const IHOME_ROWS = [
  ["iHOME — PRICE LIST"],
  ["APT", "BEDS", "INTERNAL", "COVERED VERANDAS", "UNCOVERED VERANDAS", "TOTAL", "PRICE"],
  ["A701", "3", "122", "65", "9", "196", "2,785,000", "VAT paid"],
];
const ihomeDb = (): DtaExistingUnit[] => [
  { id: "ih-a101", ref: "A101", status: "available", price: 2_450_000, beds: "3", pinnedFields: [] },
  { id: "ih-a701", ref: "A701", status: "available", price: 2_700_000, beds: "3", pinnedFields: [] },
];

/* ── Finding the list ────────────────────────────────────────────────────── */

test("each project folder is found by name; ALTI, FOR RENT and the deck are not projects", () => {
  const root = [dir("IHOME"), dir("ONLY"), dir("LUMA"), dir("LEVEL"), dir("ATHINA"), dir("MANDARIN"), dir("ALTI"), dir("FOR RENT"), pdf("DTA Available for Sale Q4 2026.pdf")];
  for (const [slug, name] of [["ihome", "IHOME"], ["only-tower", "ONLY"], ["luma-residences", "LUMA"], ["level-residences", "LEVEL"], ["athina-residences", "ATHINA"], ["mandarin", "MANDARIN"]]) {
    assert.equal(findDtaProjectFolder(root, project(slug)).folder?.name, name, slug);
  }
  assert.ok(!DTA_PROJECTS.some((p) => /alti/i.test(p.slug)), "Alti has no price list and is left alone");
  assert.equal(DTA_PROJECTS.filter((p) => p.folder.test("FOR RENT")).length, 0);
  assert.equal(dtaFeedKey("athina-residences"), "manual:dta-athina-residences");
  const twice = findDtaProjectFolder([dir("ATHINA"), dir("ATHINA OLD")], project("athina-residences"));
  assert.equal(twice.folder, null);
  assert.match(twice.issue ?? "", /2 folders/);
});

test("the price-list subfolder has four spellings", () => {
  for (const n of ["Price List", "Price list", "Price lists", "Pricelist"]) {
    assert.equal(findDtaPriceFolder([dir("Photos"), dir("Presentation"), dir(n)])?.name, n);
  }
  assert.equal(findDtaPriceFolder([dir("Photos"), pdf("Price List.pdf")]), null, "a file is not the folder");
});

test("LEVEL: the residences list is ours, the plots list never", () => {
  const files = [pdf("LEVEL PLOTS Price List.pdf", "2026-11-12T00:00:00Z"), pdf("LEVEL RESIDENCES Price List.pdf", "2026-10-01T00:00:00Z")];
  assert.equal(findDtaPriceList(files, project("level-residences")).file?.name, "LEVEL RESIDENCES Price List.pdf");
  assert.equal(findDtaPriceList([pdf("LEVEL PLOTS Price List.pdf")], project("level-residences")).file, null);
  const two = findDtaPriceList([pdf("Athina old.pdf", "2026-10-23T00:00:00Z"), pdf("Athina Price List.pdf", "2026-11-12T00:00:00Z")], project("athina-residences"));
  assert.equal(two.file?.name, "Athina Price List.pdf", "newest wins");
  assert.deepEqual(two.others, ["Athina old.pdf"]);
});

/* ── Reading ─────────────────────────────────────────────────────────────── */

test("Athina: a full table — 20 units, price or SOLD/RESERVED, the list date", () => {
  const p = parseDtaPriceList(athinaRows(), [], "Athina Residences");
  assert.equal(p.units.length, 20);
  assert.deepEqual(p.unreadable, []);
  assert.equal(p.listDate, "2026-11-12");
  const u = (ref: string) => p.units.find((x) => x.ref === ref)!;
  assert.deepEqual([u("107").status, u("107").price], ["available", 180000]);
  assert.deepEqual([u("101").status, u("101").price], ["reserved", null]);
  assert.deepEqual([u("210").status, u("210").price], ["sold", null]);
  assert.equal(u("203").beds, "1");
});

test("iHome: only the units for sale, 'VAT paid' after the price (also glued into one item)", () => {
  const p = parseDtaPriceList(IHOME_ROWS, ["A101", "A701"], "iHOME");
  assert.deepEqual(p.units.map((x) => [x.ref, x.status, x.price]), [["A701", "available", 2785000]]);
  const glued = parseDtaPriceList([["A701", "3", "122", "65", "196", "2,785,000 VAT paid"]], [], "iHOME");
  assert.equal(glued.units[0]?.price, 2785000);
  const euro = parseDtaPriceList([["A701", "3", "122", "65", "196", "€", "2,785,000", "+ VAT"]], [], "iHOME");
  assert.equal(euro.units[0]?.price, 2785000);
});

test("a status column left of the price wins over the price", () => {
  const p = parseDtaPriceList([["101", "2", "91.5", "29.3", "RESERVED", "526,000"]], [], "Mandarin");
  assert.deepEqual([p.units[0].status, p.units[0].price], ["reserved", null]);
});

test("unreadable rows are collected, page numbers and prose are not", () => {
  const p = parseDtaPriceList([
    ["2"],                                              // page number
    ["12", "units remaining"],                          // prose that starts with a number
    ["105", "1", "49.3", "13.8", "62.0", "TBC"],        // a real row without an outcome
    ["106", "1", "49.3", "13.8", "62.0", "950"],        // "price" too small to be one
    ["107", "1", "49.3", "13.8", "180,000"],
  ], ["101"], "Athina Residences");
  assert.deepEqual(p.units.map((u) => u.ref), ["107"]);
  assert.equal(p.unreadable.length, 2);
});

test("a short row that starts with a reference we HOLD must be read (a split two-line row)", () => {
  const rows = [["A701"], ["3", "122", "65", "196", "2,785,000"]];
  const p = parseDtaPriceList(rows, ["A701"], "iHOME");
  assert.deepEqual(p.unreadable, ["A701"]);
  assert.match(planDtaWrite(ihomeDb(), p, "iHOME").refusal ?? "", /could not be read/);
  const glued = parseDtaPriceList([["A701 3", "122", "65", "2,785,000"]], ["A701"], "iHOME");
  assert.equal(glued.unreadable.length, 1, "a held ref glued to the next cell is not skipped");
});

test("the same ref twice: identical collapses, different outcomes conflict", () => {
  assert.deepEqual(parseDtaPriceList([athinaRow("107", "180,000"), athinaRow("107", "180,000")], [], "A").conflicts, []);
  assert.deepEqual(parseDtaPriceList([athinaRow("107", "180,000"), athinaRow("107", "SOLD")], [], "A").conflicts, ["107"]);
});

/* ── Planning the write ──────────────────────────────────────────────────── */

const plan = (rows: string[][], db: DtaExistingUnit[], name: string) =>
  planDtaWrite(db, parseDtaPriceList(rows, db.map((u) => u.ref!), name), name);

test("Athina unchanged → nothing to write; one sale → one status change", () => {
  const same = plan(athinaRows(), athinaDb(), "Athina Residences");
  assert.equal(same.refusal, null);
  assert.equal(same.fullTable, true);
  assert.deepEqual(same.updates, []);
  assert.deepEqual(same.unlist, []);

  const sold = plan(athinaRows({ ...ATHINA_OUTCOMES, "107": "SOLD", "204": "205,000" }), athinaDb(), "Athina Residences");
  assert.equal(sold.refusal, null);
  assert.deepEqual(sold.updates.map((u) => [u.ref, u.data]), [
    ["107", { status: "sold", price: null }],
    ["204", { status: "available", price: 205000 }],
  ]);
});

test("iHome: a unit missing from a for-sale list becomes unlisted; sold stays sold", () => {
  const db = [...ihomeDb(), { id: "ih-a501", ref: "A501", status: "sold", price: null, beds: "3", pinnedFields: [] }];
  const p = plan(IHOME_ROWS, db, "iHOME");
  assert.equal(p.refusal, null);
  assert.equal(p.fullTable, false);
  assert.deepEqual(p.unlist, [{ id: "ih-a101", ref: "A101" }]);
  assert.deepEqual(p.updates.map((u) => [u.ref, u.data]), [["A701", { status: "available", price: 2785000 }]]);
  assert.deepEqual(priceRangeAfter(db, p), { priceFrom: 2785000, priceTo: 2785000 });
});

test("an unlisted unit that is listed again comes back", () => {
  const db = ihomeDb().map((u) => (u.ref === "A701" ? { ...u, status: "unlisted" } : u));
  const p = plan([...IHOME_ROWS, ["A101", "3", "122", "47", "195", "2,450,000", "VAT paid"]], db, "iHOME");
  assert.equal(p.refusal, null);
  assert.deepEqual(p.updates.map((u) => [u.ref, u.data.status]), [["A701", "available"]]);
});

test("pins are honoured: a pinned status is neither written nor unlisted", () => {
  const db = athinaDb().map((u) => (u.ref === "107" ? { ...u, status: "reserved", price: null, pinnedFields: ["status"] } : u));
  const p = plan(athinaRows(), db, "Athina Residences");
  assert.equal(p.refusal, null);
  const w = p.updates.find((u) => u.ref === "107");
  assert.ok(w, "the price still follows the list");
  assert.equal("status" in w!.data, false);
  assert.ok(p.issues.some((i) => /107: pinned status kept/.test(i)));

  const ih = ihomeDb().map((u) => (u.ref === "A101" ? { ...u, pinnedFields: ["status"] } : u));
  assert.deepEqual(plan(IHOME_ROWS, ih, "iHOME").unlist, []);
});

test("a bedroom mismatch is reported, never written", () => {
  const db = ihomeDb().map((u) => (u.ref === "A701" ? { ...u, beds: "2" } : u));
  const p = plan(IHOME_ROWS, db, "iHOME");
  assert.ok(p.issues.some((i) => /A701: list says 3 bedroom/.test(i)));
  assert.ok(p.updates.every((u) => !("beds" in u.data)));
});

/* ── The guards. Each one is mutation-tested below: with the guard removed the
      same input would write, which is checked by asserting what the plan would
      otherwise have done. ──────────────────────────────────────────────────── */

test("GUARD no units: a list that yields nothing writes nothing (and would otherwise unlist everything)", () => {
  const empty = plan([["ATHINA RESIDENCES — PRICE LIST"], ["Prices on request"]], athinaDb(), "Athina Residences");
  assert.match(empty.refusal ?? "", /no units/);
  assert.deepEqual([empty.updates, empty.unlist], [[], []]);
  // Mutation: the same DB against a list of ONE row of its own (so the no-units guard
  // cannot fire) shows what an unguarded empty read would do — every unit for sale
  // vanishes. For a for-sale list that is a wholesale unlisting, caught by drift.
  const one = plan([athinaRow("107", "180,000")], athinaDb().map((u) => ({ ...u, status: u.status === "sold" ? "sold" : "available" })), "Athina Residences");
  assert.match(one.refusal ?? "", /only 1 of 8/);
});

test("GUARD unreadable row: one row we cannot read refuses the whole project", () => {
  const rows = athinaRows().map((r) => (r[0] === "203" ? ["203", "1", "50.6", "10.5", "61.1", "4", "price on request"] : r));
  const p = plan(rows, athinaDb(), "Athina Residences");
  assert.match(p.refusal ?? "", /could not be read/);
  assert.deepEqual([p.updates, p.unlist], [[], []]);
});

test("GUARD stranger refs: a list of refs the DB does not hold writes nothing", () => {
  // A shifted first column — a running number 1..20 read as the reference.
  const shifted = Object.entries(ATHINA_OUTCOMES).map(([, o], i) => [String(i + 1), "1", "50.6", "10.5", "61.1", "4", o]);
  const p = plan([...ATHINA_HEADER, ...shifted], athinaDb(), "Athina Residences");
  assert.match(p.refusal ?? "", /not in the database/);
  assert.deepEqual([p.updates, p.unlist], [[], []]);
  // Even one stranger among known refs refuses: no unit is ever created here.
  const plusOne = plan([...IHOME_ROWS, ["B801", "4", "180", "70", "250", "3,900,000"]], ihomeDb(), "iHOME");
  assert.match(plusOne.refusal ?? "", /B801/);
});

test("GUARD full-table gap: a full table that lost a unit for sale writes nothing", () => {
  const rows = athinaRows().filter((r) => r[0] !== "206");
  const p = plan(rows, athinaDb(), "Athina Residences");
  assert.match(p.refusal ?? "", /full table.*206/);
  assert.deepEqual([p.updates, p.unlist], [[], []]);
  // Mutation: the same gap in a list WITHOUT sold rows is a for-sale list, and the
  // unit is unlisted — proof that it is this guard, not another, that held it.
  const forSale = athinaRows(Object.fromEntries(Object.entries(ATHINA_OUTCOMES).filter(([, o]) => /\d/.test(o))))
    .filter((r) => r[0] !== "206");
  const db = athinaDb().map((u) => (u.status === "reserved" ? { ...u, status: "sold" } : u));
  const fs = plan(forSale, db, "Athina Residences");
  assert.equal(fs.refusal, null);
  assert.deepEqual(fs.unlist.map((u) => u.ref), ["206"]);
});

test("GUARD drift: fewer than half of the units for sale still listed writes nothing", () => {
  const db: DtaExistingUnit[] = ["101", "102", "103", "104", "105"].map((ref) => ({ id: ref, ref, status: "available", price: 500000, beds: "2", pinnedFields: [] }));
  const rows = [["101", "2", "90", "20", "500,000"], ["102", "2", "90", "20", "500,000"]];
  const p = plan(rows, db, "ONLY Tower");
  assert.match(p.refusal ?? "", /only 2 of 5/);
  assert.deepEqual([p.updates, p.unlist], [[], []]);
  // Mutation: one more unit kept (3 of 5) crosses the threshold and the two missing are unlisted.
  const ok = plan([...rows, ["103", "2", "90", "20", "500,000"]], db, "ONLY Tower");
  assert.equal(ok.refusal, null);
  assert.deepEqual(ok.unlist.map((u) => u.ref), ["104", "105"]);
});

test("GUARD conflicting duplicates refuse", () => {
  const p = plan([...IHOME_ROWS, ["A701", "3", "122", "65", "196", "SOLD"]], ihomeDb(), "iHOME");
  assert.match(p.refusal ?? "", /listed twice/);
});

test("price range follows the units after the write; sold out = no range", () => {
  const db = athinaDb();
  const p = plan(athinaRows({ ...ATHINA_OUTCOMES, "107": "SOLD" }), db, "Athina Residences");
  assert.deepEqual(priceRangeAfter(db, p), { priceFrom: 195000, priceTo: 199000 });
  const allSold = Object.fromEntries(Object.keys(ATHINA_OUTCOMES).map((k) => [k, "SOLD"]));
  const q = plan(athinaRows(allSold), db, "Athina Residences");
  assert.equal(q.refusal, null);
  assert.deepEqual(priceRangeAfter(db, q), { priceFrom: null, priceTo: null });
});
