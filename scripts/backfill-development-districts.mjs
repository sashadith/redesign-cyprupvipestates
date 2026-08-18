// One-off backfill: reassign Development.district for rows that belong to the
// Polis or Kouklia sub-regions but were classified as Paphos (or, for two
// Venus Rock projects sitting just past the lng<32.6 boundary, Limassol).
//
//   node scripts/backfill-development-districts.mjs              # dry run
//   node scripts/backfill-development-districts.mjs --apply --only=reclass
//   node scripts/backfill-development-districts.mjs --apply --only=fills
//   node scripts/backfill-development-districts.mjs --apply --only=all
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
  // Polis Chrysochous: Chrysochou bay plus the Tillyria strip (Pomos →
  // Pachyammos → Kato Pyrgos), which runs further east as the coast turns.
  // One box, not two: once the latitude floor moved to 35.0 (below) both
  // halves shared the same band, so they merged.
  //   lngMax 32.75 keeps Morphou (32.99) and all of Kyrenia outside, while
  //     still admitting Kato Pyrgos at ~32.69 — without which a
  //     coordinate-bearing row there would be labelled Limassol by the coarse
  //     band, contradicting the `kato pyrgos` entry in the text rule. (The box
  //     does not make that token reachable — geo short-circuits the text
  //     fallback whenever coordinates exist — it makes the geo answer agree
  //     with the token instead of contradicting it.)
  //   latMin 35.0 keeps Drouseia (34.964) and Lara Bay (34.956) in Paphos,
  //     where they belong. Raised from 34.95 in the Task 3 review; our
  //     northernmost Polis row sits at 35.0245, so the margin is 0.024.
  { name: "Polis", latMin: 35.0, latMax: 36.0, lngMin: 32.0, lngMax: 32.75 },
  // Kouklia / Venus Rock. lngMax lowered from 32.7 to 32.65 in the Task 3
  // review: Pissouri Bay (34.660/32.693) is a real Limassol property market
  // and sat inside the old box. Our easternmost Kouklia row is at 32.6136, so
  // the margin is 0.036 on our side and 0.043 to Pissouri.
  { name: "Kouklia", latMin: 34.65, latMax: 34.75, lngMin: 32.55, lngMax: 32.65 },
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
  // Settlements just outside the tightened edges — these pin the bounds so a
  // future widening trips the self-test instead of silently mislabelling a
  // real market. Added in the Task 3 review.
  ["Pissouri Bay (Limassol)", 34.6597, 32.6931, "Limassol"],
  ["Drouseia (Paphos)", 34.964, 32.418, "Paphos"],
  ["Lara Bay (Paphos)", 34.956, 32.33, "Paphos"],
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

// Which class of change to write. Reclassifications (X -> Y) are the point of
// this script; first-time fills ((none) -> X) are a useful side effect for
// districtless drafts but are unrelated to the Polis/Kouklia split, so they
// are separable. --only is REQUIRED with --apply: at production scale the
// difference is 12 rows versus 59, and that must be a deliberate choice rather
// than a default someone inherits.
function resolveScope(apply) {
  const arg = process.argv.find((a) => a.startsWith("--only="));
  const scope = arg ? arg.slice("--only=".length) : null;
  if (scope && !["reclass", "fills", "all"].includes(scope))
    throw new Error(`--only must be reclass|fills|all, got "${scope}"`);
  if (apply && !scope)
    throw new Error("--apply requires --only=reclass|fills|all (reclass = the X -> Y moves, fills = the (none) -> X first-time fills)");
  return scope ?? "all";
}

const inScope = (c, scope) =>
  scope === "all" || (scope === "reclass" ? !!c.district : !c.district);

async function main() {
  const apply = process.argv.includes("--apply");
  const scope = resolveScope(apply);
  const rows = await prisma.development.findMany({
    orderBy: { publicName: "asc" },
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
    // rule computes. townAgrees checks ONLY the override's own town/area
    // (never textFor(r), which falls back to the base row's town/area when
    // the override doesn't set them) — it has to, because the claim it backs
    // is "this single admin record contradicts itself", which is a stronger
    // and different claim than "the rule disagrees with the admin".
    if (r.override?.district) {
      if (next && next !== r.override.district) {
        const ovText = [r.override?.town, r.override?.area].filter(Boolean).join(", ");
        blocked.push({ ...r, next, source: geo ? "geo" : "text", ovText,
                       townAgrees: !!ovText && districtFromText(ovText) === next });
      }
      continue;
    }

    if (!next || next === r.district) continue;
    changes.push({ ...r, next, source: geo ? "geo" : "text" });
  }

  blocked.sort((a, b) => a.publicName.localeCompare(b.publicName));
  if (blocked.length) {
    // Two buckets that call for OPPOSITE operator actions — mixing them under
    // one heading invites reading a correct override as one to "fix". Stale:
    // the override's own town/area already independently agrees with what
    // the rule computes, only its district field lags — safe to say the
    // override is outdated. No corroboration: the rule and the override
    // simply disagree with nothing in the override itself to confirm either
    // side — the override may well be the one that's right (the classifier
    // has a known Nicosia gap: districtFromGeo has no Nicosia band, so a
    // Nicosia-coordinate row always falls through to Limassol/Larnaca by
    // longitude alone; see the GEO_CASES "Legacy (Nicosia coords)" pin).
    const stale = blocked.filter((b) => b.townAgrees);
    const gap = blocked.filter((b) => !b.townAgrees);

    if (stale.length) {
      console.log("OVERRIDE LOOKS STALE — override.town/area already agrees with the rule, only district disagrees.");
      console.log("Action: update the override, or clear its district so the base column wins again.");
      for (const b of stale)
        console.log(`  ${b.publicName} | override.district=${b.override.district}, rule says ${b.next} | ${b.source} | ov="${b.ovText}" | ${b.publishStatus}`);
      console.log("");
    }

    if (gap.length) {
      console.log("RULE AND OVERRIDE DISAGREE, no corroboration — the override may well be correct.");
      console.log('Action: review by hand. The classifier has a known Nicosia band gap (see the GEO_CASES "Legacy" pin).');
      for (const b of gap)
        console.log(`  ${b.publicName} | override.district=${b.override.district}, rule says ${b.next} | ${b.source} | ov="${b.ovText || "(none)"}" | ${b.publishStatus}`);
      console.log("");
    }
  }

  changes.sort((a, b) => a.publicName.localeCompare(b.publicName));
  const selected = changes.filter((c) => inScope(c, scope));
  for (const c of changes) {
    const detail = c.source === "text" ? ` (town="${c.town ?? ""}", area="${c.area ?? ""}")` : "";
    console.log(`  ${c.publicName} | ${c.district || "(none)"} -> ${c.next} | ${c.source}${detail} | ${c.publishStatus}`);
  }

  console.log(`\n${changes.length} of ${rows.length} developments would change.`);
  if (scope !== "all")
    console.log(`--only=${scope} selects ${selected.length} of those; the other ${changes.length - selected.length} are left untouched.`);
  const tally = new Map();
  for (const c of changes) {
    const key = `${c.district || "(none)"} -> ${c.next}`;
    tally.set(key, (tally.get(key) || 0) + 1);
  }
  if (tally.size) console.log([...tally].map(([k, n]) => `${n}× ${k}`).join(", "));
  console.log(`${blocked.length} row(s) blocked by contradicting overrides (listed above).`);

  if (!apply) {
    console.log("DRY RUN — nothing written. Re-run with --apply to write.");
    return;
  }
  // Idempotent by construction: the `next === r.district` guard above means a
  // re-run only ever touches rows not yet written, so if a write throws
  // partway through, re-running the script (once the underlying issue is
  // fixed) is the documented recovery path — no manual cleanup needed.
  for (const c of selected) {
    await prisma.development.update({ where: { id: c.id }, data: { district: c.next } });
    console.log(`  ✓ ${c.publicName} | ${c.district || "(none)"} -> ${c.next}`);
  }
  console.log(`APPLIED (--only=${scope}): ${selected.length} rows updated.`);
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
