import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DTA_PROJECTS, dtaFeedKey, findDtaProjectFolder, findDtaPriceFolder, findDtaPriceList,
  parseDtaPriceList, planDtaWrite, priceRangeAfter, type DtaExistingUnit, type DtaParse,
} from "@/lib/dta";
import type { DropboxFile } from "@/lib/dropbox";
import type { PdfPage } from "@/lib/ai/availabilityTable";

/* DTA Group's six price lists as of 2026-11-13. The fixtures are the REAL pdf.js
   page data of those PDFs (scripts/qa/fixtures/dta/<slug>.json, written by
   scripts/qa/dta-local-dry-run.mjs --rows); the expected refs, statuses and prices
   below were read off the documents. The "database" is the 2026-10-29 import
   (scripts/data/dta/2026-10-29.json). Since then exactly two things happened:
   Athina 204 was reserved, and iHOME A101 sold (it left the for-sale list). */

const FIXTURES = join(process.cwd(), "scripts/qa/fixtures/dta");
const pages = (slug: string): PdfPage[] => JSON.parse(readFileSync(join(FIXTURES, `${slug}.json`), "utf8"));
const DATA = JSON.parse(readFileSync(join(process.cwd(), "scripts/data/dta/2026-10-29.json"), "utf8"));
const project = (slug: string) => DTA_PROJECTS.find((p) => p.slug === slug)!;
const dbOf = (slug: string): DtaExistingUnit[] =>
  DATA.projects.find((p: { slug: string }) => p.slug === slug).units.map((u: { ref: string; status: string; price?: number | null; beds?: number | null }) => ({
    id: `${slug}:${u.ref}`, ref: u.ref, status: u.status, price: u.price ?? null, beds: u.beds != null ? String(u.beds) : null, pinnedFields: [],
  }));
const read = (slug: string, pg = pages(slug), db = dbOf(slug)) => parseDtaPriceList(pg, db.map((u) => u.ref!), project(slug).name);
const planFor = (slug: string, pg = pages(slug), db = dbOf(slug)) => planDtaWrite(db, read(slug, pg, db), project(slug).name);
const triples = (p: DtaParse) => p.units.map((u) => [u.ref, u.status, u.price] as const);
const S = (ref: string) => [ref, "sold", null] as const;
const R = (ref: string) => [ref, "reserved", null] as const;
const A = (ref: string, price: number) => [ref, "available", price] as const;

/* ── The six real lists, unit by unit ────────────────────────────────────── */

test("Athina (12/11/2026): 20 units over two pages; floor labels and header fragments are not units", () => {
  const p = read("athina-residences");
  assert.deepEqual(p.unreadable, []);
  assert.equal(p.listDate, "2026-11-12");
  assert.deepEqual(p.tablePages, [1, 2]);
  assert.deepEqual(triples(p), [
    R("101"), S("102"), S("103"), S("104"), R("105"), R("106"), A("107", 180000), S("108"), S("109"), S("110"),
    S("201"), S("202"), A("203", 190000), R("204"), R("205"), A("206", 295000), S("207"), S("208"), S("209"), S("210"),
  ]);
  assert.deepEqual(p.units.map((u) => u.beds).join(""), "12112212211211221221");
});

test("Mandarin (23/10/2026): 34 units; prices drawn in pieces are joined", () => {
  const p = read("mandarin");
  assert.deepEqual(p.unreadable, []);
  assert.equal(p.listDate, "2026-10-23");
  assert.deepEqual(triples(p), [
    A("101", 584000), A("102", 526000), R("103"), A("104", 526000), A("105", 510000), R("106"), R("107"), A("108", 303000), R("109"),
    A("201", 595500), A("202", 537500), R("203"), A("204", 537500), A("205", 521500), R("206"), A("207", 303500), R("208"), A("209", 303500),
    A("301", 607000), R("302"), S("303"), A("304", 549000), A("305", 533000), R("306"), A("307", 311500), A("308", 314500), R("309"),
    S("401"), R("402"), R("403"), A("404", 544500), R("405"), R("406"), R("407"),
  ]);
});

test("iHOME (30/10/2026): only A701 left; the Floor column is never the bedrooms", () => {
  const p = read("ihome");
  assert.deepEqual(p.unreadable, []);
  assert.equal(p.listDate, "2026-10-30");
  assert.deepEqual(triples(p), [A("A701", 2785000)]);
  assert.equal(p.units[0].beds, "3", "the list's Floor column says 7");
});

test("ONLY Tower (26/10/2026): 101 and 203; floor labels in the row, '2 with roof garden' bedrooms", () => {
  const p = read("only-tower");
  assert.deepEqual(p.unreadable, []);
  assert.equal(p.listDate, "2026-10-26");
  assert.deepEqual(triples(p), [A("101", 830000), A("203", 850000)]);
  assert.deepEqual(p.units.map((u) => u.beds), ["3", "2"]);
});

test("Level Residences (29/09/2026): houses 12–16; '6' + '90,000' is €690,000", () => {
  const p = read("level-residences");
  assert.deepEqual(p.unreadable, []);
  assert.equal(p.listDate, "2026-09-29");
  assert.deepEqual(triples(p), [A("12", 690000), A("13", 690000), S("14"), S("15"), S("16")]);
});

test("Luma Residences (19/03/2026): 5 units; the 'Apartment proportion' column is not the reference", () => {
  const p = read("luma-residences");
  assert.deepEqual(p.unreadable, []);
  assert.equal(p.listDate, "2026-03-19");
  assert.deepEqual(triples(p), [S("101"), A("102", 1900000), S("201"), S("301"), S("302")]);
  assert.deepEqual(p.units.map((u) => u.beds), ["3", "3", "3", "4", "3"]);
});

test("the dry run against the 2026-10-29 database: exactly the two real changes, nothing refused", () => {
  const out: Record<string, string[]> = {};
  for (const p of DTA_PROJECTS) {
    const plan = planFor(p.slug);
    assert.equal(plan.refusal, null, `${p.slug}: ${plan.refusal}`);
    assert.deepEqual(plan.issues, [], p.slug);
    out[p.slug] = [...plan.updates.map((u) => `${u.ref}: ${u.changes.join(", ")}`), ...plan.unlist.map((u) => `${u.ref}: unlisted`)];
  }
  assert.deepEqual(out, {
    "mandarin": [],
    "athina-residences": ["204: status available→reserved, price €185,000→—"],
    "ihome": ["A101: unlisted"],
    "only-tower": [],
    "level-residences": [],
    "luma-residences": [],
  });
});

/* ── Mutations of the real lists: each guard holds on real geometry ──────── */

const clone = (pg: PdfPage[]): PdfPage[] => JSON.parse(JSON.stringify(pg));
const editCells = (pg: PdfPage[], fn: (t: string, x: number, rowCells: { t: string }[]) => string | null): PdfPage[] =>
  clone(pg).map((p) => ({ ...p, rows: p.rows.map((r) => ({ ...r, cells: r.cells.map((c) => ({ ...c, t: fn(c.t, c.x, r.cells) ?? c.t })) })) }));

test("PRICE GUARD: Level read as '90,000' (the leading '6' lost) is refused, never written", () => {
  // Drop the separate "6" item of houses 12 and 13: what the first reader effectively did.
  const pg = clone(pages("level-residences")).map((p) => ({ ...p, rows: p.rows.map((r) => ({ ...r, cells: r.cells.filter((c) => !(c.t === "6" && c.x > 500)) })) }));
  const p = read("level-residences", pg);
  assert.deepEqual(triples(p).slice(0, 2), [A("12", 90000), A("13", 90000)], "the misread itself");
  const plan = planFor("level-residences", pg);
  assert.match(plan.refusal ?? "", /implausible price.*12 €690,000→€90,000 \(-87 %\)/);
  assert.deepEqual([plan.updates, plan.unlist], [[], []]);
});

test("PRICE GUARD: a +41 % move refuses, a +39 % move writes", () => {
  const db = dbOf("ihome").map((u) => (u.ref === "A701" ? { ...u, price: 1_975_000 } : u)); // 2,785,000 is +41 %
  assert.match(planFor("ihome", pages("ihome"), db).refusal ?? "", /A701 €1,975,000→€2,785,000 \(\+41 %\)/);
  const ok = dbOf("ihome").map((u) => (u.ref === "A701" ? { ...u, price: 2_004_000 } : u)); // +39 %
  assert.equal(planFor("ihome", pages("ihome"), ok).refusal, null);
});

test("PRICE GUARD: a price below €50,000 is never a price (read as unreadable)", () => {
  const pg = editCells(pages("athina-residences"), (t) => (t === "180,000" ? "18,000" : null));
  const plan = planFor("athina-residences", pg);
  assert.match(plan.refusal ?? "", /could not be read.*107/);
});

test("PRICE GUARD: a unit back on sale with no stored price must fit the list's other prices", () => {
  const db = dbOf("athina-residences").map((u) => (u.ref === "107" ? { ...u, status: "reserved", price: null } : u));
  assert.equal(planFor("athina-residences", pages("athina-residences"), db).refusal, null, "€180,000 beside €190,000–€295,000 is fine");
  const pg = editCells(pages("athina-residences"), (t) => (t === "180,000" ? "1,800,000" : null));
  assert.match(planFor("athina-residences", pg, db).refusal ?? "", /107 €1,800,000 \(no stored price\)/);
});

test("FULL-TABLE GUARD: Mandarin with one row lost writes nothing", () => {
  const pg = clone(pages("mandarin")).map((p) => ({ ...p, rows: p.rows.filter((r) => !r.cells.some((c) => c.t === "205")) }));
  const plan = planFor("mandarin", pg);
  assert.match(plan.refusal ?? "", /full table.*205/);
  assert.deepEqual([plan.updates, plan.unlist], [[], []]);
});

test("STRANGER GUARD: a list whose references the database does not hold writes nothing", () => {
  const plan = planFor("athina-residences", pages("athina-residences"), dbOf("mandarin"));
  assert.match(plan.refusal ?? "", /not in the database/);
});

test("UNREADABLE GUARD: a unit row whose price cell is gone refuses", () => {
  const pg = editCells(pages("mandarin"), (t) => (t === "526,000" ? "on request" : null));
  assert.match(planFor("mandarin", pg).refusal ?? "", /could not be read.*102/);
});

test("NO-UNITS GUARD: a list without a recognisable header writes nothing", () => {
  const pg = editCells(pages("luma-residences"), (t) => (/^unit$/i.test(t) ? "Ref" : null));
  const p = read("luma-residences", pg);
  assert.deepEqual(p.tablePages, []);
  // The units' rows are still there, outside any table: refs we hold turn up as unreadable.
  assert.ok(p.unreadable.length >= 1);
  assert.match(planDtaWrite(dbOf("luma-residences"), p, "Luma Residences").refusal ?? "", /no units/);
});

/* ── Finding the list ────────────────────────────────────────────────────── */

const F = "application/vnd.dropbox.folder";
const dir = (name: string, path = `/${name}`): DropboxFile => ({ id: path, name, mimeType: F, modifiedTime: "" });
const pdf = (name: string, modifiedTime = "2026-11-12T10:00:00Z", path = `/x/${name}`): DropboxFile => ({ id: path, name, mimeType: "application/pdf", modifiedTime });

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

/* ── The plan's own rules, on a small synthetic table ────────────────────── */

// One header line "Unit | Bedrooms | Internal | Price (€)" and one line per unit,
// columns 60 pt apart, rows 20 pt apart — the geometry the reader expects.
function synth(rows: string[][]): PdfPage[] {
  const all = [["Unit", "Bedrooms", "Internal", "Price (€)"], ...rows];
  return [{ page: 1, width: 595, height: 842, rows: all.map((r, i) => ({ y: 700 - i * 20, cells: r.map((t, j) => ({ x: 40 + Math.min(j, 3) * 60 + Math.max(0, j - 3) * 30, w: 20, t })) })) }];
}
const unit = (ref: string, status: string, price: number | null, extra: Partial<DtaExistingUnit> = {}): DtaExistingUnit =>
  ({ id: ref, ref, status, price, beds: "2", pinnedFields: [], ...extra });
const synthPlan = (rows: string[][], db: DtaExistingUnit[], name = "X") => planDtaWrite(db, parseDtaPriceList(synth(rows), db.map((u) => u.ref!), name), name);

test("a for-sale list: missing → unlisted, sold stays sold, an unlisted unit listed again comes back", () => {
  const db = [unit("101", "available", 500000), unit("102", "available", 500000), unit("103", "sold", null), unit("104", "unlisted", 510000)];
  const p = synthPlan([["101", "2", "90", "500,000"], ["104", "2", "90", "510,000", "VAT paid"]], db);
  assert.equal(p.refusal, null);
  assert.deepEqual(p.unlist.map((u) => u.ref), ["102"]);
  assert.deepEqual(p.updates.map((u) => [u.ref, u.data]), [["104", { status: "available", price: 510000 }]]);
  assert.deepEqual(priceRangeAfter(db, p), { priceFrom: 500000, priceTo: 510000 });
});

test("pins are honoured: a pinned status is neither written nor unlisted", () => {
  const db = [unit("101", "reserved", null, { pinnedFields: ["status"] }), unit("102", "available", 500000, { pinnedFields: ["status"] })];
  const p = synthPlan([["101", "2", "90", "500,000"]], db);
  assert.equal(p.refusal, null);
  assert.deepEqual(p.updates.map((u) => [u.ref, u.data]), [["101", { price: 500000 }]]);
  assert.deepEqual(p.unlist, []);
  assert.ok(p.issues.some((i) => /101: pinned status kept/.test(i)));
  assert.ok(p.issues.some((i) => /102: no longer in the list, but its status is pinned/.test(i)));
});

test("a bedroom mismatch is reported, never written", () => {
  const p = synthPlan([["101", "3", "90", "500,000"]], [unit("101", "available", 500000)]);
  assert.ok(p.issues.some((i) => /101: list says 3 bedroom/.test(i)));
  assert.deepEqual(p.updates, []);
});

test("DRIFT GUARD: fewer than half of the units for sale still listed writes nothing; 3 of 5 writes", () => {
  const db = ["101", "102", "103", "104", "105"].map((r) => unit(r, "available", 500000));
  const rows = [["101", "2", "90", "500,000"], ["102", "2", "90", "500,000"]];
  assert.match(synthPlan(rows, db).refusal ?? "", /only 2 of 5/);
  const ok = synthPlan([...rows, ["103", "2", "90", "500,000"]], db);
  assert.equal(ok.refusal, null);
  assert.deepEqual(ok.unlist.map((u) => u.ref), ["104", "105"]);
});

test("CONFLICT GUARD: the same ref twice with different outcomes refuses; identical twice collapses", () => {
  const db = [unit("101", "available", 500000)];
  assert.equal(synthPlan([["101", "2", "90", "500,000"], ["101", "2", "90", "500,000"]], db).refusal, null);
  assert.match(synthPlan([["101", "2", "90", "500,000"], ["101", "2", "90", "SOLD"]], db).refusal ?? "", /listed twice/);
});

test("a held reference glued to the next item, or a short row of it, is unreadable — never skipped", () => {
  const db = [unit("A701", "available", 2785000)];
  const glued = parseDtaPriceList(synth([["A701 3", "", "90", "2,785,000"]]), ["A701"], "iHOME");
  assert.equal(glued.unreadable.length, 1);
  const short = parseDtaPriceList(synth([["A701"]]), ["A701"], "iHOME");
  assert.deepEqual(short.unreadable, ["A701"]);
  assert.match(planDtaWrite(db, short, "iHOME").refusal ?? "", /no units|could not be read/);
});
