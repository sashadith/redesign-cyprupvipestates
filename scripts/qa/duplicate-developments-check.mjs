#!/usr/bin/env node
/* Guard for the Development ↔ Development duplicate scan
   (findDuplicateDevelopmentPairs in src/lib/overlapSweep.ts, surfaced by the
   duplicateDevelopments Action Center rule).

   Why it exists: BBF had the same building twice — /projects/golf-residences
   (created by hand 2026-07-12) and /projects/eden-golf (feed project 38,
   2026-08-28) — live against each other for two and a half weeks. The nightly
   overlap sweep never saw it, because that sweep only ever compares a legacy
   Sanity Project against a Development, never two Developments.

   Three real measurements from 2026-09-16 are the whole design:

     Eden Golf   exact name, same BBF account,   30 m  → must be reported
     Thea        exact name, two developers,  5 064 m  → must NOT be reported
     the phases  fuzzy name, same account, 72-209 m    → must NOT be reported

   Thea is two real, different buildings that happen to share a name. The
   legacy rule would persist it (an exact title alone is Medium there), and it
   would then be reported every night forever.

   The third line was the surprise, and it changed the rule after it had been
   agreed: run against production, "fuzzy name + same account" produced seven
   pairs and every one was a legitimate sibling — VENARA / VENARA VIEW /
   Venara Lifestyle, Trees Park / Trees, and three "<name> 2" phases
   (Celestia, Germasogeia View, Avalon Gardens). Naming a phase after its
   predecessor is how this market names things. So the fuzzy tier needs
   PROXIMITY and a shared account is not enough for it, which leaves exactly
   one live pair: Domenica's elements / elements-oxygen-park-of-colours,
   19 units against 2, sharing a coordinate exactly.

   Requiring a second signal is what makes this scan safe to run unattended —
   so if Thea or a phase pair ever starts being reported here, the alarm has
   become wallpaper and the rule, not the fixture, is what needs revisiting.

     node scripts/qa/duplicate-developments-check.mjs

   Exits non-zero on the first failed assertion. */
import { writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

let build;
try {
  ({ build } = await import("esbuild"));
} catch {
  console.error("esbuild is not installed (it is only a transitive dependency).\n  npm i -D esbuild   — or run this check from a tree where it is present.");
  process.exit(2);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const written = [];
async function bundle(entry, name) {
  const path = join(ROOT, `.qa-${name}-${process.pid}.mjs`);
  const out = await build({
    entryPoints: [join(ROOT, entry)], bundle: true, platform: "node", format: "esm", write: false,
    external: ["@prisma/client"],
  });
  writeFileSync(path, out.outputFiles[0].text);
  written.push(path);
  return path;
}
const S = await import(await bundle("src/lib/overlapSweep.ts", "overlap-sweep"));
process.on("exit", () => { for (const p of written) rmSync(p, { force: true }); });

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
}

const BBF = "acct-bbf", DOM = "acct-domenica", AGG = "acct-agg";
const row = (o) => ({
  publishStatus: "published", developerAccountId: null, latitude: null, longitude: null,
  alias: null, overrideLatitude: null, overrideLongitude: null, ...o,
});
const find = (rows) => S.findDuplicateDevelopmentPairs(rows);
const names = (pairs) => pairs.map((p) => [p.aName, p.bName].sort().join(" + ")).sort();

/* The real Eden Golf pair: same account AND 30 m apart. */
const EDEN = [
  row({ id: "man", publicName: "Eden Golf", developerAccountId: BBF, latitude: 34.760544, longitude: 32.45775 }),
  row({ id: "feed", publicName: "Eden Golf", developerAccountId: BBF, latitude: 34.760387, longitude: 32.458013 }),
];
check("the real duplicate is reported", names(find(EDEN)), ["Eden Golf + Eden Golf"]);
check("…exactly once, not once per direction", find(EDEN).length, 1);
check("…as an exact-title match", find(EDEN)[0].matchType, "exact-title");
check("…noting the shared account", find(EDEN)[0].sameAccount, true);
check("…and the distance", Math.round(find(EDEN)[0].distanceMeters), 30);

/* The real Thea pair: same name, different developers, 5 064 m apart. */
const THEA = [
  row({ id: "dom", publicName: "Thea", developerAccountId: DOM, latitude: 34.818001, longitude: 32.453974 }),
  row({ id: "agg", publicName: "Thea", developerAccountId: AGG, latitude: 34.823024, longitude: 32.398835 }),
];
check("two real projects sharing a name are NOT reported", find(THEA), []);

/* Each corroborating signal alone is enough — they are an OR, not an AND. */
check("same account alone is enough", find([
  row({ id: "x", publicName: "Trees Park", developerAccountId: BBF }),
  row({ id: "y", publicName: "Trees Park", developerAccountId: BBF }),
]).length, 1);
check("proximity alone is enough, across accounts", find([
  row({ id: "x", publicName: "Trees Park", developerAccountId: DOM, latitude: 34.7, longitude: 32.4 }),
  row({ id: "y", publicName: "Trees Park", developerAccountId: AGG, latitude: 34.70009, longitude: 32.4 }),
]).length, 1);
check("neither signal means no report", find([
  row({ id: "x", publicName: "Trees Park", developerAccountId: DOM, latitude: 34.7, longitude: 32.4 }),
  row({ id: "y", publicName: "Trees Park", developerAccountId: AGG, latitude: 34.9, longitude: 32.9 }),
]), []);
check("a missing account on one side is not 'same account'", find([
  row({ id: "x", publicName: "Trees Park", developerAccountId: null }),
  row({ id: "y", publicName: "Trees Park", developerAccountId: null }),
]), []);

/* Archiving one side is how an operator resolves a pair — that is the whole
   acknowledgement mechanism, so it has to actually silence the scan. */
check("archiving one side resolves the pair", find([
  row({ id: "man", publicName: "Eden Golf", developerAccountId: BBF, publishStatus: "archived" }),
  row({ id: "feed", publicName: "Eden Golf", developerAccountId: BBF }),
]), []);
check("a draft still counts — it is not yet resolved", find([
  row({ id: "a", publicName: "Eden Golf", developerAccountId: BBF, publishStatus: "draft" }),
  row({ id: "b", publicName: "Eden Golf", developerAccountId: BBF }),
]).length, 1);

/* Fuzzy needs PROXIMITY — a shared account is explicitly not enough for it.
   Measured 2026-09-16: "fuzzy + same account" reported seven pairs against
   production and all seven were legitimate siblings (VENARA / VENARA VIEW /
   Venara Lifestyle, Trees Park / Trees, and three "<name> 2" phase pairs),
   72 m to 209 m apart or without coordinates. The single pair that looks like
   a real overlap — Domenica's elements / elements-oxygen-park-of-colours,
   19 units against 2 — shares a coordinate exactly. Distance is what separates
   a phase from a duplicate here. */
check("a fuzzy match needs proximity, not just a shared account", find([
  row({ id: "a", publicName: "Celestia", developerAccountId: BBF }),
  row({ id: "b", publicName: "Celestia 2", developerAccountId: BBF }),
]), []);
check("a phase 200m away is not a duplicate", find([
  row({ id: "a", publicName: "Trees", developerAccountId: BBF, latitude: 34.7, longitude: 32.4 }),
  row({ id: "b", publicName: "Trees Park", developerAccountId: BBF, latitude: 34.7018, longitude: 32.4 }),
]), []);
check("one name containing the other AT the same spot is reported", find([
  row({ id: "a", publicName: "elements", developerAccountId: DOM, latitude: 34.782361, longitude: 32.423333 }),
  row({ id: "b", publicName: "elements-oxygen-park-of-colours", developerAccountId: DOM, latitude: 34.782361, longitude: 32.423333 }),
])[0].matchType, "fuzzy-title");

/* The weakest legacy tier is deliberately absent: a shared distinctive word
   between two of one developer's projects is ordinary naming. */
check("a merely shared word is not reported", find([
  row({ id: "a", publicName: "Aktea Residences 2", developerAccountId: BBF }),
  row({ id: "b", publicName: "Aktea Sunset Villas", developerAccountId: BBF }),
]), []);
check("a developer's numbered siblings are not duplicates", find([
  row({ id: "a", publicName: "Aktea Residences 2", developerAccountId: BBF }),
  row({ id: "b", publicName: "Aktea Residences 3", developerAccountId: BBF }),
]), []);

/* An alias counts as a name — the admin display alias is what a visitor sees. */
check("an alias matches too", find([
  row({ id: "a", publicName: "BBF Project 38", alias: "Eden Golf", developerAccountId: BBF }),
  row({ id: "b", publicName: "Eden Golf", developerAccountId: BBF }),
]).length, 1);
check("…and the alias match counts as exact, not fuzzy", find([
  row({ id: "a", publicName: "BBF Project 38", alias: "Eden Golf", developerAccountId: BBF }),
  row({ id: "b", publicName: "Eden Golf", developerAccountId: BBF }),
])[0].matchType, "exact-title");

/* Housekeeping that would otherwise bite quietly. */
check("a single row pairs with nothing", find([row({ id: "a", publicName: "Eden Golf", developerAccountId: BBF })]), []);
check("an empty database is fine", find([]), []);
check("three of the same name give three pairs, not six", find([
  row({ id: "a", publicName: "Eden Golf", developerAccountId: BBF }),
  row({ id: "b", publicName: "Eden Golf", developerAccountId: BBF }),
  row({ id: "c", publicName: "Eden Golf", developerAccountId: BBF }),
]).length, 3);
check("an override coordinate wins over the base one", find([
  row({ id: "a", publicName: "Trees Park", developerAccountId: DOM, latitude: 34.9, longitude: 32.9, overrideLatitude: 34.7, overrideLongitude: 32.4 }),
  row({ id: "b", publicName: "Trees Park", developerAccountId: AGG, latitude: 34.7, longitude: 32.4 }),
]).length, 1);

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
