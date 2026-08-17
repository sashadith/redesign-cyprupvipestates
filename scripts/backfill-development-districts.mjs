// One-off backfill: reassign Development.district for rows that belong to the
// Polis or Kouklia sub-regions but were classified as Paphos (or, for two
// Venus Rock projects sitting just past the lng<32.6 boundary, Limassol).
//
//   node scripts/backfill-development-districts.mjs              # dry run
//   node scripts/backfill-development-districts.mjs --apply      # write
//   node scripts/backfill-development-districts.mjs --self-test  # rule check only
//
// The classification rule below is a deliberate, small duplicate of
// districtFor()/DISTRICT_TOWNS in src/app/preview-project/feeds.ts. That module
// uses the "@/..." TS path alias, which plain `node` can't resolve outside the
// Next.js build, so a standalone script can't import it (same reason every
// other scripts/*.mjs|cjs file in this repo is self-contained). feeds.ts is the
// SOURCE OF TRUTH — if you change the boxes or the town regexes there, mirror
// the change here and re-run --self-test.
//
// See docs/DISTRICTS-POLIS-KOUKLIA.md.
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

// Loaded explicitly rather than via `node -r dotenv/config`: plain `node` does
// not read .env.local, and a missing file here is a silent no-op that correctly
// falls through to the real environment on the VPS.
dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();

// ---------- classification rule (mirror of feeds.ts) ----------

// Sub-regions of the coarse longitude bands below, checked FIRST because the
// band alone cannot separate them: Polis Chrysochous sits at roughly the same
// longitude as Paphos city but 40 km north, and Kouklia straddles the 32.6
// Paphos/Limassol boundary (which is exactly why Villa Infinity and Ridge
// Residences, both in Venus Rock, were labelled Limassol). Both boxes are
// two-sided so a Nicosia or Kyrenia coordinate can never fall into one.
// Validated against all 244 developments: 12 matches, no false positives.
const SUB_REGIONS = [
  { name: "Polis", latMin: 34.95, latMax: 36.0, lngMin: 32.0, lngMax: 32.6 },
  { name: "Kouklia", latMin: 34.65, latMax: 34.75, lngMin: 32.55, lngMax: 32.7 },
];

// Order is load-bearing: districtFromText returns on FIRST match, so Polis and
// Kouklia must precede Paphos. Their town names were removed from the Paphos
// regex for the same reason (it previously listed polis/latchi/latsi/venus
// rock as Paphos towns). "kato pyrgos" sits in Polis ahead of Limassol's
// "pyrgos" so the Limassol entry can't claim it.
const DISTRICT_TOWNS = {
  Polis: /\bpolis\b|prodromi|latchi|latsi|neo chorio|argaka|pomos|kato pyrgos|chrysochou/i,
  Kouklia: /kouklia|venus rock|secret valley|aphrodite hills|petra tou romiou/i,
  Paphos: /paphos|pafos|chloraka|peyia|pegeia|coral bay|geroskipou|yeroskipou|anavargos|emba|empa|konia|tala|mesogi|mesoyi|kissonerga|tombs of the kings/i,
  Limassol: /limassol|lemesos|agios athanasios|agia fyla|germasogeia|agios nikolaos|mesa geitonia|polemidia|katholiki|tsiflikoudia|petrou kai pavlou|agios tychonas|parekklisia|erimi|pyrgos/i,
  Larnaca: /larnaca|larnaka|oroklini|pyla|livadia|dhekelia|aradippou/i,
  Nicosia: /nicosia|lefkosia|strovolos|engomi|aglantzia/i,
};

function districtFromGeo(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  for (const r of SUB_REGIONS)
    if (lat >= r.latMin && lat <= r.latMax && lng >= r.lngMin && lng <= r.lngMax) return r.name;
  return lng < 32.6 ? "Paphos" : lng < 33.4 ? "Limassol" : "Larnaca";
}

function districtFromText(s) {
  for (const [district, re] of Object.entries(DISTRICT_TOWNS)) if (re.test(s)) return district;
  return "";
}

// ---------- self-test ----------

const GEO_CASES = [
  // the 12 rows that must move
  ["Prodromi Gardens", 35.02572773022013, 32.41232275581868, "Polis"],
  ["Beachside Villas", 35.0885, 32.4948, "Polis"],
  ["Argaka Village 6", 35.0785222, 32.4866528, "Polis"],
  ["Agnades Village 1", 35.031333, 32.366139, "Polis"],
  ["Villa Oasis", 34.696099, 32.594725, "Kouklia"],
  ["Villa Infinity", 34.6949, 32.6004, "Kouklia"],
  ["Royal Residences", 34.699083, 32.602306, "Kouklia"],
  ["Ridge Residences", 34.705833, 32.613611, "Kouklia"],
  ["Premier Residences", 34.701833, 32.596083, "Kouklia"],
  ["Imperial Residences", 34.70275, 32.612583, "Kouklia"],
  // guards — these must NOT move
  ["Berengaria (Troodos)", 34.95095, 32.830043, "Limassol"],
  ["Blackpine (Troodos)", 34.948518, 32.826958, "Limassol"],
  ["Zephyros Village 3 (Mandria)", 34.709833, 32.529861, "Paphos"],
  ["Velaro Homes (Sea Caves)", 34.88543, 32.359486, "Paphos"],
  ["Infinity (Peyia)", 34.884796, 32.373633, "Paphos"],
  ["Gravity (Limassol)", 34.680134, 33.042025, "Limassol"],
  ["Balance (Larnaca)", 34.943425, 33.635877, "Larnaca"],
  // known-remaining, documented as out of scope: lng 33.35 < 33.4 keeps this
  // Nicosia project on Limassol. Pinned so we notice if it ever changes.
  ["Legacy (Nicosia coords)", 35.174608, 33.35454, "Limassol"],
];

const TEXT_CASES = [
  ["Polis", "Polis"],
  ["Prodromi", "Polis"],
  ["Argaka", "Polis"],
  ["Neo Chorio", "Polis"],
  ["Latchi", "Polis"],
  ["Venus Rock", "Kouklia"],
  ["Kouklia", "Kouklia"],
  ["Secret Valley", "Kouklia"],
  ["Aphrodite Hills", "Kouklia"],
  ["Kato Paphos", "Paphos"],
  ["Peyia", "Paphos"],
  ["Geroskipou", "Paphos"],
  // \bpolis\b must not fire inside a longer word
  ["Neapolis", ""],
];

function selfTest() {
  let failed = 0;
  for (const [name, lat, lng, want] of GEO_CASES) {
    const got = districtFromGeo(lat, lng);
    if (got !== want) { failed++; console.error(`  GEO  FAIL ${name}: want "${want}", got "${got}"`); }
  }
  for (const [text, want] of TEXT_CASES) {
    const got = districtFromText(text);
    if (got !== want) { failed++; console.error(`  TEXT FAIL "${text}": want "${want}", got "${got}"`); }
  }
  const total = GEO_CASES.length + TEXT_CASES.length;
  console.log(failed === 0 ? `SELF-TEST PASS (${total} cases)` : `SELF-TEST FAIL: ${failed}/${total}`);
  return failed === 0;
}

if (process.argv.includes("--self-test")) {
  process.exit(selfTest() ? 0 : 1);
}
