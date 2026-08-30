#!/usr/bin/env node
/* Self-test for the Leptos feed grouping in src/app/preview-project/feeds.ts.

   Every case below reproduces a topology measured on the live feed on
   2026-08-30, synthetically, so the test needs no network and cannot drift when
   Leptos edits their listings.

     node scripts/qa/leptos-grouping-check.mjs

   Exits non-zero on any failed assertion. */
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let build;
try {
  ({ build } = await import("esbuild"));
} catch {
  console.error("esbuild is not installed (it is only a transitive dependency).\n  npm i -D esbuild");
  process.exit(2);
}

const bundlePath = join(tmpdir(), `leptos-grouping-check-${process.pid}.mjs`);
const out = await build({
  entryPoints: ["src/app/preview-project/feeds.ts"],
  bundle: true, platform: "node", format: "esm", write: false,
  // feeds.ts pulls in xml2js, a real CJS dependency requiring Node built-ins;
  // esbuild's ESM output has no ambient require to satisfy them. Same shim as
  // mito-clusters-check.mjs.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
writeFileSync(bundlePath, out.outputFiles[0].text);
process.on("exit", () => rmSync(bundlePath, { force: true }));
const F = await import(bundlePath);

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
}

const row = (over) => ({
  ref: "A-BAG-Z-206", price: 258000, type: "Apartments / Penthouses",
  town: "Geroskipou", province: "Paphos", country: "Cyprus",
  h2: "Bel Air Gardens Apartment 206, Block Zefiro", body: "", lat: null, lng: null,
  images: [], plans: [], features: [], benefits: [], beds: "2", baths: "2",
  plot: null, covered: 95, ...over,
});

console.log("\nleptosInScope — Cyprus, residential + commercial, no land parcels");
check("Cyprus apartment is in scope", F.leptosInScope(row()), true);
check("Greece is out (districtFor would call it Paphos)",
  F.leptosInScope(row({ country: "Greece", province: "Paros", town: "Paros" })), false);
check("land parcel is out", F.leptosInScope(row({ type: "Plots & Land Parcels" })), false);
check("commercial is in", F.leptosInScope(row({ type: "Shops / Commercial Buildings" })), true);
check("studio is in", F.leptosInScope(row({ type: "Studio" })), true);
check("townhouse is in", F.leptosInScope(row({ type: "Townhouses / Maisonettes" })), true);

console.log("\nleptosCode — read at a fixed position, never searched for");
check("type prefix skipped",            F.leptosCode("A-BAG-Z-206"), "BAG");
check("villa prefix skipped",           F.leptosCode("V-KAM-3-434B"), "KAM");
check("commercial prefix skipped",      F.leptosCode("C-LMNR-S103"), "LMNR");
check("studio prefix skipped",          F.leptosCode("S-B08-208-PG"), "B08");
// PG is Peyia Gardens in segment 2 and Paphos Gardens in the LAST segment,
// 12 km apart. A substring or last-segment rule merges them.
check("PG in segment 2 is Peyia",       F.leptosCode("A-PG-BLK-D-204"), "PG");
check("PG in last segment is not read", F.leptosCode("A-A09-109-PG"), "A09");
// Blu Marine: the tower lives in the segment after LBM.
check("Cavalli Tower splits off",       F.leptosCode("A-LBM-CT-3-1604"), "LBM-CT");
check("Poseidon stays plain LBM",       F.leptosCode("A-LBM-3-2604"), "LBM");
check("LBM with numeric next segment",  F.leptosCode("A-LBM-1-1704"), "LBM");
// Defensive: refs with no type prefix, and junk.
check("no type prefix",                 F.leptosCode("APHII-2-E2-202"), "APHII");
check("empty ref",                      F.leptosCode(""), "");
check("single segment",                 F.leptosCode("KOILI"), "KOILI");

console.log("\nleptosProjectKey — merges and splits from the exception table");
const keyOf = (ref, h2 = "") => F.leptosProjectKey({ ref, h2 });
check("ordinary code passes through",  keyOf("A-BAG-Z-206"), "BAG");
check("ZAN merges into ZANATZIA",      keyOf("V-ZAN-592"), "ZANATZIA");
check("ZANATZIA stays itself",         keyOf("V-ZANATZIA-43"), "ZANATZIA");
check("Paphos Gardens A09 merges",     keyOf("A-A09-109-PG"), "PAPHOSG");
check("Paphos Gardens B11 merges",     keyOf("A-B11-211-PG"), "PAPHOSG");
check("Paphos Gardens B08 merges",     keyOf("S-B08-208-PG"), "PAPHOSG");
check("Paphos Gardens B10 merges",     keyOf("S-B10-210-PG"), "PAPHOSG");
check("Peyia Gardens is NOT merged",   keyOf("A-PG-BLK-D-204"), "PG");
check("Del Mar stays Del Mar",         keyOf("A-DEL-C2101", "Limassol Del Mar Penthouse c2101"), "DEL");
check("The Ruby splits off Del Mar",   keyOf("A-DEL-RUBY", "The Ruby Penthouse No. 1"), "RUBY");

console.log("\nleptosProjectName — table first, heading as fallback");
const nameOf = (ref, h2) => F.leptosProjectName(F.leptosProjectKey({ ref, h2 }), h2);
check("table name wins over heading",  nameOf("A-LBM-CT-3-1604", "Apartment No. 1604"), "Cavalli Tower");
check("Poseidon from table",           nameOf("A-LBM-3-2604", "Apartment No. 2604"), "Poseidon Tower");
check("heading with no table entry",   nameOf("V-XYZ-3-12", "Sunrise Hills Villa No. 12"), "Sunrise Hills");
check("heading, block suffix dropped", nameOf("A-XYZ-1-1", "Sunrise Hills Apartment 206, Block Zefiro"), "Sunrise Hills");
check("unknown code, unusable heading", nameOf("V-XYZ-3-12", "Floor 5"), "XYZ");
// Kamares Village is ONE development: its Cypress and Ambelia units say so in
// their own descriptions. The table must not let the heading split it.
check("Kamares Cypress stays Kamares", nameOf("V-KAM-CYP-003-1_2", "Kamares Village Cypress Villas No. 003 1&2"), "Kamares Village");
check("Kamares Ambelia stays Kamares", nameOf("V-KAM-AMB-6A6B", "Kamares Village – Two-Villa Package Ambelia No. 6A/6B"), "Kamares Village");

console.log(`\n${failures ? `${failures} failed` : "all checks passed"}`);
process.exit(failures ? 1 : 0);
