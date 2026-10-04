#!/usr/bin/env node
/* Ground-truth check for the AGG price-list parser (src/lib/ai/aggPricelist.ts).

   The fixture scripts/qa/fixtures/agg/pricelist-021026-p15-p41-p47.json is REAL
   pdf.js page data — the exact output of scripts/agg-pricelist-worker.mjs for
   pages 15, 41 and 47 of AGG's "Projects Pricelist 021026 AF.pdf" (2026-10-04).
   The whole 5 MB PDF is too big to check in; these three pages carry every
   layout the regression is about:

     p47  Vasileon Block C, third floor. C305's price is drawn as THREE touching
          runs, "€6" + "10" + ",000" — the old parser read none of them as an
          amount and wrote C305 as Available with price null (hand-patched to
          610,000 in the DB on 2026-10-04; every sync re-nulled it).
     p15  Kalamos Duo House 2: "Total areas:" drawn "11" + "0" + "m2" — silently
          read as 11 m² instead of 110 (96 internal + 14 verandas).
     p41  Vasileon Block A fourth floor: the split unit id "Penthouse" + "A401"
          sits 2.2pt apart — a real gap that the run-gluing must NOT close.

   The expected values below were read off the PDF text by a human, not taken
   from the parser: if this fails, the parser is wrong.

     node scripts/qa/agg-pricelist-check.mjs

   Exits non-zero on any failed assertion. */
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

/* esbuild is only a transitive dependency — see gv-pricelist-check.mjs. */
let build;
try {
  ({ build } = await import("esbuild"));
} catch {
  console.error("esbuild is not installed (it is only a transitive dependency).\n  npm i -D esbuild   — or run this check from a tree where it is present.");
  process.exit(2);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const bundlePath = join(ROOT, `.qa-agg-pricelist-${process.pid}.mjs`);
const out = await build({
  entryPoints: [join(ROOT, "src/lib/ai/aggPricelist.ts")],
  bundle: true, platform: "node", format: "esm", write: false,
});
writeFileSync(bundlePath, out.outputFiles[0].text);
process.on("exit", () => rmSync(bundlePath, { force: true }));
const AGG = await import(bundlePath);

let failed = 0;
function check(name, actual, expected) {
  if (isDeepStrictEqual(actual, expected)) { console.log(`  ok   ${name}`); return; }
  failed++;
  console.log(`  FAIL ${name}\n       expected ${JSON.stringify(expected)}\n       actual   ${JSON.stringify(actual)}`);
}

const pages = JSON.parse(readFileSync(join(ROOT, "scripts/qa/fixtures/agg/pricelist-021026-p15-p41-p47.json"), "utf8"));
const NAMES = ["Kalamos Duo", "Vasileon Signature Residences"];
const units = AGG.aggUnitsFromPages(pages, NAMES);
const byRef = (project, ref) => units.find((u) => u.project === project && u.ref === ref);
const V = "Vasileon Signature Residences";

console.log("p47 — Vasileon Block C, third floor");
const blockC3 = units.filter((u) => u.project === V && u.block === "Block C");
check("six cards, in column order", blockC3.map((u) => u.unit), ["APARTMENT C301", "APARTMENT C302", "APARTMENT C303", "APARTMENT C304", "APARTMENT C305", "APARTMENT C306"]);
check("every price, as printed", blockC3.map((u) => u.price), [650000, 580000, 610000, 580000, 610000, 650000]);
check("every status", blockC3.map((u) => u.status), ["available", "available", "available", "available", "available", "available"]);
const c305 = byRef(V, "Block C APARTMENT C305");
check("C305 — the split €6|10|,000 price", c305?.price, 610000);
check("C305 — the rest of the card", c305 && {
  floor: c305.floor, beds: c305.beds, baths: c305.baths, areaInternal: c305.areaInternal,
  areaVeranda: c305.areaVeranda, areaVerandaOpen: c305.areaVerandaOpen, areaBuilt: c305.areaBuilt, rawStatus: c305.rawStatus,
}, { floor: "THIRD FLOOR", beds: "2", baths: "2", areaInternal: "89", areaVeranda: "11", areaVerandaOpen: "6", areaBuilt: "124", rawStatus: "Available" });
check("the Location / Build Status block is not a card field", blockC3.every((u) => !/Paphos|Off Plan/i.test(u.label)), true);

console.log("p15 — Kalamos Duo House 2");
const h2 = byRef("Kalamos Duo", "Block A HOUSE 2");
check("the split 11|0 total area", h2?.areaBuilt, "110");
check("the rest of the card", h2 && { areaInternal: h2.areaInternal, status: h2.status, price: h2.price }, { areaInternal: "96", status: "reserved", price: null });

console.log("p41 — Vasileon Block A, fourth floor");
const a401 = byRef(V, "Block A PENTHOUSE A401");
check("split id Penthouse + A401 still re-joined", a401?.type, "Penthouse");
check("A401 price and areas", a401 && { price: a401.price, areaInternal: a401.areaInternal, areaBuilt: a401.areaBuilt }, { price: 2300000, areaInternal: "134", areaBuilt: "298" });
check("A402–A404 prices", ["A402", "A403", "A404"].map((n) => byRef(V, `Block A APARTMENT ${n}`)?.price), [780000, 780000, 1200000]);

console.log("mergeTouchingRuns");
const run = (x, w, t, y = 100) => ({ x, y, w, t });
check("touching runs glue", AGG.mergeTouchingRuns([run(591.72, 10.09, "€6"), run(601.8, 10.09, "10"), run(611.88, 17.76, ",000")]).map((i) => i.t), ["€610,000"]);
check("a real word gap stays split", AGG.mergeTouchingRuns([run(120.94, 44.13, "Paphos,"), run(167.98, 68.77, "Kato Paphos")]).map((i) => i.t), ["Paphos,", "Kato Paphos"]);
check("another baseline stays split", AGG.mergeTouchingRuns([run(10, 10, "a", 100), run(20, 10, "b", 90)]).map((i) => i.t), ["a", "b"]);

console.log("unpricedAvailableNotes");
check("fixture pages: nothing available without a price", AGG.unpricedAvailableNotes(units), []);
const lost = units.map((u) => (u.ref === "Block C APARTMENT C305" ? { ...u, price: null } : u));
const notes = AGG.unpricedAvailableNotes(lost);
check("a lost price is reported once, naming the unit", notes.length === 1 && notes[0].startsWith(`${V}: 1 unit(s)`) && notes[0].includes("Block C APARTMENT C305"), true);
check("a reserved unit without a price is not reported", AGG.unpricedAvailableNotes(units.filter((u) => u.status === "reserved")), []);

if (failed) { console.log(`\n${failed} check(s) FAILED`); process.exit(1); }
console.log("\nall AGG price-list checks passed");
