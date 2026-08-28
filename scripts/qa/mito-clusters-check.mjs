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
  // feeds.ts pulls in xml2js, a real (not type-only) CJS dependency that itself
  // requires Node built-ins like "events". esbuild's platform:"node" leaves
  // those requires in place rather than bundling them, but its ESM output has
  // no ambient `require` to satisfy them at runtime — without this shim every
  // built-in require throws "Dynamic require of … is not supported" before a
  // single check runs. lead-buckets-check.mjs didn't need this because
  // leadBucket.ts only imports Prisma for erased types, so nothing it bundles
  // ever calls require() at runtime.
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
check("150 m groups Paramount and leaves the distant one alone",
  groupsOf(F.clusterMitoProperties([
    prop(1059, 34.7704, 32.4341, "one"),
    prop(1078, 34.7701, 32.4347, "two"),
    prop(9999, 34.9000, 32.9000, "three"),
  ])),
  [["1059", "1078"], ["9999"]]);

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
