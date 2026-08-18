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

// ---------- classification rule (mirror of feeds.ts) ----------

// Sub-regions of the coarse longitude bands below, checked FIRST because the
// band alone cannot separate them: Polis Chrysochous sits at roughly the same
// longitude as Paphos city but 40 km north, and Kouklia straddles the 32.6
// Paphos/Limassol boundary (which is exactly why Villa Infinity and Ridge
// Residences, both in Venus Rock, were labelled Limassol). The exclusion of
// Nicosia/Kyrenia coordinates isn't from being "two-sided" — it's the lngMax
// caps (32.6 and 32.75 below) doing the work, since Nicosia/Kyrenia sit at
// lng ~33.3+; latMax/lngMin merely bound the boxes to the island's coastline.
// Validated against all 244 developments: 10 geo matches (4 Polis, 6 Kouklia),
// no false positives. Two further affected rows, Grigio Court and Trinity
// Residences, carry no coordinates and are classified by text instead.
const SUB_REGIONS = [
  // Chrysochou bay and Polis Chrysochous proper.
  { name: "Polis", latMin: 34.95, latMax: 36.0, lngMin: 32.0, lngMax: 32.6 },
  // The Tillyria strip (Pomos → Pachyammos → Kato Pyrgos) runs further east as
  // the coast turns; without this box, "kato pyrgos" in the text rule below
  // could never fire for a coordinate-bearing row, because geo is consulted
  // first and would otherwise answer "Limassol" (Kato Pyrgos sits at lng
  // ~32.69, past the main Polis box's 32.6 cap). Capped at 32.75 so Morphou
  // (32.99) and all of Kyrenia stay outside. Zero of the 244 developments
  // fall in this strip today, so adding it changes no existing row.
  { name: "Polis", latMin: 35.0, latMax: 36.0, lngMin: 32.6, lngMax: 32.75 },
  { name: "Kouklia", latMin: 34.65, latMax: 34.75, lngMin: 32.55, lngMax: 32.7 },
];

// Order is load-bearing: districtFromText returns on FIRST match, so Polis and
// Kouklia must precede Paphos. Their town names were removed from the Paphos
// regex for the same reason (it previously listed polis/latchi/latsi/venus
// rock as Paphos towns). "kato pyrgos" sits in Polis ahead of Limassol's
// "pyrgos" so the Limassol entry can't claim it. `\blatsi\b` is anchored on
// both sides — unanchored, "latsi" also matches inside "Latsia", a Nicosia
// suburb with no relation to Polis's Latsi/Latsi Beach.
const DISTRICT_TOWNS = {
  Polis: /\bpolis\b|prodromi|latchi|\blatsi\b|neo chorio|argaka|pomos|kato pyrgos|chrysochou/i,
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
  // the 10 rows the boxes must move (2 more move by text — see TEXT_CASES)
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
  // Tillyria strip — the second Polis box added to fix the geo/text
  // contradiction where "kato pyrgos" could never win in districtFromText
  // because districtFromGeo (consulted first) answered "Limassol" for it.
  ["Kato Pyrgos", 35.178, 32.69, "Polis"],
  ["Pachyammos", 35.148, 32.632, "Polis"],
  ["Morphou (outside)", 35.2, 32.99, "Limassol"],
  // null/NaN guard — Development.lat/lng are nullable Postgres columns, and
  // this is the one branch of districtFromGeo that runs against that reality.
  ["null lat", null, 32.5, ""],
  ["null lng", 34.7, null, ""],
  ["NaN lat", NaN, 32.5, ""],
  // boundary cases — both invert on a single `<` vs `<=` edit, and the two
  // Venus Rock rows at exactly 32.600/32.614 are the whole reason the Kouklia
  // box exists.
  ["lng exactly 32.6, low lat", 34.5, 32.6, "Limassol"],
  ["lng exactly 33.4", 34.8, 33.4, "Larnaca"],
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
  // \blatsi\b must not fire inside "Latsia" (a Nicosia suburb)
  ["Latsia", ""],
  // Ordering invariants. The ", Paphos"-shaped cases pin Polis/Kouklia before
  // Paphos; "Kato Pyrgos" pins Polis before Limassol ("kato pyrgos" vs the
  // generic "pyrgos"). Reordering DISTRICT_TOWNS breaks these and nothing else.
  ["Kouklia, Paphos", "Kouklia"],
  ["Venus Rock, Paphos", "Kouklia"],
  ["Polis Chrysochous, Paphos", "Polis"],
  ["Kato Pyrgos", "Polis"],
];

function selfTest() {
  // An emptied case table would otherwise report "SELF-TEST PASS (0 cases)" —
  // a vacuous green that proves nothing ran. Treat it as a failure.
  if (GEO_CASES.length === 0 || TEXT_CASES.length === 0) {
    console.error("SELF-TEST FAIL: empty case table (GEO_CASES or TEXT_CASES has 0 entries)");
    return false;
  }
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

// `--self-test` is checked immediately, before dotenv.config() or the Prisma
// client are touched: dotenv.config() would otherwise print an "injected env"
// banner for the production .env.local on every pure self-test run, and
// `new PrismaClient()` throws outright on a checkout where `prisma generate`
// hasn't run yet. Anything added below this guard must stay below it, never
// run ahead of it — and note that a *static* `import ... from "@prisma/client"`
// added at the top of the file would silently re-break this guard regardless
// of where it appears in source order, since static imports are hoisted and
// run before this line executes. Any future Prisma import must stay dynamic.
if (process.argv.includes("--self-test")) {
  process.exit(selfTest() ? 0 : 1);
}

// Loaded explicitly rather than via `node -r dotenv/config`: plain `node` does
// not read .env.local, and a missing file here is a silent no-op that correctly
// falls through to the real environment on the VPS.
dotenv.config({ path: ".env.local" });

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

// ---------- backfill ----------

// Which text the rule sees for a coordinate-less row: town and area joined as
// "Town, Area". The comma matters — no DISTRICT_TOWNS pattern contains one, so
// a match can never form across the town/area boundary (a bare space join
// could otherwise manufacture e.g. town "Kato" + area "Pyrgos" into "Kato
// Pyrgos" -> Polis, a ~100km error, indistinguishable from a real match), and
// it produces exactly the "Area, District"-shape the ordering TEXT_CASES
// already pin. publicName is deliberately EXCLUDED — a project merely named
// "Polis Gardens" in Limassol must not be reclassified by its marketing name.
//
// This join is a DELIBERATE DIVERGENCE from feeds.ts, not an oversight to
// "fix" back to matching it: feeds.ts evaluates town and area as two SEPARATE
// strings and lets town win outright (districtFromText(city) ||
// districtFromText(area)). Joining them into one string here instead lets a
// more specific AREA outrank a coarser TOWN via DISTRICT_TOWNS's match order —
// e.g. town "Paphos" + area "Venus Rock" must resolve to Kouklia, which a
// town-first rule would get wrong. Restoring town-first precedence here would
// silently reclassify rows like that one back to the coarser district.
function textFor(row) {
  const town = row.override?.town || row.town || "";
  const area = row.override?.area || row.area || "";
  return [town, area].filter(Boolean).join(", ");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const rows = await prisma.development.findMany({
    select: {
      id: true, publicName: true, district: true, town: true, area: true,
      latitude: true, longitude: true, publishStatus: true,
      override: { select: { district: true, town: true, area: true, latitude: true, longitude: true } },
    },
  });

  const changes = [];
  const blocked = [];
  for (const r of rows) {
    // Override coordinates win over the base row's (documented in
    // prisma/schema.prisma as "admin-set map coordinates (win over feed)",
    // and honoured override-first by every other read path in this repo,
    // e.g. scripts/backfill-development-distances.mjs). Reading r.latitude
    // bare here would miss rows where the base row has no coordinates but the
    // override does — geo would silently return "" and fall through to text.
    const geo = districtFromGeo(r.override?.latitude ?? r.latitude, r.override?.longitude ?? r.longitude);
    const next = geo || districtFromText(textFor(r));

    // An existing override is a deliberate admin decision and already wins at
    // read time — never second-guess it here by writing over it. But a script
    // whose whole purpose is fixing rows like these must not go silent on
    // them either: collect every override whose district contradicts what the
    // rule computes, and flag whether the override's OWN town/area already
    // agrees with the rule. That agreement is the damning case — an override
    // whose town says "Kouklia" while its district says "Paphos" is
    // self-contradictory within a single admin record, not just a
    // disagreement between the rule and an admin.
    if (r.override?.district) {
      if (next && next !== r.override.district)
        blocked.push({ ...r, next, source: geo ? "geo" : "text",
                       townAgrees: districtFromText(textFor(r)) === next });
      continue;
    }

    if (!next || next === r.district) continue;
    changes.push({ ...r, next, source: geo ? "geo" : "text" });
  }

  if (blocked.length) {
    console.log(`${blocked.length} row(s) BLOCKED by a contradicting override (district left unchanged — override wins at read time):`);
    for (const b of blocked) {
      const detail = b.source === "text" ? ` (town="${b.town ?? ""}", area="${b.area ?? ""}")` : "";
      const flag = b.townAgrees
        ? "SELF-CONTRADICTING: override.town/area already agrees with the rule, override.district does not"
        : "override.town/area does not confirm the rule either";
      console.log(`  ${b.publicName} | override.district=${b.override.district} but rule says ${b.next} | ${b.source}${detail} | ${flag}`);
    }
    console.log("");
  }

  changes.sort((a, b) => a.publicName.localeCompare(b.publicName));
  for (const c of changes) {
    const detail = c.source === "text" ? ` (town="${c.town ?? ""}", area="${c.area ?? ""}")` : "";
    console.log(`  ${c.publicName} | ${c.district || "(none)"} -> ${c.next} | ${c.source}${detail} | ${c.publishStatus}`);
  }

  console.log(`\n${changes.length} of ${rows.length} developments would change.`);
  const tally = new Map();
  for (const c of changes) {
    const key = `${c.district || "(none)"} → ${c.next}`;
    tally.set(key, (tally.get(key) || 0) + 1);
  }
  if (tally.size) console.log([...tally].map(([k, n]) => `${n}× ${k}`).join(", "));
  console.log(`${blocked.length} row(s) blocked by contradicting overrides.`);

  if (!apply) {
    console.log("DRY RUN — nothing written. Re-run with --apply to write.");
    return;
  }
  // Idempotent by construction: the `next === r.district` guard above means a
  // re-run only ever touches rows not yet written, so if a write throws
  // partway through, re-running the script (once the underlying issue is
  // fixed) is the documented recovery path — no manual cleanup needed.
  for (const c of changes) {
    await prisma.development.update({ where: { id: c.id }, data: { district: c.next } });
    console.log(`  ✓ ${c.publicName}`);
  }
  console.log(`APPLIED: ${changes.length} rows updated.`);
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
