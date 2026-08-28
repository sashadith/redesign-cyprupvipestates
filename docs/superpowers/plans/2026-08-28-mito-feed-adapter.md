# Mito Feed Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync Mito's Qobrix feed into four projects with units and descriptions, keeping each project's identity stable across syncs so the operator's hand-typed names survive.

**Architecture:** Clustering stays stateless in `feeds.ts` (proximity OR identical description); identity reconciliation is stateful and lives in `feedSync.ts`, which matches each cluster to the nearest existing Mito development. Mito never enters the `listProjectIds` → `getPreviewProject` path, because that path assumes a feed that supplies project ids — this one does not.

**Tech Stack:** Next.js 14.2.5, React 18.3.1, Prisma, TypeScript. No schema migration.

**Spec:** `docs/superpowers/specs/2026-08-28-mito-feed-adapter-design.md`

---

## Before you start

**This repository has no unit-test runner** — no vitest, no jest, no `npm test`. Do
not add one. The house pattern for testing a pure function is `scripts/qa/*.mjs`:
a Node script that bundles the TypeScript with esbuild (a transitive dependency)
and asserts against it. `scripts/qa/lead-buckets-check.mjs` is the most recent
example; read it before Task 1.

**The database is production.** `.env.local` tunnels to the live database; there
is no staging copy. Reads are fine. **Never run a sync, and never run any script
that writes** — the operator runs those. `npm run build` connects to that
database too, so run it only where this plan says to.

**One correction to the spec.** It gives the project id as `mito:<lat>,<lng>`.
That is wrong: `syncOneProject` builds `feedKey = \`${dev}:${id}\``, so the id
must be the bare coordinate pair `<lat>,<lng>` and the feedKey becomes
`mito:34.76686,32.44081`. Use the bare pair everywhere.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/app/preview-project/feeds.ts` | **modify.** Add `MITO_URL`, `mitoClusters()` (fetch + parse + cluster, pure) and `mitoVm()` (cluster → `ProjectVM`, pure). Add the unknown-developer guard to `getPreviewProject`. |
| `scripts/qa/mito-clusters-check.mjs` | **new.** Self-test for the clustering, on synthetic properties reproducing the four real topologies. No network. |
| `src/lib/feedSync.ts` | **modify.** `DEV_ACCOUNT` entry; new `syncMitoCore()` doing the DB-anchored identity match; dispatch from `syncDeveloperCore`. |

---

## Task 1: Clustering, with its self-test

**Files:**
- Modify: `src/app/preview-project/feeds.ts`
- Test: `scripts/qa/mito-clusters-check.mjs`

- [ ] **Step 1: Read the QA script you are copying**

Run: `sed -n 1,45p scripts/qa/lead-buckets-check.mjs`

Copy two things: the defensive `esbuild` import, and the `check(name, actual, expected)` helper that counts failures rather than throwing on the first.

- [ ] **Step 2: Write the failing test**

Create `scripts/qa/mito-clusters-check.mjs`:

```js
#!/usr/bin/env node
/* Self-test for the Mito feed clustering in src/app/preview-project/feeds.ts.

   Mito's feed carries no project id and no project name field, so projects are
   derived by grouping properties. Neither available signal works alone, and both
   failure modes below are real, measured on the live feed on 2026-08-28:

     - proximity alone splits Mamba, whose unit 1074 sits 450 m from the rest of
       its own project;
     - identical descriptions alone split Paramount, whose four units carry two
       different description texts.

   The cases here reproduce those two topologies synthetically, so the test needs
   no network and cannot drift when Mito edits their listings.

     node scripts/qa/mito-clusters-check.mjs

   Exits non-zero on any failed assertion. */
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let build;
try {
  ({ build } = await import("esbuild"));
} catch {
  console.error("esbuild is not installed (it is only a transitive dependency).\n  npm i -D esbuild   — or run this check from a tree where it is present.");
  process.exit(2);
}

const bundlePath = join(tmpdir(), `mito-clusters-check-${process.pid}.mjs`);
const out = await build({
  entryPoints: ["src/app/preview-project/feeds.ts"],
  bundle: true, platform: "node", format: "esm", write: false,
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

// A property as xml2js produces it with explicitArray:false.
const prop = (ref, lat, lng, desc, extra = {}) => ({
  ref: String(ref), price: "500000", currency: "EUR", type: "apartment",
  beds: "2", baths: "2", pool: "1",
  surface_area: { built: "100", plot: "130" },
  desc: { en: desc },
  images: { image: [{ url: "https://example.invalid/a.jpg" }] },
  location: { latitude: String(lat), longitude: String(lng) },
  town: "Paphos", province: "Paphos", country: "Cyprus",
  ...extra,
});

const groupsOf = (clusters) => clusters.map((c) => c.units.map((u) => u.ref).sort()).sort();

/* 1. Two units at the same spot with the same text are one project. The base
      case: if this fails nothing else is meaningful. */
console.log("basics");
check("same place, same text -> one project",
  groupsOf(F.clusterMitoProperties([prop(1, 34.7, 32.4, "A"), prop(2, 34.7, 32.4, "A")])),
  [["1", "2"]]);

/* 2. Far apart AND different text -> two projects. */
check("far apart, different text -> two projects",
  groupsOf(F.clusterMitoProperties([prop(1, 34.7, 32.4, "A"), prop(2, 34.9, 32.6, "B")])),
  [["1"], ["2"]]);

/* 3. The Mamba case. 1074 sits ~450 m from the rest of its project, so proximity
      alone would split it — the shared description is what holds it together. */
console.log("Mamba: far apart, same text");
check("450 m apart but identical text -> one project",
  groupsOf(F.clusterMitoProperties([
    prop(1074, 34.8000, 32.3990, "Defined by its unique dark-toned aesthetic, Mamba offers…"),
    prop(1076, 34.8044, 32.3976, "Defined by its unique dark-toned aesthetic, Mamba offers…"),
    prop(1087, 34.8044, 32.3976, "Defined by its unique dark-toned aesthetic, Mamba offers…"),
  ])),
  [["1074", "1076", "1087"]]);

/* 4. The Paramount case. Two description variants inside one project, so text
      alone would split it — proximity is what holds it together. The 61 m gap is
      the real measured distance between 1078 and the rest. */
console.log("Paramount: same place, two texts");
check("61 m apart with different texts -> one project",
  groupsOf(F.clusterMitoProperties([
    prop(1059, 34.7704, 32.4341, "Paramount is a modern residential development in a prime area…"),
    prop(1079, 34.7704, 32.4341, "Paramount is a modern residential development in a prime area…"),
    prop(1078, 34.7701, 32.4347, "Paramount is a modern residential project designed for those…"),
  ])),
  [["1059", "1078", "1079"]]);

/* 5. Transitivity. A links to B by distance, B links to C by text; all three are
      one project. This is what makes union-find the right shape rather than a
      pairwise pass. */
console.log("transitivity");
check("A-B by distance, B-C by text -> one project",
  groupsOf(F.clusterMitoProperties([
    prop(1, 34.7000, 32.4000, "text one"),
    prop(2, 34.7005, 32.4000, "text one"),
    prop(3, 34.9000, 32.9000, "text one"),
  ])),
  [["1", "2", "3"]]);

/* 6. A property with no coordinates must not silently join whatever cluster
      happens to be near 0,0 — it stands alone unless its text matches. */
console.log("missing coordinates");
check("no coordinates, unique text -> its own project",
  groupsOf(F.clusterMitoProperties([
    prop(1, 34.7, 32.4, "A"),
    { ...prop(2, 0, 0, "B"), location: undefined },
  ])),
  [["1"], ["2"]]);

/* 7. The threshold is chosen from the middle of a plateau, not tuned to a cliff:
      the live feed yields the same four groups at 100, 150, 250 and 400 m. Pin
      that here so a future edit to the constant has to confront it. */
console.log("threshold plateau");
const paramount = [
  prop(1059, 34.7704, 32.4341, "one"),
  prop(1078, 34.7701, 32.4347, "two"),
  prop(9999, 34.9000, 32.9000, "three"),
];
check("150 m groups Paramount and leaves the distant one alone",
  groupsOf(F.clusterMitoProperties(paramount)),
  [["1059", "1078"], ["9999"]]);

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
```

- [ ] **Step 3: Run it and confirm it fails for the right reason**

Run: `node scripts/qa/mito-clusters-check.mjs`
Expected: it bundles `feeds.ts` fine, then every `check` fails with
`TypeError: F.clusterMitoProperties is not a function` — the export does not exist yet.

- [ ] **Step 4: Add the clustering to `feeds.ts`**

Add near the other feed URL constants at the top of the file:

```ts
// Mito (Qobrix). Kyero v3, but the properties are siblings of <kyero> under
// <root> rather than children of it — squareOne's `kyero.property` path does not
// reach them.
const MITO_URL = "https://mito-invest.eu1.qobrix.com/api/v2/feeds/7062fe516e5e70b7e38af8207894f5590f9a2c53048626a7dbd116ec508ae809";
// Two properties belong to the same project when they are within this distance
// OR share a description. Measured on the live feed 2026-08-28: distances inside
// a project run 0–9 m, there is a single 61 m case, and the next pair is over
// 400 m away — so any value from 100 to 400 yields the same four projects. 150
// sits in the middle of that plateau rather than on either edge of it.
const MITO_SAME_PROJECT_M = 150;
```

Then add, next to the other adapters:

```ts
export type MitoCluster = { units: any[]; description: string; center: { lat: number; lng: number } | null };

const mitoCoords = (p: any): { lat: number; lng: number } | null => {
  const lat = Number(txt(p?.location?.latitude)), lng = Number(txt(p?.location?.longitude));
  return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0 ? { lat, lng } : null;
};

const metresBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.hypot((a.lat - b.lat) * 111320, (b.lng - a.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180));

/* Mito's feed carries no project id, no project name field and no <url> — the
   hook squareOne uses. Projects are therefore derived, and NEITHER available
   signal is sufficient on its own. Both failure modes are real, measured on the
   live feed:

     - proximity alone splits Mamba, whose 1074 sits 450 m from its own project;
     - identical descriptions alone split Paramount, whose four units carry two
       different texts.

   So: same project when within MITO_SAME_PROJECT_M **or** sharing a description,
   unioned transitively. Exported for the QA script — and because a future reader
   should be able to run the grouping without the network. */
export function clusterMitoProperties(props: any[]): MitoCluster[] {
  const parent = props.map((_, i) => i);
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };

  const coords = props.map(mitoCoords);
  const descs = props.map((p) => tidyDesc(txt(p?.desc?.en)));
  for (let i = 0; i < props.length; i++) {
    for (let j = i + 1; j < props.length; j++) {
      const near = coords[i] && coords[j] && metresBetween(coords[i]!, coords[j]!) < MITO_SAME_PROJECT_M;
      const sameText = !!descs[i] && descs[i] === descs[j];
      if (near || sameText) union(i, j);
    }
  }

  const byRoot = new Map<number, number[]>();
  props.forEach((_, i) => { const r = find(i); byRoot.set(r, [...(byRoot.get(r) ?? []), i]); });

  return Array.from(byRoot.values()).map((idxs) => {
    const units = idxs.map((i) => props[i]);
    // Longest variant wins where a project carries more than one text (Paramount
    // does). Deterministic on purpose: a tie-break by feed order would let the
    // description flip between syncs as units come and go.
    const description = idxs.map((i) => descs[i]).sort((a, b) => b.length - a.length)[0] ?? "";
    const withCoords = idxs.map((i) => coords[i]).filter(Boolean) as { lat: number; lng: number }[];
    const center = withCoords.length
      ? { lat: withCoords.reduce((s, c) => s + c.lat, 0) / withCoords.length, lng: withCoords.reduce((s, c) => s + c.lng, 0) / withCoords.length }
      : null;
    return { units, description, center };
  });
}

/* Fetches and clusters. Separate from clusterMitoProperties so the pure grouping
   can be tested without the network. */
export async function mitoClusters(): Promise<MitoCluster[]> {
  return clusterMitoProperties(arr((await cachedParse(MITO_URL))?.root?.property));
}
```

If `tidyDesc` is not defined above this point in the file, move the call to whatever the neighbouring adapters use to normalise description text, and say which in your report.

- [ ] **Step 5: Run the test again**

Run: `node scripts/qa/mito-clusters-check.mjs`
Expected: every line `ok`, final line `all passed`, exit 0.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: silent, exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/app/preview-project/feeds.ts scripts/qa/mito-clusters-check.mjs
git commit -m "Group Mito's feed into projects by proximity or shared description"
```

---

## Task 2: Cluster → ProjectVM

**Files:** Modify `src/app/preview-project/feeds.ts`

- [ ] **Step 1: Read the adapter you are copying**

Run: `grep -n "async function squareOne" -A 60 src/app/preview-project/feeds.ts`

Square One is the closest existing adapter: same Kyero property schema. Copy its
unit mapping, its `districtFor`/`districtFromText` fallback chain, and in
particular the way it derives `priceFrom`/`priceTo` from **available units only** —
read the long comment there about Royal Horizon before you change anything about it.

- [ ] **Step 2: Add the VM builder**

```ts
/* One cluster → one ProjectVM. `id` is supplied by the caller rather than derived
   here: Mito's identity is anchored in the database (see syncMitoCore in
   feedSync.ts), because the operator names these projects by hand and a
   recomputed key would orphan those names the first time the feed shifts. */
export function mitoVm(cluster: MitoCluster, id: string): ProjectVM {
  const units: UnitVM[] = cluster.units.map((u: any) => {
    const ref = txt(u.ref) || txt(u.id);
    const c = mitoCoords(u);
    return {
      ref, name: `Nr. ${ref}`, label: `Nr. ${ref}`,
      type: toTitleCaseName(clean(u.type)),
      // No status field anywhere in this feed. Presence IS availability, and a
      // unit that leaves the feed is pruned by the shared sync path — the same
      // mechanic as the other XML developers, but with no total to measure it
      // against, so "N available" here is not "N of M".
      status: "available", statusLabel: "Available",
      price: toNum(u.price), currency: clean(u.currency) || "EUR",
      beds: clean(u.beds) !== "0" ? clean(u.beds) : "",
      baths: clean(u.baths) !== "0" ? clean(u.baths) : "",
      areaBuilt: areaM2(u?.surface_area?.built), areaPlot: areaM2(u?.surface_area?.plot), areaVeranda: "",
      floor: "", attrs: [], features: txt(u.pool) === "1" ? ["Pool"] : [],
      photos: sizedImages(arr(u?.images?.image).map((im: any) => txt(im?.url)).filter(Boolean)),
      plans: [], coords: c, description: "",
    };
  });

  const first = cluster.units[0] ?? {};
  const center = cluster.center;
  const district = districtFor(center) || districtFromText(clean(first.province)) || districtFromText(clean(first.town)) || clean(first.province);
  const town = clean(first.town);
  // AVAILABLE units only, exactly as squareOne does — see the Royal Horizon
  // comment there. Every unit is "available" in this feed, so today this is the
  // whole set; the shape is kept so it stays correct if a status field ever
  // appears.
  const prices = units.filter((u) => u.status === "available").map((u) => u.price).filter((p): p is number => p != null);

  return {
    id, dev: "mito",
    // Deliberately the id, not a guess from the description. Two of the four
    // projects are never named in the feed, and the operator names all of them
    // by hand through the public-name override.
    publicName: id, developerName: id, developer: "Mito",
    location: town || district, district, town, area: town && town.toLowerCase() !== district.toLowerCase() ? town : "",
    status: "", category: "",
    priceFrom: prices.length ? Math.min(...prices) : null,
    priceTo: prices.length ? Math.max(...prices) : null,
    currency: "EUR",
    description: cluster.description,
    gallery: sizedImages(Array.from(new Set(cluster.units.flatMap((p: any) => arr(p?.images?.image).map((im: any) => txt(im?.url))))).filter(Boolean)),
    plans: [], renders: [], amenities: [],
    center, units,
  };
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: silent, exit 0. If `ProjectVM` requires a field this omits, add it with the neighbouring adapters' value rather than inventing one, and say which in your report.

- [ ] **Step 4: Commit**

```bash
git add src/app/preview-project/feeds.ts
git commit -m "Build a Mito project view model from a cluster"
```

---

## Task 3: The account mapping and the unknown-developer guard

**Files:** Modify `src/lib/feedSync.ts`, `src/app/preview-project/feeds.ts`

- [ ] **Step 1: Read why this matters**

Run: `sed -n 14,36p src/lib/feedSync.ts`

`ensureAccount` falls back to `{ slug: dev, name: dev }`. The comment above the
`medousa` entry records what that cost once already: a second, empty, disconnected
account created on the next sync. Mito's account already exists with slug
`mito-xml`, so without an entry the first sync creates a duplicate `mito`.

- [ ] **Step 2: Add the entry** to `DEV_ACCOUNT`, after `medousa`:

```ts
  // slug "mito-xml", not "mito" — same reason as medousa above: the account the
  // admin created for this feed on 2026-08-28 has that slug, and ensureAccount
  // upserts by it. Leaving it out would create a second, empty account instead
  // of attaching to the configured one.
  mito: { slug: "mito-xml", name: "Mito (XML)" },
```

- [ ] **Step 3: Guard the silent fallback** in `feeds.ts`'s `getPreviewProject`. It currently ends `return islandBlue(target)`, so any unrecognised developer key is served Island Blue's feed. Replace that last line with:

```ts
  // Island Blue is the default for its OWN key only. Returning it for anything
  // unrecognised meant a developer added without an adapter silently got another
  // developer's projects — found 2026-08-28 while adding Mito, which is why the
  // Mito path deliberately never reaches this function.
  if (dev === "island-blue") return islandBlue(target);
  throw new Error(`No feed adapter for developer "${dev}"`);
```

Check the call sites first (`grep -rn "getPreviewProject" src`) and confirm each
either passes a known key or already handles a thrown error — `syncOneProject`
and `checkFeedCompleteness` both sit inside try/catch, but verify rather than
assume, and report what you found.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: silent, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/feedSync.ts src/app/preview-project/feeds.ts
git commit -m "Map Mito to its existing account, and stop unknown developers falling through to Island Blue"
```

---

## Task 4: The DB-anchored sync path

**Files:** Modify `src/lib/feedSync.ts`

This is the task the whole design exists for. Read the spec's "Identity is
anchored in the database" section before starting.

- [ ] **Step 1: Read the loop you are mirroring**

Run: `sed -n 568,596p src/lib/feedSync.ts`

`syncDeveloperCore` lists ids, then calls `syncOneProject(dev, id, accountId, { vm })`
per id. Note that `syncOneProject` already accepts an injected `vm` — the Mito
path supplies its own and reuses every downstream behaviour unchanged.

- [ ] **Step 2: Add the Mito core**

Insert directly above `syncDeveloperCore`:

```ts
/* Mito has no project ids in its feed, so it cannot use the listProjectIds →
   getPreviewProject path: that path's premise is a feed that supplies stable ids.
   Instead each sync clusters the feed afresh and then RECONCILES those clusters
   against what is already in the database, matching by proximity.
   
   Anchoring identity in the DB rather than recomputing it is the point. The
   operator names these projects by hand — two of the four are never named in the
   feed at all — so a key that shifted when the feed shifted would leave the name
   on the old row and create an unnamed twin beside it. Mamba shows how real that
   is: it is held together by a single shared description, and one unit leaving
   plus one text edit would re-key it. */
async function syncMitoCore(opts: { mirror?: boolean; forceMirror?: boolean } = {}): Promise<SyncResult> {
  const dev = "mito";
  const accountId = await ensureAccount(dev);
  const clusters = await mitoClusters();

  const known = await prisma.development.findMany({
    where: { dev, developerAccountId: accountId },
    select: { feedProjectId: true, latitude: true, longitude: true },
  });

  // Each existing project may be claimed once, so two clusters cannot collapse
  // onto the same row and silently merge two projects.
  const claimed = new Set<string>();
  const idFor = (cluster: MitoCluster): string => {
    const center = cluster.center;
    if (center) {
      let best: { id: string; m: number } | null = null;
      for (const k of known) {
        if (!k.feedProjectId || claimed.has(k.feedProjectId)) continue;
        if (k.latitude == null || k.longitude == null) continue;
        const m = Math.hypot((center.lat - k.latitude) * 111320, (k.longitude - center.lng) * 111320 * Math.cos((center.lat * Math.PI) / 180));
        if (m < MITO_MATCH_M && (!best || m < best.m)) best = { id: k.feedProjectId, m };
      }
      if (best) { claimed.add(best.id); return best.id; }
      return `${center.lat.toFixed(5)},${center.lng.toFixed(5)}`;
    }
    // No coordinates at all, so proximity matching is impossible. Key on the
    // lowest ref instead: unstable if that unit sells, but distinct per cluster,
    // which a shared "nocoords" sentinel would not be — two such clusters would
    // land on one feedKey and silently merge into a single project. Every
    // property in the live feed has coordinates, so this is a guard, not a path
    // in use; if it ever fires, that is worth a look rather than a shrug.
    const lowest = cluster.units
      .map((u: any) => String(u?.ref ?? "").trim())
      .filter(Boolean)
      .sort()[0];
    return lowest ? `noloc-${lowest}` : "noloc";
  };

  let created = 0, updated = 0, failed = 0, mirroredNewFiles = false, unitsCreated = 0;
  const unitsUnlisted: UnitChangeLine[] = [];
  for (const cluster of clusters) {
    const id = idFor(cluster);
    try {
      const r = await syncOneProject(dev, id, accountId, { ...opts, vm: mitoVm(cluster, id) });
      if (!r.ok) { failed++; continue; }
      r.created ? created++ : updated++;
      if (r.mirroredNewFiles) mirroredNewFiles = true;
      unitsCreated += r.unitsCreated;
      for (const u of r.unitsUnlisted) {
        unitsUnlisted.push({ developmentId: r.developmentId!, development: r.developmentName!, ref: u.ref, label: u.label });
      }
    } catch {
      failed++;
    }
  }
  return { dev, found: clusters.length, created, updated, failed, mirroredNewFiles, unitsCreated, unitsUnlisted };
}
```

Add the constant near the top of `feedSync.ts`, with the other module constants:

```ts
// A cluster matches an existing Mito development within this distance. Same
// figure as the clustering threshold in feeds.ts, and for the same reason: the
// live feed's inter-project gaps are all over 400 m, so 150 separates them with
// room on both sides.
const MITO_MATCH_M = 150;
```

Add the imports `mitoClusters` and `mitoVm` to the existing
`from "@/app/preview-project/feeds"` import at the top of the file.

- [ ] **Step 3: Dispatch to it**

Make `syncDeveloperCore`'s first line delegate:

```ts
async function syncDeveloperCore(dev: string, opts: { mirror?: boolean; forceMirror?: boolean } = {}): Promise<SyncResult> {
  if (dev === "mito") return syncMitoCore(opts);
  const accountId = await ensureAccount(dev);
```

This keeps `syncDeveloper` and `syncAll` working unchanged — both go through
`syncDeveloperCore`, so both pick Mito up, including the sync window and restart
handling in `syncDeveloper`.

Check whether `syncAll` iterates a hardcoded list of developer keys; if it does,
add `"mito"` to it and say so. Run `grep -n "syncAll" -A 15 src/lib/feedSync.ts`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: silent, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/feedSync.ts
git commit -m "Sync Mito by matching feed clusters to the projects already in the database"
```

---

## Task 5: Verify against the live feed, read-only

**Files:** none — this task only reads and reports.

- [ ] **Step 1: Run the self-test**

Run: `node scripts/qa/mito-clusters-check.mjs`
Expected: `all passed`, exit 0.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: completes. If it aborts with "Too many database connections", that is
the shared production database refusing more connections — wait 30s and re-run
ONCE. Do not loop.

- [ ] **Step 3: Cluster the real feed without writing anything**

```bash
cat > /tmp/mito-dry-run.mjs <<'EOF'
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
const { build } = await import("esbuild");
const p = join(tmpdir(), `mito-dry-${process.pid}.mjs`);
const out = await build({ entryPoints: ["src/app/preview-project/feeds.ts"], bundle: true, platform: "node", format: "esm", write: false });
writeFileSync(p, out.outputFiles[0].text);
process.on("exit", () => rmSync(p, { force: true }));
const F = await import(p);
const clusters = await F.mitoClusters();
console.log(`${clusters.length} Projekte aus ${clusters.reduce((n, c) => n + c.units.length, 0)} Objekten\n`);
for (const c of clusters) {
  const id = c.center ? `${c.center.lat.toFixed(5)},${c.center.lng.toFixed(5)}` : "nocoords";
  const vm = F.mitoVm(c, id);
  console.log(`  ${id}`);
  console.log(`    units=${vm.units.length} refs=${vm.units.map((u) => u.ref).join(",")}`);
  console.log(`    district=${vm.district} town=${vm.town} priceFrom=${vm.priceFrom} priceTo=${vm.priceTo}`);
  console.log(`    gallery=${vm.gallery.length} desc=${vm.description.slice(0, 60)}…`);
}
EOF
node /tmp/mito-dry-run.mjs
```

Expected: **4 projects from 16 properties**, with these unit sets —

```
  1057, 1061, 1072, 1137
  1059, 1078, 1079, 1083
  1074, 1076, 1087, 1088, 1090, 1092
  1086, 1111
```

Every project must have a non-empty description, a district, a `priceFrom`, and a
non-empty gallery. Report the actual output in full.

- [ ] **Step 4: Do NOT run the sync**

The first sync writes projects to the production database. That is the operator's
call, not yours. Report that the code is ready and hand over the command.

---

## Handover notes for the operator

- The first sync creates four projects under the existing `mito-xml` account. Two
  of them are named in the feed's prose (Paramount, Infinity) and two are not;
  all four arrive with the coordinate pair as their name, to be set by hand
  through the public-name override.
- **Unit counts understate reality.** The feed lists what is available, not the
  development. One project's own description says 27 apartments; four are in the
  feed. Every `{unitsAvailable}` placeholder inherits that.
- A second sync with the feed unchanged must create nothing and change no
  `feedProjectId`. Worth checking once, because the operator's hand-typed names
  depend on it.
