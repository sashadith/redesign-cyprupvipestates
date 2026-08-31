#!/usr/bin/env node
/* Self-test for freezeForPublished() in src/lib/feedSync.ts.

   The rule this covers had no test and cost real data: ten published Leptos
   projects were running through the full nightly sync, which rewrites
   district, area, town and the coordinates from the feed's own view every
   night. The unit-level guard people reach for does not help — manual units
   lock the UNITS out of the resync, not the Development row.

     node scripts/qa/freeze-published-check.mjs

   Exits non-zero on any failed assertion. */
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";

let build;
try { ({ build } = await import("esbuild")); }
catch { console.error("esbuild is not installed (transitive dep only)."); process.exit(2); }

// feedSync.ts imports Prisma and the whole sync machinery; stub the modules it
// pulls in so the pure function can be loaded on its own. The bundle must live
// inside the repo for node_modules to resolve.
const scratch = join(process.cwd(), "node_modules", ".freeze-check");
mkdirSync(scratch, { recursive: true });
const made = [];
process.on("exit", () => { for (const f of made) rmSync(f, { force: true }); rmSync(scratch, { recursive: true, force: true }); });
const stub = (name, body) => { const f = join(scratch, name); writeFileSync(f, body); made.push(f); return f; };
const prismaStub = stub("prisma.ts", "export const prisma = {};\n");

const out = await build({
  entryPoints: ["src/lib/feedSync.ts"],
  bundle: true, platform: "node", format: "esm", write: false,
  alias: { "@/lib/prisma": prismaStub },
  external: ["@prisma/client", ".prisma/client", "next/cache", "sharp", "xml2js", "@anthropic-ai/sdk"],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
const bundle = join(scratch, "feedsync.mjs");
writeFileSync(bundle, out.outputFiles[0].text);
made.push(bundle);
const { freezeForPublished } = await import(bundle);

let failures = 0;
const check = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
};
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// A feed's view of a project that has since been published and corrected.
const FEED = {
  publicName: "Feed Name", description: "feed text", amenities: ["Pool"], gallery: ["g"], plans: ["p"],
  district: "Limassol", area: "", town: "Feedtown", latitude: 34.1, longitude: 33.1,
  priceFrom: 250000, priceTo: 900000, status: "Available",
};

console.log("\ncontent fields — always dropped once published");
{
  const r = freezeForPublished(FEED, {});
  for (const k of ["publicName", "description", "amenities", "gallery", "plans"]) {
    check(`${k} is dropped even with nothing stored`, has(r, k), false);
  }
}

console.log("\nlocation — frozen only where a value already exists");
{
  const stored = { district: "Paphos", area: "Chloraka", town: "Chloraka", latitude: 34.77, longitude: 32.42 };
  const r = freezeForPublished(FEED, stored);
  for (const k of ["district", "area", "town", "latitude", "longitude"]) {
    check(`${k} is protected when stored`, has(r, k), false);
  }
}
{
  // The case that made "freeze only when set" necessary: 22 of 45 Leptos
  // projects arrived with no coordinates at all.
  const r = freezeForPublished(FEED, { district: "Paphos" });
  check("district stays protected", has(r, "district"), false);
  check("a missing latitude can still be filled", r.latitude, 34.1);
  check("a missing longitude can still be filled", r.longitude, 33.1);
  check("a missing town can still be filled", r.town, "Feedtown");
}
{
  // "" is what leptosVm/squareOne store when town === district; treating it as
  // a value would freeze the blank in place forever.
  const r = freezeForPublished(FEED, { area: "", latitude: null });
  check("an empty area is not treated as set", has(r, "area"), true);
  check("a null latitude is not treated as set", r.latitude, 34.1);
}
{
  // 0 is a legitimate coordinate and must not read as "unset".
  const r = freezeForPublished({ ...FEED, latitude: 34.1 }, { latitude: 0 });
  check("latitude 0 counts as set", has(r, "latitude"), false);
}

console.log("\nprices and everything else pass straight through");
{
  // The stored row deliberately carries prices too. Without them here the
  // assertion passes for the wrong reason — "not frozen" and "never a
  // candidate for freezing" look identical — and adding priceFrom to the
  // freeze list survives the whole suite. Found by mutation, 2026-08-31.
  const stored = { district: "Paphos", latitude: 34.77, longitude: 32.42, priceFrom: 111000, priceTo: 222000, status: "Sold" };
  const r = freezeForPublished(FEED, stored);
  check("priceFrom still updates", r.priceFrom, 250000);
  check("priceTo still updates", r.priceTo, 900000);
  check("status still updates", r.status, "Available");
}

console.log("\nthe input is not mutated");
{
  const input = { ...FEED };
  freezeForPublished(input, { district: "Paphos", latitude: 1, longitude: 2 });
  check("caller's object is untouched", Object.keys(input).length, Object.keys(FEED).length);
  check("caller still has publicName", input.publicName, "Feed Name");
}

console.log(`\n${failures ? `${failures} failed` : "all checks passed"}`);
process.exit(failures ? 1 : 0);
