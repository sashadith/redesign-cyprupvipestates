# Districts Polis & Kouklia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `Polis` and `Kouklia` out of the `Paphos` district so the CRM Property Matching filter stops returning Polis projects for a Paphos search.

**Architecture:** Fix the feed classifier first (it is the source of truth the nightly sync rewrites `Development.district` from), then run a one-off backfill over existing rows. Because the classifier ends up producing exactly what the backfill wrote, each subsequent sync re-confirms the value instead of reverting it. No schema change and no UI change — the CRM district list is built live from the data by `listPresentationLocations()`.

**Tech Stack:** Next.js 15 / TypeScript, Prisma + PostgreSQL, plain `node` `.mjs` scripts.

**Spec:** `docs/DISTRICTS-POLIS-KOUKLIA.md`

---

## Testing approach — read this before Task 1

This repo has **no test framework**: no test runner dependency, no `test` script, zero `*.test.*` files. QA convention is self-contained scripts under `scripts/qa/` (see `scripts/qa/README.md`). Do **not** add vitest/jest — that is a separate infrastructure decision nobody asked for.

The TDD cycle in this plan runs through a `--self-test` flag built into the backfill script itself. That is not a workaround: the backfill script must carry its own copy of the classification rule anyway (`src/**` uses the `@/…` TS path alias, which plain `node` cannot resolve outside the Next.js build — every `scripts/*.mjs` in this repo is self-contained for that reason, see the header of `scripts/backfill-development-distances.mjs`). The self-test is what keeps that copy honest.

The duplicated rule creates a real drift risk between `feeds.ts` (TypeScript) and the script (JavaScript). Task 5 closes it empirically: after both changes ship and a sync runs, a dry-run reporting **zero** changes over all 244 developments proves the two implementations agree on every row.

---

## Deployment path — staging is code-only

The normal flow is unchanged (`DEPLOYMENT.md:72`):

```
feature branch → deploy-staging.sh → verify on staging → merge to main → deploy-prod.sh
```

**But staging is not a data sandbox, and must not be treated as a third option
for Task 4.** There is only ONE Postgres database — `cve-staging` and
production both connect to the same `cyprusvipestates` DB (`DEPLOYMENT.md:605`).
Running the backfill "on staging" would be running it on production.

What that means per change in this plan:

| Change | Staging | Notes |
|---|---|---|
| `feeds.ts` classifier (Task 3) | ✅ Deploy and review there | Code-only. Staging has no crons (`DEPLOYMENT.md:20`), so nothing auto-syncs. |
| Backfill `--apply` (Task 4) | ❌ Never | Writes to the shared production DB. |
| Force-sync verification (Task 5) | ❌ Never | A sync button clicked through to completion on staging is a real production write — this is precisely the 2026-07-27 incident that destroyed 17 curated units (`DEPLOYMENT.md:869`). |

Staging is for **looking**, not for **doing**. Every write step in this plan
belongs in the isolated testbed (`/opt/cvp-testbed/`) against its disposable
database, or in an explicitly authorized production run.

One interaction worth stating plainly: **deploying Task 3 to production is
itself a partial backfill.** The nightly feed sync writes `Development.district`
from the classifier, so every re-synced project picks up its new district with
or without Task 4. Task 4 exists to catch the rows a sync would not reach —
drafts, archived rows, and anything whose feed entry has gone stale.

---

## File structure

| File | Responsibility |
|---|---|
| `scripts/backfill-development-districts.mjs` | **Create.** Mirrored classification rule + `--self-test` case table + dry-run/`--apply` backfill. |
| `src/app/preview-project/feeds.ts` | **Modify.** `districtFor` gains latitude and sub-region boxes; `DISTRICT_TOWNS` gains Polis/Kouklia; 6 call sites updated; island-blue gains its missing text fallback. |
| `docs/DISTRICTS-POLIS-KOUKLIA.md` | **Modify** (Task 6 only). Flip status to implemented, record actual results. |

Task order is deliberate: the script's self-test is where the rule gets pinned down, so it comes first and `feeds.ts` is then transcribed from a rule that already passes.

---

## Task 1: Backfill script — self-test harness and classification rule

**Files:**
- Create: `scripts/backfill-development-districts.mjs`

- [ ] **Step 1: Write the failing self-test**

Create `scripts/backfill-development-districts.mjs` with the header, the case table, and a deliberately empty rule so the test fails first:

```js
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

const SUB_REGIONS = [];

const DISTRICT_TOWNS = {};

function districtFromGeo(lat, lng) {
  return "";
}

function districtFromText(s) {
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
```

- [ ] **Step 2: Run the self-test to verify it fails**

```bash
node scripts/backfill-development-districts.mjs --self-test
```

Expected: exit code 1, `SELF-TEST FAIL: 30/31`.

30, not 31: the `["Neapolis", ""]` case expects an empty string and therefore passes trivially against the empty stub. That is fine — it only becomes meaningful once the rule exists, which is exactly what it guards.

- [ ] **Step 3: Implement the rule**

Replace the two empty constants (`SUB_REGIONS`, `DISTRICT_TOWNS`) and the two stub functions with:

```js
// Sub-regions of the coarse longitude bands below, checked FIRST because the
// band alone cannot separate them: Polis Chrysochous sits at roughly the same
// longitude as Paphos city but 40 km north, and Kouklia straddles the 32.6
// Paphos/Limassol boundary (which is exactly why Villa Infinity and Ridge
// Residences, both in Venus Rock, were labelled Limassol). Both boxes are
// two-sided so a Nicosia or Kyrenia coordinate can never fall into one.
// Validated against all 244 developments: 10 geo matches (4 Polis, 6 Kouklia),
// no false positives. Two further affected rows, Grigio Court and Trinity
// Residences, carry no coordinates and are classified by text instead.
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
```

- [ ] **Step 4: Run the self-test to verify it passes**

```bash
node scripts/backfill-development-districts.mjs --self-test
```

Expected: exit code 0, `SELF-TEST PASS (31 cases)`.

If `Neapolis` fails by returning `Polis`, the `\b` anchors were dropped — restore `/\bpolis\b/`. If `Zephyros Village 3` returns `Kouklia`, the Kouklia `lngMin` was widened below 32.55.

- [ ] **Step 5: Commit**

```bash
git add scripts/backfill-development-districts.mjs
git commit -m "Add district classification rule with self-test (Polis, Kouklia)"
```

---

## Task 2: Backfill script — dry run over the database

**Files:**
- Modify: `scripts/backfill-development-districts.mjs`

- [ ] **Step 1: Add the backfill body**

Append below the `--self-test` block, replacing that block's `if` with the full entry point:

```js
// ---------- backfill ----------

// Which text the rule sees for a coordinate-less row. town then area, matching
// the precedence the feed adapters use. publicName is deliberately EXCLUDED —
// a project merely named "Polis Gardens" in Limassol must not be reclassified
// by its marketing name.
function textFor(row) {
  const town = row.override?.town || row.town || "";
  const area = row.override?.area || row.area || "";
  return `${town} ${area}`.trim();
}

async function main() {
  const apply = process.argv.includes("--apply");
  const rows = await prisma.development.findMany({
    select: {
      id: true, publicName: true, district: true, town: true, area: true,
      latitude: true, longitude: true, publishStatus: true,
      override: { select: { district: true, town: true, area: true } },
    },
  });

  const changes = [];
  for (const r of rows) {
    // An existing override is a deliberate admin decision and already wins at
    // read time — never second-guess it here.
    if (r.override?.district) continue;
    const geo = districtFromGeo(r.latitude, r.longitude);
    const next = geo || districtFromText(textFor(r));
    if (!next || next === r.district) continue;
    changes.push({ ...r, next, source: geo ? "geo" : "text" });
  }

  changes.sort((a, b) => a.publicName.localeCompare(b.publicName));
  for (const c of changes)
    console.log(`  ${c.publicName} | ${c.district ?? "(none)"} -> ${c.next} | ${c.source} | ${c.publishStatus}`);

  console.log(`\n${changes.length} of ${rows.length} developments would change.`);

  if (!apply) {
    console.log("DRY RUN — nothing written. Re-run with --apply to write.");
    return;
  }
  for (const c of changes)
    await prisma.development.update({ where: { id: c.id }, data: { district: c.next } });
  console.log(`APPLIED: ${changes.length} rows updated.`);
}

if (process.argv.includes("--self-test")) {
  process.exit(selfTest() ? 0 : 1);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run the dry run**

```bash
node scripts/backfill-development-districts.mjs
```

A dry run is read-only and therefore safe against any database, including
production. **Do not run `--apply` yet — see Task 4 for why the target database
is a decision, not a default.**

Expected: exactly these 12 rows and no others, then `12 of 244 developments would change.` and `DRY RUN — nothing written.`

```
  Agnades Village 1 | Paphos -> Polis | geo | published
  Argaka Village 6 | Paphos -> Polis | geo | published
  Beachside Villas | Paphos -> Polis | geo | draft
  Grigio Court | Paphos -> Polis | text | published
  Imperial Residences | Paphos -> Kouklia | geo | published
  Premier Residences | Paphos -> Kouklia | geo | published
  Prodromi Gardens | Paphos -> Polis | geo | draft
  Ridge Residences | Limassol -> Kouklia | geo | published
  Royal Residences | Paphos -> Kouklia | geo | published
  Trinity Residences | Paphos -> Kouklia | text | published
  Villa Infinity | Limassol -> Kouklia | geo | published
  Villa Oasis | Paphos -> Kouklia | geo | published
```

**A 13th row is a defect in the rule, not an acceptable surprise — stop and fix the rule before continuing.** The one expected class of extra rows would be some of the 53 districtless drafts/archives picking up a district from their `area` text (e.g. `Kato Paphos` → Paphos); those are correct and desirable, but they must be `(none) -> …`, never `Paphos -> …`.

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-development-districts.mjs
git commit -m "Add Development.district backfill with dry-run default"
```

---

## Task 3: Fix the classifier in feeds.ts

**Files:**
- Modify: `src/app/preview-project/feeds.ts:57` (`districtFor`), `:61-66` (`DISTRICT_TOWNS`), call sites at `:269`, `:270`, `:333`, `:407`, `:566`, `:768`

- [ ] **Step 1: Replace `districtFor` and `DISTRICT_TOWNS`**

`districtFor` currently takes only longitude, which is why it can never see Polis. Replace lines 57–66 with:

```ts
// Sub-regions of the coarse longitude band below, checked FIRST because the
// band alone cannot separate them: Polis Chrysochous sits at roughly the same
// longitude as Paphos city but 40 km north, and Kouklia straddles the 32.6
// Paphos/Limassol boundary (which is exactly why Villa Infinity and Ridge
// Residences, both in Venus Rock, were labelled Limassol). Both boxes are
// two-sided so a Nicosia or Kyrenia coordinate can never fall into one.
// Validated against all 244 developments: 10 geo matches (4 Polis, 6 Kouklia),
// no false positives. Two further affected rows, Grigio Court and Trinity
// Residences, carry no coordinates and are classified by text instead.
// MIRRORED in scripts/backfill-development-districts.mjs — change both.
// See docs/DISTRICTS-POLIS-KOUKLIA.md.
const SUB_REGIONS = [
  { name: "Polis", latMin: 34.95, latMax: 36.0, lngMin: 32.0, lngMax: 32.6 },
  { name: "Kouklia", latMin: 34.65, latMax: 34.75, lngMin: 32.55, lngMax: 32.7 },
];
const districtFor = (center?: { lat: number; lng: number } | null): string => {
  if (!center) return "";
  const { lat, lng } = center;
  for (const r of SUB_REGIONS)
    if (lat >= r.latMin && lat <= r.latMax && lng >= r.lngMin && lng <= r.lngMax) return r.name;
  return lng < 32.6 ? "Paphos" : lng < 33.4 ? "Limassol" : "Larnaca";
};
// Fallback for projects with no coordinates at all (some Aristo units carry no
// Latitude/Longitude) — match the feed's own area/town text against known towns
// per district, so district isn't silently blank just because geo is missing.
// Order is load-bearing: districtFromText returns on FIRST match, so Polis and
// Kouklia must precede Paphos, and their town names were removed from the
// Paphos regex (it previously listed polis/latchi/latsi/venus rock as Paphos
// towns). "kato pyrgos" sits in Polis ahead of Limassol's "pyrgos".
const DISTRICT_TOWNS: Record<string, RegExp> = {
  Polis: /\bpolis\b|prodromi|latchi|latsi|neo chorio|argaka|pomos|kato pyrgos|chrysochou/i,
  Kouklia: /kouklia|venus rock|secret valley|aphrodite hills|petra tou romiou/i,
  Paphos: /paphos|pafos|chloraka|peyia|pegeia|coral bay|geroskipou|yeroskipou|anavargos|emba|empa|konia|tala|mesogi|mesoyi|kissonerga|tombs of the kings/i,
  Limassol: /limassol|lemesos|agios athanasios|agia fyla|germasogeia|agios nikolaos|mesa geitonia|polemidia|katholiki|tsiflikoudia|petrou kai pavlou|agios tychonas|parekklisia|erimi|pyrgos/i,
  Larnaca: /larnaca|larnaka|oroklini|pyla|livadia|dhekelia|aradippou/i,
  Nicosia: /nicosia|lefkosia|strovolos|engomi|aglantzia/i,
};
```

This must be character-identical in rule terms to Task 1 Step 3. If you changed anything there, change it here too.

- [ ] **Step 2: Update the island-blue call site (lines 269–270)**

It calls `districtFor` twice on the same value and has **no text fallback at all** — an island-blue project without coordinates gets an empty district no matter what its `Location` says. Hoist and add the fallback. Insert above the `return {` at line 267:

```ts
  const ibArea = ov.area ?? txt(project.Location);
  const ibDistrict = districtFor(center) || districtFromText(ibArea);
```

Then change the two lines inside the returned object:

```ts
    area: ibArea, district: ibDistrict, town: "",
    location: joinLoc(ibDistrict, ibArea),
```

- [ ] **Step 3: Update the remaining four call sites**

Each is a one-token change from `center?.lng` to `center`. Leave the rest of every line untouched.

```ts
// line 333 (qubehub)
  const district = districtFor(center) || districtFromText(clean(loc.city)) || districtFromText(clean(loc.area)) || clean(loc.city);

// line 407 (aristo)
  const district = districtFor(center) || districtFromText(area) || districtFromText(naClean(first.Location));

// line 566
  const district = districtFor(center) || districtFromText(area) || districtFromText(clean(first?.Address?.region)) || districtFromText(clean(first?.Address?.subRegion));

// line 768 (squareone)
  const district = districtFor(center) || districtFromText(clean(first.province)) || districtFromText(clean(first.town)) || clean(first.province);
```

- [ ] **Step 4: Verify no call site was missed and it type-checks**

```bash
grep -n "districtFor(" src/app/preview-project/feeds.ts
```

Expected: exactly 6 lines — the definition plus 5 uses (island-blue now calls it once, not twice).

```bash
npx tsc --noEmit
```

Expected: no errors. A `Type 'number | undefined' is not assignable` error means a `center?.lng` call site was missed.

- [ ] **Step 5: Commit**

```bash
git add src/app/preview-project/feeds.ts
git commit -m "Classify Polis and Kouklia as their own districts in the feed adapters"
```

---

## Task 4: Apply the backfill

> ### ⛔ Blocked: the checkout's `.env.local` points at PRODUCTION
>
> Verified 2026-08-17: `.env.local` resolves to `host=localhost port=5433
> db=cyprusvipestates role=cyprusvip`. Both the database name and the role match
> the production markers in `scripts/assert-not-prod-db.mjs`, and running that
> guard against this environment **aborts**. Port 5433 on localhost is a tunnel
> to the live database, not a local copy.
>
> Every command in this plan up to here is read-only and safe. This task is the
> first that writes. **Do not run `--apply` until the operator has chosen a
> target** — see the two options below. Do not set `CVP_ALLOW_PROD_DB=1` to make
> the guard go away; it exists for read-only queries and explicitly says never
> to set it for anything that writes.

**Files:** none modified — this task only runs the script.

- [ ] **Step 1: Confirm the chosen target with the operator**

One of:

- **Testbed** — run on the VPS against the disposable copy via
  `/opt/cvp-testbed/`, per DEPLOYMENT.md's "Isolated-script DB safety"
  (`DEPLOYMENT.md:826`). Preferred: it exercises the whole path with zero risk.
  **Staging is not a substitute** — it shares production's database.
- **Production, deliberately and disclosed** — only with the operator's explicit
  go-ahead in this session, and only after a fresh backup of the `developments`
  table. 12 rows, one column, fully reversible from the dry-run output.

- [ ] **Step 2: Verify the guard passes for the chosen target**

```bash
node scripts/assert-not-prod-db.mjs
```

Expected on the testbed: the resolved database name printed, exit 0. If it
aborts, you are still pointed at production — **stop and re-read Step 1.**

- [ ] **Step 3: Re-run the dry run and confirm it lists exactly 12 rows**

```bash
node scripts/backfill-development-districts.mjs
```

Expected: the same 12 rows as Task 2 Step 2. On a testbed whose copy is older
than production the set may legitimately differ — reconcile the difference
before applying rather than assuming it is staleness.

- [ ] **Step 4: Capture a rollback record, then apply**

```bash
node scripts/backfill-development-districts.mjs > /tmp/districts-before.txt
node scripts/backfill-development-districts.mjs --apply
```

Expected: `APPLIED: 12 rows updated.` `/tmp/districts-before.txt` holds the
`name | old -> new` lines needed to reverse any row by hand.

- [ ] **Step 5: Verify the CRM district list is now correct**

This reproduces exactly what `listPresentationLocations()` builds (`src/app/admin/(panel)/crm/[id]/presentationActions.ts:45`), including its published+ready filter and its town fallback:

```bash
node -e '
require("dotenv").config({path:".env.local"});
const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();
p.development.findMany({where:{publishStatus:{in:["published","ready"]}},select:{town:true,district:true,area:true,override:{select:{town:true,district:true,area:true}}}}).then(rows=>{
 const m={};
 for(const r of rows){const t=r.override?.town||r.town;const d=r.override?.district||r.district||t;const a=r.override?.area||r.area;if(!d)continue;(m[d]??=new Set()).add(a||"");}
 for(const k of Object.keys(m).sort())console.log(k+": "+[...m[k]].filter(Boolean).sort().join(", "));
 return p.$disconnect();
})'
```

Expected — `Polis` and `Kouklia` present, and **no** Prodromi / Argaka / Neo Chorio / Venus Rock anywhere on the `Paphos` line:

```
Kouklia: Venus Rock
Larnaca: Livadia, Oroklini
Limassol: …
Paphos: …
Polis: Argaka, Neo Chorio, Prodromi
```

- [ ] **Step 6: Commit**

Nothing to commit — this task wrote to the database only. Do not create an empty commit.

---

## Task 5: Prove the classifier and the backfill agree

This is the task that closes the TS-vs-JS drift risk. Without it the approach is unverified: nothing so far has run the *TypeScript* rule against real rows.

**Files:** none modified.

> **Run this on the isolated testbed only.** A force-sync is a write, and both
> staging and production point at the live database. Clicking a sync button
> through to completion on staging is functionally identical to doing it in
> production — see `DEPLOYMENT.md:869`.

- [ ] **Step 1: Re-sync one affected published project**

On the testbed, admin UI: Developments → **Royal Residences** (aristo, geo-matched, published) → force a sync. If a CLI path is preferred, call the same `syncOneProject` entry point `src/lib/feedSync.ts` exposes.

- [ ] **Step 2: Confirm the district survived the sync**

```bash
node -e '
require("dotenv").config({path:".env.local"});
const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();
p.development.findFirst({where:{publicName:"Royal Residences"},select:{publicName:true,district:true,syncedAt:true}}).then(r=>{console.log(r);return p.$disconnect();})'
```

Expected: `district: "Kouklia"` with a fresh `syncedAt`. If it reverted to `Paphos`, the `feeds.ts` change from Task 3 did not take effect — check that the aristo call site at line 407 passes `center`, not `center?.lng`.

- [ ] **Step 3: Full-corpus parity check**

Run a sync across all feeds (admin → Developments → sync all), then:

```bash
node scripts/backfill-development-districts.mjs
```

Expected: `0 of 244 developments would change.`

Zero changes means the TypeScript classifier independently produced, for every one of the 244 rows, exactly what the JavaScript mirror expects. Any non-zero count names precisely which rows the two implementations disagree on — fix the mismatch before shipping.

---

## Task 6: Update the spec and open the PR

**Files:**
- Modify: `docs/DISTRICTS-POLIS-KOUKLIA.md`

- [ ] **Step 1: Update the spec status line**

Change the line under the title from:

```markdown
Design spec — 2026-08-17. Status: approved, not yet implemented.
```

to:

```markdown
Design spec — 2026-08-17. Status: implemented on branch feat/districts-polis-kouklia.
```

- [ ] **Step 2: Record the actual verification results**

Append to the **Verification** section, filling in the real numbers you observed — not the expected ones:

```markdown
### Results

- Self-test: 31/31 cases pass (`--self-test`).
- Backfill dry-run: 12 of 244 rows, matching the table above exactly.
- Post-apply CRM list: Polis (Argaka, Neo Chorio, Prodromi), Kouklia (Venus Rock);
  Paphos no longer contains any of those areas.
- Sync durability: Royal Residences re-synced, district stayed Kouklia.
- Full-corpus parity after a complete sync: 0 of 244 rows would change.
```

- [ ] **Step 3: Commit and push**

```bash
git add docs/DISTRICTS-POLIS-KOUKLIA.md
git commit -m "Record Polis/Kouklia district rollout results"
git push -u origin feat/districts-polis-kouklia
```

- [ ] **Step 4: Open the PR**

```bash
gh pr create --title "Polis and Kouklia as top-level districts" --body "$(cat <<'EOF'
Splits Polis Chrysochous and Kouklia out of the Paphos district so a Paphos
search in the CRM Property Matching panel stops returning Polis projects.

- `districtFor()` now takes latitude and checks two sub-region bounding boxes
  before falling through to the unchanged longitude band.
- `DISTRICT_TOWNS` gains Polis and Kouklia entries ahead of Paphos; their town
  names are removed from the Paphos regex.
- The island-blue adapter gains the text fallback it never had.
- One-off backfill script, dry-run by default, with a built-in `--self-test`.

12 developments change district (10 published, 2 drafts). Two of them —
Villa Infinity and Ridge Residences — were pre-existing misclassifications
sitting in Venus Rock but labelled Limassol.

Slugs and URLs are unaffected: slugs derive from `publicName` alone and are
assigned once on publish. Location labels and SEO meta text on the 10 published
projects do change, from "…, Paphos" to "…, Polis"/"…, Kouklia".

Spec: docs/DISTRICTS-POLIS-KOUKLIA.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Out of scope — do not fix in this branch

Documented in the spec under "Known remaining":

- `Berengaria`, `Blackpine` — Troodos/Prodromos, filed under Limassol.
- `Legacy` — `town=Nicosia`, filed under Limassol (pinned by a self-test guard so it can't shift silently).
- The public projects filter (`StyledProjectFilters.tsx`), which runs on `Project.city` with a hardcoded four-language list.
