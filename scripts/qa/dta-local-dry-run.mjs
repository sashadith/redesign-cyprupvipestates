#!/usr/bin/env node
/* DTA connector — local dry run on downloaded price lists. No database, no Dropbox.
 *
 *   node --import tsx scripts/qa/dta-local-dry-run.mjs <pdf-dir> scripts/data/dta/2026-10-29.json [--rows <out-dir>]
 *
 * Runs every PDF in <pdf-dir> through the connector's own reader and write plan
 * (src/lib/dta.ts — the same code dtaSync.ts runs) against the units of the data
 * file, which stands in for the database. A PDF is matched to its project by file
 * name, with the project-folder rule (athina.pdf, ihome.pdf, mandarin.pdf, …).
 * --rows writes each list's pdf.js pages as JSON (what the regression fixtures in
 * scripts/qa/fixtures/dta/ are). Run from the repo root (the pdf worker path is
 * relative to it). */
import fs from "node:fs";
import path from "node:path";
import { readPdfPages } from "../../src/lib/ai/availabilityTable.ts";
import { DTA_PROJECTS, parseDtaPriceList, planDtaWrite } from "../../src/lib/dta.ts";

const [dir, dataFile] = process.argv.slice(2);
const ri = process.argv.indexOf("--rows");
const rowsDir = ri > 0 ? process.argv[ri + 1] : null;
if (!dir || !dataFile) { console.error("usage: dta-local-dry-run.mjs <pdf-dir> <data.json> [--rows <out-dir>]"); process.exit(1); }
const data = JSON.parse(fs.readFileSync(dataFile, "utf8"));

let bad = 0;
for (const f of fs.readdirSync(dir).filter((n) => /\.pdf$/i.test(n)).sort()) {
  const p = DTA_PROJECTS.find((x) => x.folder.test(path.basename(f, ".pdf")));
  if (!p) { console.log(`${f}: no project matches this file name — skipped`); continue; }
  const proj = data.projects.find((x) => x.slug === p.slug);
  const existing = proj.units.map((u) => ({ id: `${p.slug}:${u.ref}`, ref: u.ref, status: u.status, price: u.price ?? null, beds: u.beds != null ? String(u.beds) : null, pinnedFields: [] }));
  const pages = await readPdfPages(fs.readFileSync(path.join(dir, f)));
  if (rowsDir) { fs.mkdirSync(rowsDir, { recursive: true }); fs.writeFileSync(path.join(rowsDir, `${p.slug}.json`), JSON.stringify(pages)); }
  const parsed = parseDtaPriceList(pages, existing.map((u) => u.ref), p.name);
  const plan = planDtaWrite(existing, parsed, p.name);
  console.log(`\n${p.name} (${f}) — list date ${parsed.listDate ?? "?"}, table on page(s) ${parsed.tablePages.join(", ") || "none"}, ${parsed.units.length} unit(s) read${plan.fullTable ? ", full table" : ", for-sale list"}`);
  for (const u of parsed.units) console.log(`  read   ${u.ref.padEnd(8)} ${u.status.padEnd(9)} ${u.price != null ? `€${u.price.toLocaleString("en")}` : "—"}  beds ${u.beds ?? "—"}`);
  if (plan.refusal) { bad++; console.log(`  REFUSED: ${plan.refusal}`); }
  for (const x of plan.updates) console.log(`  change ${x.ref}: ${x.changes.join(", ")}`);
  for (const x of plan.unlist) console.log(`  change ${x.ref}: no longer in the list → unlisted`);
  for (const i of plan.issues) console.log(`  issue  ${i}`);
  if (!plan.refusal && !plan.updates.length && !plan.unlist.length) console.log("  no changes");
}
process.exit(bad ? 1 : 0);
