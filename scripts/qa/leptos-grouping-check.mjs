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
// Both fields are trimmed and lower-cased before comparison; the feed's own
// spelling is not something this adapter gets to assume.
check("padded, mixed-case country", F.leptosInScope(row({ country: "  CYPRUS  " })), true);
check("padded, mixed-case land parcel",
  F.leptosInScope(row({ type: " plots & LAND parcels " })), false);

console.log("\nleptosCode — read at a fixed position, never searched for");
check("type prefix skipped",            F.leptosCode("A-BAG-Z-206"), "BAG");
check("villa prefix skipped",           F.leptosCode("V-KAM-3-434B"), "KAM");
check("commercial prefix skipped",      F.leptosCode("C-LMNR-S103"), "LMNR");
check("studio prefix skipped",          F.leptosCode("S-B08-208-PG"), "B08");
// PG is Peyia Gardens in segment 2 and Paphos Gardens in the LAST segment,
// 12 km apart. A substring or last-segment rule merges them.
check("PG in segment 2 is Peyia",       F.leptosCode("A-PG-BLK-D-204"), "PG");
check("PG in last segment is not read", F.leptosCode("A-A09-109-PG"), "A09");
// "AP" and "PENT" are the two one-off type spellings; drop either from
// LEPTOS_TYPE_PREFIX and the type is read as the project code.
check("AP prefix skipped",              F.leptosCode("AP-VEN-12"), "VEN");
check("PENT prefix skipped",            F.leptosCode("PENT-DEL-5-b1701"), "DEL");
// Blu Marine: CT (Cavalli) is the ONLY tower segment that follows LBM in the
// feed — 1, 3 and CT are the only three that exist at all. Anything else there
// must stay Poseidon rather than mint a project key with no name behind it.
check("Cavalli Tower splits off",       F.leptosCode("A-LBM-CT-3-1604"), "LBM-CT");
check("Poseidon stays plain LBM",       F.leptosCode("A-LBM-3-2604"), "LBM");
check("LBM with numeric next segment",  F.leptosCode("A-LBM-1-1704"), "LBM");
check("LBM + PH is still Poseidon",     F.leptosCode("A-LBM-PH-1604"), "LBM");
check("LBM + one letter is Poseidon",   F.leptosCode("A-LBM-C-1604"), "LBM");
// Defensive: refs with no type prefix, and junk.
check("no type prefix",                 F.leptosCode("APHII-2-E2-202"), "APHII");
check("empty ref",                      F.leptosCode(""), "");
check("single segment",                 F.leptosCode("KOILI"), "KOILI");
// A lone type letter has no second segment to fall back to: without the
// seg.length > 1 guard the code would come out empty.
check("lone type letter is the code",   F.leptosCode("A"), "A");
// Normalisation: the feed is not guaranteed to be tidy.
check("lowercase ref uppercased",       F.leptosCode("a-bag-z-206"), "BAG");
check("lowercase Cavalli ref",          F.leptosCode("a-lbm-ct-3-1604"), "LBM-CT");
check("padded segments trimmed",        F.leptosCode(" A - BAG - Z - 206 "), "BAG");
check("empty segment skipped",          F.leptosCode("A--BAG-Z-206"), "BAG");

console.log("\nleptosProjectKey — merges and splits from the exception table");
const keyOf = (ref, h2 = "") => F.leptosProjectKey({ ref, h2 });
check("ordinary code passes through",  keyOf("A-BAG-Z-206"), "BAG");
check("ZAN merges into ZANATZIA",      keyOf("V-ZAN-592"), "ZANATZIA");
check("ZANATZIA stays itself",         keyOf("V-ZANATZIA-43"), "ZANATZIA");
// All four Paphos Gardens refs carry PG as their LAST segment, and that is the
// evidence the merge is guarded on: a bare block code with no trailing PG is
// some other project's block and must not be absorbed.
check("Paphos Gardens A09 merges",     keyOf("A-A09-109-PG"), "PAPHOSG");
check("Paphos Gardens B11 merges",     keyOf("A-B11-211-PG"), "PAPHOSG");
check("Paphos Gardens B08 merges",     keyOf("S-B08-208-PG"), "PAPHOSG");
check("Paphos Gardens B10 merges",     keyOf("S-B10-210-PG"), "PAPHOSG");
check("B08 without a trailing PG",     keyOf("A-B08-12", "Block B08 Apartment 12"), "B08");
check("A09 without a trailing PG",     keyOf("A-A09-109", "Block A09 Apartment 109"), "A09");
check("Peyia Gardens is NOT merged",   keyOf("A-PG-BLK-D-204"), "PG");
// The Ruby's real ref is A-DEL-5-b1701: Del Mar's refs give the tower no
// segment of its own, so this one split has to read the heading. It is
// anchored at the START — a heading is a unit title that begins with its
// project name — so a Del Mar unit that merely mentions the tower stays DEL.
check("Del Mar stays Del Mar",         keyOf("A-DEL-4-c2101", "Limassol Del Mar Penthouse c2101"), "DEL");
check("The Ruby splits off Del Mar",   keyOf("A-DEL-5-b1701", "The Ruby Penthouse b1701-1702"), "RUBY");
check("Ruby mentioned, not named",     keyOf("A-DEL-2-c1603", "Limassol Del Mar Apartment c1603, facing The Ruby"), "DEL");
check("The Rubycon is not The Ruby",   keyOf("A-DEL-2-c1902", "The Rubycon Apartment c1902"), "DEL");

console.log("\nleptosProjectName — table first, heading as fallback");
const nameOf = (ref, h2) => F.leptosProjectName(F.leptosProjectKey({ ref, h2 }), h2);
check("table name wins over heading",  nameOf("A-LBM-CT-3-1604", "Apartment No. 1604"), "Cavalli Tower");
check("Poseidon from table",           nameOf("A-LBM-3-2604", "Apartment No. 2604"), "Poseidon Tower");
// The unit designation is stripped where it is FOLLOWED BY A UNIT NUMBER, not
// at the first unit word in the heading: eight of the 45 curated names end in
// "Villas", so stripping at the first one mis-names the very pattern Leptos
// itself uses — and this fallback is the only path a project added after
// today can take.
check("heading with no table entry",   nameOf("V-XYZ-3-12", "Sunrise Hills Villa No. 12"), "Sunrise Hills");
check("a name ending in Villas lives", nameOf("V-XYZ-3-3", "Sunset Beach Villas Villa No. 3"), "Sunset Beach Villas");
check("two-word unit designation",     nameOf("V-XYZ-M1", "Adonis Beach Villas Grand Mansion No. M1"), "Adonis Beach Villas");
check("a name opening with Villa",     nameOf("V-XYZ-5", "Villa Romana No. 5"), "Villa Romana");
check("unit number without a No.",     nameOf("A-XYZ-1-1", "Sunrise Hills Apartment 206, Block Zefiro"), "Sunrise Hills");
// "Floor" is the one unit word normally PRECEDED by its qualifier. Requiring a
// unit number after it is what keeps "Second Floor Apartment" from collapsing
// to "Second" while "Floor 5" still falls through to the code.
check("unknown code, unusable heading", nameOf("V-XYZ-3-12", "Floor 5"), "XYZ");
check("the qualifier before Floor lives",
  nameOf("A-XYZ-1-1", "Second Floor Apartment, Kato Paphos"), "Second Floor Apartment, Kato Paphos");
// The block suffix has its own rule. Every heading above hits a unit
// designation first, which would truncate the string before "Block" is ever
// reached — so the case that actually exercises the rule has none.
check("heading, block suffix dropped", nameOf("A-XYZ-1-1", "Sunrise Hills – Block Zefiro"), "Sunrise Hills");
check("the Blk spelling too",          nameOf("A-XYZ-1-1", "Sunrise Hills, Blk D"), "Sunrise Hills");
check("dangling punctuation trimmed",  nameOf("V-XYZ-3-12", "Sunrise Hills – Villa No. 12"), "Sunrise Hills");
check("ragged whitespace collapsed",   nameOf("V-XYZ-3-12", "  Sunrise   Hills Villa No. 12"), "Sunrise Hills");
// Two characters of residue is not a project name; the code is.
check("residue too short to be a name", nameOf("V-XYZ-3-3", "La Villa No. 3"), "XYZ");
// Kamares Village is ONE development: its Cypress and Ambelia units say so in
// their own descriptions. The table must not let the heading split it.
check("Kamares Cypress stays Kamares", nameOf("V-KAM-CYP-003-1_2", "Kamares Village Cypress Villas No. 003 1&2"), "Kamares Village");
check("Kamares Ambelia stays Kamares", nameOf("V-KAM-AMB-6A6B", "Kamares Village – Two-Villa Package Ambelia No. 6A/6B"), "Kamares Village");

console.log("\nleptosFullSize — WordPress -scaled downsizes back to the original");
const P = "https://www.leptosestates.com/wp-content/uploads/2023/05/";
check("scaled jpg upgraded",  F.leptosFullSize(`${P}03-1-scaled.jpg`), `${P}03-1.jpg`);
check("scaled png upgraded",  F.leptosFullSize(`${P}plan-scaled.png`), `${P}plan.png`);
check("plain url untouched",  F.leptosFullSize(`${P}13-1.jpg`), `${P}13-1.jpg`);
check("four-letter extension", F.leptosFullSize(`${P}03-1-scaled.jpeg`), `${P}03-1.jpeg`);
// "-scaled" only counts as WordPress's marker where the extension it precedes
// ENDS the URL or is followed by a query string. Anywhere else it belongs to
// the name or to a directory, and rewriting it would 404.
check("mid-name scaled kept", F.leptosFullSize(`${P}un-scaled-view.jpg`), `${P}un-scaled-view.jpg`);
check("scaled path segment kept",
  F.leptosFullSize(`${P}dir-scaled.jpg/b.jpg`), `${P}dir-scaled.jpg/b.jpg`);
check("scaled directory kept",
  F.leptosFullSize(`${P}folder-scaled/03-1.jpg`), `${P}folder-scaled/03-1.jpg`);
check("query string kept", F.leptosFullSize(`${P}03-1-scaled.jpg?w=1200`), `${P}03-1.jpg?w=1200`);
check("http upgraded to https", F.leptosFullSize("http://www.leptosestates.com/a-scaled.jpg"),
  "https://www.leptosestates.com/a.jpg");
check("empty url", F.leptosFullSize(""), "");

console.log(`\n${failures ? `${failures} failed` : "all checks passed"}`);
process.exit(failures ? 1 : 0);
