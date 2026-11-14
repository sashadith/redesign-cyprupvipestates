#!/usr/bin/env node
/* DOMO Properties — read the master price list (2026-11-14, phase 2).
 *
 *   node --import tsx scripts/domo-pricelist.mjs scripts/data/domo/2026-11-13.json            # fetch + report
 *   node --import tsx scripts/domo-pricelist.mjs scripts/data/domo/2026-11-13.json --write    # + write the units file
 *   node --import tsx scripts/domo-pricelist.mjs <data.json> --pdf /path/to/mp.pdf            # re-read a saved copy
 *
 * Touches no database and needs no credentials: the list is a public PDF linked
 * from domoproperties.com/mp. What it produces is scripts/data/domo/units-<date>.json,
 * which domo-sync.mjs reads with --units to write the units. The two steps are
 * separate on purpose — the parse is reviewable as a diff before any price reaches
 * a page, and a failed fetch can never half-write a project's stock.
 *
 * Everything this prints as a PROBLEM is a reason not to run the sync yet. The
 * guards are in src/lib/domo/priceList.ts: a page whose title is not the project
 * the data file expects, a column word the list has never used before, a unit row
 * on the page that did not become a unit, two pages of one project disagreeing on
 * the delivery date.
 */
import fs from "node:fs";
import path from "node:path";
import { readPdfPages } from "../src/lib/ai/availabilityTable.ts";
import { PRICE_LIST_PAGE, priceListPdfUrl, readPriceList } from "../src/lib/domo/priceList.ts";

const file = process.argv[2];
const WRITE = process.argv.includes("--write");
const pdfArg = (process.argv.find((a) => a.startsWith("--pdf=")) || "").slice("--pdf=".length)
  || (process.argv.includes("--pdf") ? process.argv[process.argv.indexOf("--pdf") + 1] : "");
if (!file) { console.error("usage: domo-pricelist.mjs <data.json> [--pdf <file>] [--write]"); process.exit(1); }
const data = JSON.parse(fs.readFileSync(file, "utf8"));

async function loadPdf() {
  if (pdfArg) { console.log(`reading ${pdfArg}`); return { buf: fs.readFileSync(pdfArg), source: pdfArg }; }
  console.log(`fetching ${PRICE_LIST_PAGE}`);
  const page = await fetch(PRICE_LIST_PAGE, { headers: { "user-agent": "cvp-price-list-reader" } });
  if (!page.ok) throw new Error(`${PRICE_LIST_PAGE} → HTTP ${page.status}`);
  const url = priceListPdfUrl(await page.text());
  console.log(`  → ${url}`);
  const pdf = await fetch(url);
  if (!pdf.ok) throw new Error(`${url} → HTTP ${pdf.status}`);
  return { buf: Buffer.from(await pdf.arrayBuffer()), source: url };
}

const { buf, source } = await loadPdf();
const pages = await readPdfPages(buf);
console.log(`${pages.length} pages, ${(buf.length / 1024 / 1024).toFixed(1)} MB\n`);

const map = data.projects.map((p) => ({ slug: p.slug, name: p.name, pages: p.pricePages ?? [] }));
const missing = map.filter((m) => !m.pages.length);
const { projects, pageProblems } = readPriceList(pages, map.filter((m) => m.pages.length));

const money = (n) => (n === null ? "—" : `€${n.toLocaleString("en-US")}`);
let units = 0, priced = 0;
for (const p of projects) {
  const avail = p.units.filter((u) => u.status === "available");
  const prices = avail.map((u) => u.price).filter((v) => typeof v === "number");
  units += p.units.length;
  priced += prices.length;
  const counts = ["available", "reserved", "sold"].map((s) => `${p.units.filter((u) => u.status === s).length} ${s}`).join(", ");
  const range = prices.length ? `${money(Math.min(...prices))}–${money(Math.max(...prices))}` : "no price";
  const building = p.building.sale || p.building.rent ? `whole building: ${money(p.building.sale)}${p.building.rent ? ` · ${money(p.building.rent)}/month` : ""}` : "";
  console.log(`${p.slug.padEnd(18)} p${p.pages.join("+").padEnd(6)} ${String(p.completion ?? "no date").padEnd(8)} ${String(p.units.length).padStart(3)} units (${counts}) ${range} ${building}`);
  const beds = Array.from(new Set(p.units.map((u) => u.beds).filter(Boolean)));
  const types = Array.from(new Set(p.units.map((u) => u.type).filter(Boolean)));
  if (p.units.length) console.log(`                   beds ${beds.join("/")} · types ${types.join("/")}`);
  for (const problem of p.problems) console.log(`  ! ${problem}`);
}

console.log(`\n${projects.length} projects, ${units} units, ${priced} with a price`);
for (const m of missing) console.log(`  ! ${m.slug}: no pricePages in the data file — skipped`);
for (const problem of pageProblems) console.log(`  ! ${problem}`);

if (WRITE) {
  const out = path.join(path.dirname(file), `units-${new Date().toISOString().slice(0, 10)}.json`);
  const payload = {
    source: { pdf: source, page: PRICE_LIST_PAGE, read: new Date().toISOString() },
    projects: projects.map((p) => ({
      slug: p.slug,
      pages: p.pages,
      completion: p.completion,
      building: p.building,
      units: p.units.map((u) => ({
        ref: u.ref, label: u.label, block: u.block, floor: u.floor, type: u.type, beds: u.beds,
        areaInternal: u.areaInternal, areaBuilt: u.areaBuilt, areaVeranda: u.areaVeranda, areaVerandaOpen: u.areaVerandaOpen,
        storage: u.storage, price: u.price, status: u.status, attrs: u.attrs,
      })),
    })),
  };
  fs.writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`\nwrote ${out}`);
  if (pageProblems.length || projects.some((p) => p.problems.length)) console.log("NOTE: problems above — review them before running domo-sync with --units");
}
