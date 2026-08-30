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
// An UNKNOWN single-letter type prefix is the dangerous case, and the only one
// here that merges two real projects rather than splitting one. The feed
// already carries ad-hoc prefixes ("AP", "PENT"), so the vendor demonstrably
// mints new ones; the day a "T-" (townhouse?) appears, a leading-segment rule
// that accepts it as the code files every such ref under project "T". Kamares
// (Paphos) and Blu Marine (Limassol) would become ONE project 50 km wide,
// carrying whichever name came first and a price range spanning both — and
// nothing catches it, because the completeness guard counts units and no unit
// is lost. The shortest real code in the feed is "PG": one character is never
// a project.
check("unknown 1-char prefix skipped",  F.leptosCode("T-KAM-3-12"), "KAM");
check("…and does not merge with LBM",   F.leptosCode("T-LBM-CT-3-99"), "LBM-CT");
check("unknown 1-char prefix, lower",   F.leptosCode("t-bag-z-206"), "BAG");
check("known 2-char code still wins",   F.leptosCode("T-PG-BLK-D-204"), "PG");
// Defensive: refs with no type prefix, and junk.
check("no type prefix",                 F.leptosCode("APHII-2-E2-202"), "APHII");
// The rule is about the LEADING segment only — a one-character segment further
// in is still just a segment. "A-LBM-C-1604" above already covers that.
check("2-char lead is a code, not a prefix", F.leptosCode("XY-3-12"), "XY");
check("empty ref",                      F.leptosCode(""), "");
check("single segment",                 F.leptosCode("KOILI"), "KOILI");
// A lone type letter has no second segment to fall back to: without the
// i < seg.length - 1 guard the scan would run off the end and the code would
// come out empty.
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
console.log("\ngroupLeptosRows — grouping rows into projects");
const rows = [
  row({ ref: "A-BAG-Z-206", h2: "Bel Air Gardens Apartment 206, Block Zefiro" }),
  row({ ref: "A-BAG-S-303", h2: "Bel Air Gardens Penthhouse 303, Block Sirocco" }),
  row({ ref: "V-ZAN-592",   h2: "Zanatzia Villa 59/2",  town: "Souni-Zanatzia", province: "Limassol" }),
  row({ ref: "V-ZANATZIA-43", h2: "Zanatzia Villa 43",  town: "Souni-Zanatzia", province: "Limassol" }),
  row({ ref: "A-LBM-CT-3-201", h2: "Apartment No. 201", town: "Limassol", province: "Limassol" }),
  row({ ref: "A-LBM-3-2604",   h2: "Apartment No. 2604", town: "Limassol", province: "Limassol" }),
  row({ ref: "V-MBV-01", h2: "Maleme Beach Villas No. 1", country: "Greece", province: "Paros", town: "Paros" }),
  row({ ref: "P-OLYMPUS", h2: "Olympus Villas II Land Parcel", type: "Plots & Land Parcels" }),
];
const groups = F.groupLeptosRows(rows);
const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
check("out-of-scope rows dropped", groups.reduce((n, g) => n + g.rows.length, 0), 6);
check("Greece produced no group", byKey["MBV"] === undefined, true);
check("land parcel produced no group", byKey["OLYMPUS"] === undefined, true);
check("Bel Air holds both blocks", byKey["BAG"].rows.length, 2);
check("Bel Air named from table", byKey["BAG"].name, "Bel Air Gardens");
check("ZAN merged into ZANATZIA", byKey["ZANATZIA"].rows.length, 2);
check("Cavalli separate from Poseidon", [byKey["LBM-CT"].rows.length, byKey["LBM"].rows.length], [1, 1]);
check("Cavalli named", byKey["LBM-CT"].name, "Cavalli Tower");
check("Poseidon named", byKey["LBM"].name, "Poseidon Tower");
check("groups sorted by size then key", groups[0].key, "BAG");

// The merge an unknown type prefix would cause, at the level where it does the
// damage. Reading "T" as the code files a Kamares row and a Blu Marine row
// under one key: one project 50 km wide, named after whichever row sorted
// first, with a price range spanning both. Unit counts stay right, so the
// completeness guard sees nothing.
const tPrefix = F.groupLeptosRows([
  row({ ref: "T-KAM-3-12", h2: "Kamares Village Townhouse No. 12", town: "Tala", province: "Paphos" }),
  row({ ref: "T-LBM-CT-3-99", h2: "Townhouse No. 99", town: "Limassol", province: "Limassol" }),
]);
check("an unknown prefix does not merge two projects", tPrefix.length, 2);
check("…and each keeps its own key", tPrefix.map((g) => g.key).sort(), ["KAM", "LBM-CT"]);
check("…and its own name", tPrefix.map((g) => g.name).sort(), ["Cavalli Tower", "Kamares Village"]);

console.log(`\n${failures ? `${failures} failed` : "all checks passed"}`);
console.log("\nleptosVm — the view model handed to the sync");
const vmRows = [
  row({ ref: "A-BAG-Z-206", price: 258000, h2: "Bel Air Gardens Apartment 206, Block Zefiro",
        lat: 34.75, lng: 32.47, covered: 95, beds: "2", baths: "2",
        images: ["https://x/a.jpg"], plans: ["https://x/p1.jpg"],
        features: ["Swimming Pool", "Air Conditioning"], benefits: ["AIRPORT 26 min", "SEA 2 min"] }),
  row({ ref: "A-BAG-Z-205", price: 525000, h2: "Bel Air Gardens Apartment 205, Block Zefiro",
        lat: 34.75, lng: 32.47, covered: 110, beds: "3", baths: "2",
        images: ["https://x/b.jpg"], plans: ["https://x/p2.jpg"],
        features: ["Swimming Pool", "Private Parking"], benefits: ["AIRPORT 26 min"] }),
  // price 0 must never set the "from" price — 4 in-scope units carry it.
  row({ ref: "A-BAG-Z-204", price: 0, h2: "Bel Air Gardens Apartment 204, Block Zefiro",
        lat: 34.75, lng: 32.47, covered: 90, beds: "2", baths: "1" }),
];
const vm = F.leptosVm(F.groupLeptosRows(vmRows)[0]);
check("id is the project key",        vm.id, "BAG");
check("dev key",                      vm.dev, "leptos");
check("public name from table",       vm.publicName, "Bel Air Gardens");
check("developer label",              vm.developer, "Leptos Estates");
check("district from coordinates",    vm.district, "Paphos");
check("all units carried",            vm.units.length, 3);
check("priceFrom skips the zero",     vm.priceFrom, 258000);
check("priceTo",                      vm.priceTo, 525000);
check("amenities deduplicated",       vm.amenities.slice().sort(),
  ["Air Conditioning", "Private Parking", "Swimming Pool"]);
check("benefits become extraFacts",   vm.extraFacts.find((f) => f.label === "Airport")?.value, "26 min");
check("benefits deduplicated",        vm.extraFacts.filter((f) => f.label === "Airport").length, 1);
check("gallery merged across units",  vm.gallery, ["https://x/a.jpg", "https://x/b.jpg"]);
check("project plans are the union",  vm.plans, ["https://x/p1.jpg", "https://x/p2.jpg"]);
check("unit keeps its own plans",     vm.units[0].plans, ["https://x/p1.jpg"]);
check("unit label carries the block", vm.units[0].label, "Block Zefiro · Nr. 206");
check("unit ref is the feed ref",     vm.units[0].ref, "A-BAG-Z-206");
check("covered area on unit",         vm.units[0].areaBuilt, "95 m²");
check("centre from first coords",     vm.center, { lat: 34.75, lng: 32.47 });

console.log(`\n${failures ? `${failures} failed` : "all checks passed"}`);

// ---------------------------------------------------------------------------
// Unit labels. UnitVM.label is what the public units table and the admin unit
// list render, so two units of one project sharing a label is a defect the
// operator can only fix by hand, 45 times. Measured on the live feed
// 2026-08-30: Limassol Park had "Nr. 402" four times, Mandria Gardens "Nr. 103"
// three times, 45 units in 4 projects in total. The disambiguator was present
// in BOTH sources and thrown away.
// ---------------------------------------------------------------------------
// Amenities. ProjectVM.amenities is the raw union of the units' <features>,
// and Leptos files its own loyalty programme in there: "Leptos Lifestyle
// Membership" sits on 318 of 377 units, so it reached the amenity list of
// nearly all 45 projects — the developer's brand advertised on our page.
// ---------------------------------------------------------------------------
console.log("\nleptosVm.amenities — the vendor's brand is not a facility");
const amen = F.leptosVm(F.groupLeptosRows([
  row({ features: [
    "Leptos Lifestyle Membership", "Signature Collection", "First Boutique",
    "Exclusive Members Bistro", "Safe & Friendly Area", "Award-winning Architecture",
    "Underfloor Heating (where applies)", "Swimming Pool", "Restaurant & Bistro",
    "Spa Facilities",
  ] }),
])[0]).amenities;
check("branding and non-amenities are gone", amen,
  ["Restaurant & Bistro", "Spa Facilities", "Swimming Pool", "Underfloor Heating"]);
// The caveat is a note to Leptos's own sales staff about which units have it.
// On a public amenity list it reads as a disclaimer over the development.
check("underfloor heating keeps the amenity, drops the caveat",
  amen.includes("Underfloor Heating"), true);
// The exclusion is by exact string, case-insensitively, so a genuine amenity
// that merely CONTAINS an excluded word survives.
check("a real bistro is not filtered as branding",
  F.leptosVm(F.groupLeptosRows([row({ features: ["Exclusive Members Bistro", "Restaurant & Bistro"] })])[0]).amenities,
  ["Restaurant & Bistro"]);
check("padding and case do not smuggle branding back in",
  F.leptosVm(F.groupLeptosRows([row({ features: ["  LEPTOS LIFESTYLE MEMBERSHIP  ", "Lift"] })])[0]).amenities,
  ["Lift"]);

console.log(`\n${failures ? `${failures} failed` : "all checks passed"}`);
console.log("\nleptosUnitLabel — unique inside a project");
const labelsOf = (rs) => F.leptosVm(F.groupLeptosRows(rs)[0]).units.map((u) => u.label);

// Limassol Park: the number repeats across buildings, and the heading names
// the building. It does NOT use a "Block <x>" token, which is why looking only
// for that word left these units indistinguishable.
check("the heading's building name separates them",
  labelsOf([
    row({ ref: "A-LPARK-G-2-402", h2: "Limassol Park Mimoza Penthouse No. 402" }),
    row({ ref: "A-LPARK-E-2-402", h2: "Limassol Park Begonia Penthouse No. 402" }),
    row({ ref: "A-LPARK-H-1-207", h2: "Limassol Park Jasmine Apartment No. 207" }),
  ]),
  ["Mimoza · Nr. 402", "Begonia · Nr. 402", "Jasmine · Nr. 207"]);

// Coral Gardens: identical headings, no building name anywhere in them. The
// ref's block segment is the only thing left that tells the two apart.
check("the ref's block segment is the fallback",
  labelsOf([
    row({ ref: "A-CORALG-B4-301", h2: "Coral Gardens Apartment No. 301" }),
    row({ ref: "A-CORALG-2-301", h2: "Coral Gardens Apartment No. 301" }),
    row({ ref: "A-CORALG-MB3-M4", h2: "Coral Gardens Villa M4" }),
  ]),
  ["Block B4 · Nr. 301", "Block 2 · Nr. 301", "Block MB3 · Nr. M4"]);

// …but only where it is needed. Coral Bay puts a BEDROOM COUNT in that
// segment, not a block: "Block 4 · Nr. 190" would be an invented fact, printed
// on a page a buyer reads. So the block fallback is applied per project, and
// only to a project whose labels collide without it.
check("no block is invented when the numbers already differ",
  labelsOf([
    row({ ref: "V-COR-4-190", h2: "Coral Bay Villa 190" }),
    row({ ref: "V-COR-3-36", h2: "Coral Bay Villa 36" }),
  ]),
  ["Nr. 190", "Nr. 36"]);

// The A/B suffix is the whole difference between these two listings, and it
// was being dropped: both came out "Nr. 221-222".
check("the A/B suffix survives",
  labelsOf([
    row({ ref: "V-COR-4-221/222A", h2: "Coral Bay Villa 221-222 A" }),
    row({ ref: "V-COR-3-221/222B", h2: "Coral Bay Villa 221-222 B" }),
    row({ ref: "V-COR-3-233AB", h2: "Coral Bay Villas 233 A & B" }),
  ]),
  ["Nr. 221-222 A", "Nr. 221-222 B", "Nr. 233 A & B"]);

// A project name ending in "Villas" against a heading saying "Villa": the
// building name is whatever sits between the project name and the unit
// designation, so a word-by-word prefix match is what keeps "Coral Bay" out of
// the label.
check("the project name is not mistaken for a building",
  labelsOf([row({ ref: "V-COR-3-230A", h2: "Coral Bay Villa 230A" })]), ["Nr. 230A"]);

// "Parcel" is the feed's word for a unit with no number. Read as a number it
// produced "Nr. Parcel"; the heading's own Block token must still be used, and
// must not be doubled by the ref-block fallback.
check("a parcel is not a unit number",
  labelsOf([
    row({ ref: "A-MAND-11-PRC", h2: "Mandria Gardens Apartment Parcel" }),
    row({ ref: "AP-MAND-10", h2: "Mandria Gardens Apartment Parcel Block 10" }),
  ]),
  ["Parcel", "Block 10 · Parcel"]);
// The same two rows inside the real Mandria Gardens, where a colliding pair
// turns the ref-block pass on for the whole project. "AP-MAND-10" has no block
// segment in the ref (its "10" is the last one), so its block can only come
// from the heading — and must not then be printed twice.
check("…and the heading's block is not doubled by the ref's",
  labelsOf([
    row({ ref: "A-MAND-11-PRC", h2: "Mandria Gardens Apartment Parcel" }),
    row({ ref: "AP-MAND-10", h2: "Mandria Gardens Apartment Parcel Block 10" }),
    row({ ref: "A-MAND-10-103", h2: "Mandria Gardens Apartment No. 103" }),
    row({ ref: "A-MAND-15-103", h2: "Mandria Gardens Apartment No. 103" }),
  ]),
  ["Block 11 · Parcel", "Block 10 · Parcel", "Block 10 · Nr. 103", "Block 15 · Nr. 103"]);

// "Plot 172-173" in the heading was not recognised as a unit designation, so
// the label fell back to the ref and printed a raw fragment, underscore and
// all: "Nr. 172_173".
check("a plot number comes from the heading, not the ref",
  labelsOf([row({ ref: "V-COR-172_173", h2: "Coral Bay Villas Plot 172-173" })]),
  ["Nr. 172-173"]);

// Two ways a heading offers words that are NOT a building name. "Grand
// Mansion" is a unit type spanning two words, so a word-by-word scan sees only
// "Grand"; a dash opens a sales note, not a building. Both produced a label
// nobody would recognise ("Grand · Nr. M1", "– Two-Villa Package Ambelia ·
// Nr. 6A/6B").
check("a two-word unit type is not a building",
  labelsOf([row({ ref: "V-ADN-3-M1", h2: "Adonis Beach Villas Grand Mansion No. M1" })]),
  ["Nr. M1"]);
check("a dashed sales note is not a building",
  labelsOf([row({ ref: "V-KAM-AMB-6A6B", h2: "Kamares Village – Two-Villa Package Ambelia No. 6A/6B" })]),
  ["Nr. 6A/6B"]);
// …but a real building name before a real designation is kept.
check("a building name before the designation is kept",
  labelsOf([row({ ref: "V-KAM-CYP-003-1_2", h2: "Kamares Village Cypress Villas No. 003 1&2" })]),
  ["Cypress · Nr. 003"]);

// Last resort: a heading with no number and refs with no block segment, so
// neither disambiguator exists. Whatever shape Leptos invents next, two units
// of one project must never render the same string.
check("with no disambiguator left, the ref is appended",
  labelsOf([
    row({ ref: "A-ZZZ-1", h2: "Zed Court" }),
    row({ ref: "AP-ZZZ-1", h2: "Zed Court" }),
  ]),
  ["Nr. 1 · A-ZZZ-1", "Nr. 1 · AP-ZZZ-1"]);

console.log(`\n${failures ? `${failures} failed` : "all checks passed"}`);
// ---------------------------------------------------------------------------
// Edge cases beyond the happy path. Each one below was confirmed to bite by
// mutating the implementation and watching it fail.
// ---------------------------------------------------------------------------

console.log("\nleptosRow — parsing one <property> out of the feed");
// This is the ONLY place the -scaled upgrade is wired in. leptosVm receives
// rows whose images are already full-size, so asserting it on a hand-built
// LeptosRow (as an earlier draft of this test did) asserts nothing at all.
const parsed = F.leptosRow({
  ref: "A-BAG-Z-206", price: "258000", type: "Apartments / Penthouses",
  town: "Geroskipou", province: "Paphos", country: "Cyprus",
  desc: { en: "<h2>Bel Air Gardens Apartment 206, Block Zefiro</h2><p>A calm spot &#8211; sea views &amp; more.</p>" },
  location: { latitude: "34.75", longitude: "32.47" },
  images: { image: [{ url: "https://x/a-scaled.jpg" }, { url: "https://x/b.jpg" }] },
  floor_plans: { image: { url: "http://x/p1-scaled.png" } },
  features: { feature: ["Swimming Pool", "Air Conditioning"] },
  benefits: { benefit: "AIRPORT 26 min" },
  beds: "2", baths: "2", sqm: { plot_area: "0", covered_area: "95" },
});
check("heading split off the description", parsed.h2, "Bel Air Gardens Apartment 206, Block Zefiro");
check("body keeps no heading, no tags, decoded entities",
  parsed.body, "A calm spot – sea views & more.");
check("image urls upgraded past -scaled", parsed.images, ["https://x/a.jpg", "https://x/b.jpg"]);
// A single <image> arrives as an object, not an array — and floor plans get
// the same upgrade and the same http→https as the gallery.
check("a lone floor plan, upgraded and secured", parsed.plans, ["https://x/p1.png"]);
check("coordinates parsed", [parsed.lat, parsed.lng], [34.75, 32.47]);
check("a lone benefit becomes a one-item array", parsed.benefits, ["AIRPORT 26 min"]);
check("plot_area 0 is absent, not zero", parsed.plot, null);
check("covered_area parsed", parsed.covered, 95);
// The feed is not guaranteed to ship every field. A property missing all of
// them must produce an empty row rather than throw on the way past.
const bare = F.leptosRow({});
check("a property with no fields yields an empty row",
  [bare.ref, bare.price, bare.h2, bare.body, bare.images.length, bare.lat], ["", 0, "", "", 0, null]);
check("an empty feed yields no groups", F.groupLeptosRows([]), []);
check("a feed of only empty rows yields no groups", F.groupLeptosRows([bare]), []);

console.log("\nleptosVm — edge cases the happy path does not reach");
const vmOf = (rows) => F.leptosVm(F.groupLeptosRows(rows)[0]);

// districtFor(null) returns "" by design, so a group with no coordinates at
// all must fall through to the feed's own town/province text. Without that
// fallback the district would be blank on every coordinate-less project.
const noCoords = vmOf([
  row({ ref: "V-ZANATZIA-43", h2: "Zanatzia Villa 43", town: "", province: "Limassol", lat: null, lng: null }),
  row({ ref: "V-ZAN-592", h2: "Zanatzia Villa 59/2", town: "", province: "Limassol", lat: null, lng: null }),
]);
check("no coordinates anywhere means no centre", noCoords.center, null);
check("district falls back to the province text", noCoords.district, "Limassol");
check("units carry no coords either", noCoords.units.map((u) => u.coords), [null, null]);
check("location is the district alone", noCoords.location, "Limassol");

// resolveDevelopmentPrice() treats priceFrom/priceTo as authoritative, so a
// project whose every unit is price-on-application must advertise no price at
// all rather than "from €0".
const allZero = vmOf([
  row({ ref: "A-BAG-Z-206", price: 0, h2: "Bel Air Gardens Apartment 206, Block Zefiro" }),
  row({ ref: "A-BAG-Z-205", price: 0, h2: "Bel Air Gardens Apartment 205, Block Zefiro" }),
]);
check("every unit priced 0 leaves priceFrom null", allZero.priceFrom, null);
check("…and priceTo null, not 0", allZero.priceTo, null);
check("the units themselves carry null, not 0", allZero.units.map((u) => u.price), [null, null]);

// A benefit that does not carry minutes is not a travel time. Emitting it
// anyway would put "Sea: nearby" — or a bare label with no value — into the
// facts panel next to real figures.
const benefits = vmOf([
  row({ ref: "A-BAG-Z-206", h2: "Bel Air Gardens Apartment 206, Block Zefiro",
        benefits: ["AIRPORT 26 min", "LEPTOS MEMBERSHIP", "SEA nearby", "SHOPS 5 min",
                   "EDUCATION 10min", "Sea 2 min"] }),
]);
check("only well-formed travel times survive", benefits.extraFacts,
  [{ label: "Airport", value: "26 min" }, { label: "Shops", value: "5 min" },
   { label: "Education", value: "10min" }, { label: "Sea", value: "2 min" }]);
check("a benefit with no minutes is dropped",
  benefits.extraFacts.some((f) => f.value === "nearby"), false);
check("an unknown label is dropped",
  benefits.extraFacts.some((f) => /leptos|membership/i.test(`${f.label} ${f.value}`)), false);
// Travel times go to extraFacts, never to distances: developmentDistances.ts
// owns that field and recomputes it by haversine on every write path.
check("nothing is written to distances", benefits.distances, undefined);

// A heading that names no unit ("Waterfront Residence") leaves the ref as the
// only source of a unit number. Without the fallback these units would all
// share one blank label in the admin's unit list.
const noNumber = vmOf([
  row({ ref: "A-XYZ-77", h2: "Waterfront Residence" }),
  row({ ref: "A-XYZ-78", h2: "" }),
]);
check("label falls back to the ref's last segment", noNumber.units[0].label, "Nr. 77");
check("an empty heading falls back the same way", noNumber.units[1].label, "Nr. 78");
check("name falls back to the code when the heading is empty too",
  F.leptosProjectName("XYZ", ""), "XYZ");

// The same render or site plan is attached to every unit of a project. Left
// alone it would appear once per unit in the project gallery.
const dupImages = vmOf([
  row({ ref: "A-BAG-Z-206", h2: "Bel Air Gardens Apartment 206, Block Zefiro",
        images: ["https://x/dup.jpg", "https://x/a.jpg"], plans: ["https://x/site.jpg"] }),
  row({ ref: "A-BAG-Z-205", h2: "Bel Air Gardens Apartment 205, Block Zefiro",
        images: ["https://x/dup.jpg", "https://x/b.jpg"], plans: ["https://x/site.jpg"] }),
]);
check("the shared photo appears once in the gallery",
  dupImages.gallery, ["https://x/dup.jpg", "https://x/a.jpg", "https://x/b.jpg"]);
check("the shared site plan appears once", dupImages.plans, ["https://x/site.jpg"]);
check("each unit still keeps its own copy", dupImages.units[1].photos,
  ["https://x/dup.jpg", "https://x/b.jpg"]);

console.log(`\n${failures ? `${failures} failed` : "all checks passed"}`);
process.exit(failures ? 1 : 0);
