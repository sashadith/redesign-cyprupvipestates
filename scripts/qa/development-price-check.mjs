#!/usr/bin/env node
/* Guard for resolveDevelopmentPrice (src/lib/developmentCard.ts) — the single
   place both the detail page and the /projects listing card derive a
   development's advertised price range.

   The bug this exists for (reported 2026-09-11): Georgia 12 (A&B) advertised
   "from €180,000" while its own units table listed 18 available flats starting
   at €160,000. The units were right; the headline was not.

   Root cause: the stored Development.priceFrom took precedence over the units
   (`devPriceFrom ?? pool`). That stored value is written by the sync adapters
   from the SOURCE DOCUMENT's prices, not from the unit rows a visitor is
   actually shown, and nothing ever reconciles the two — recomputeDevelopment
   DerivedState updates unit counts and the sold-out stamps but never touches
   prices, so an admin editing unit prices by hand (all 18 of Georgia 12's are
   source:"manual") left the headline frozen at whatever the last sync wrote.

   Measured across production before the fix: 8 of 247 published developments
   advertised a price that disagreed with their own units — five too LOW
   (VENARA advertised 305,000 against a real 365,000, so the visitor clicks and
   finds nothing at that price) and three too HIGH (Georgia 12 +20,000, which
   turns buyers away before they ever click).

   The rule now: units win, the stored value is only a fallback for a
   development that has no priced units at all — presentation pages carry a
   project-level price and no unit rows, and that must keep working.

     node scripts/qa/development-price-check.mjs

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
    entryPoints: [join(ROOT, entry)],
    bundle: true, platform: "node", format: "esm", write: false,
    external: ["@anthropic-ai/sdk", "@prisma/client"],
  });
  writeFileSync(path, out.outputFiles[0].text);
  written.push(path);
  return path;
}
const C = await import(await bundle("src/lib/developmentCard.ts", "development-card"));
process.on("exit", () => { for (const p of written) rmSync(p, { force: true }); });

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
}
const unit = (price, status = "available") => ({ status, price });
const price = (from, to, units) => C.resolveDevelopmentPrice(from, to, units);

/* The reported case, with Georgia 12's real numbers: 18 available units from
   160,000, a stored headline of 180,000 and no stored ceiling at all. The
   missing ceiling is itself evidence — priceTo was null, so it already fell
   through to the units and was the one figure on that page that was right. */
const georgia = [unit(160000), unit(165000), unit(170000), unit(175000), unit(180000), unit(310000)];
check("a stale stored floor loses to the units", price(180000, null, georgia).priceFrom, 160000);
check("the ceiling comes from the units too", price(180000, null, georgia).priceTo, 310000);

/* VENARA's shape: stored too LOW. This is the worse direction — the visitor
   clicks "from €305,000" and finds nothing under €365,000. */
check("a stored floor below the cheapest unit also loses",
  price(305000, null, [unit(365000), unit(400000)]).priceFrom, 365000);

/* A stored ceiling must not survive either, or a project can advertise a range
   no unit occupies. */
check("a stale stored ceiling loses to the units",
  price(null, 999000, [unit(200000), unit(250000)]).priceTo, 250000);

/* Presentation pages — a project-level price and no unit rows at all. Several
   exist (Marfields' three, Cybarco's six sold-out), and they must keep their
   advertised price rather than falling silent. */
check("no units at all keeps the stored floor", price(450000, 800000, []).priceFrom, 450000);
check("no units at all keeps the stored ceiling", price(450000, 800000, []).priceTo, 800000);
check("units without prices keep the stored floor",
  price(450000, null, [unit(null), unit(null)]).priceFrom, 450000);

/* Available units decide while any exist. A cheaper SOLD unit must never pull
   the advertised floor below what can actually be bought. */
check("a cheaper sold unit does not lower the floor",
  price(null, null, [unit(90000, "sold"), unit(200000), unit(250000)]).priceFrom, 200000);

/* Sold out: no available units left, so the pool falls back to every status and
   the page captions it "sold from" (see developmentCard's own comment and
   DevelopmentSchema's Offer.availability: SoldOut). Without this a sold-out
   project shows "Price on request" — the Celestia regression of 2026-08-06. */
check("sold out falls back to any-status prices",
  price(null, null, [unit(170000, "sold"), unit(190000, "sold")]).priceFrom, 170000);

/* Nothing anywhere: silence, not zero. */
check("no prices anywhere yields null", price(null, null, []).priceFrom, null);
check("…and a null ceiling, not 0", price(null, null, []).priceTo, null);

/* Letting the units win removes the accidental shield the stored value used to
   provide: a unit priced 0 or below would now surface as "from €0". Production
   holds no such row today (measured 2026-09-11: zero units at price <= 0), and
   this keeps it that way whichever adapter feeds it next. The Leptos adapter
   already nulls its price-on-application zeros upstream — this is the backstop,
   not a replacement for that. */
check("a zero-priced unit never becomes 'from €0'",
  price(null, null, [unit(0), unit(0)]).priceFrom, null);
check("a zero-priced unit does not drag a real floor down",
  price(null, null, [unit(0), unit(250000)]).priceFrom, 250000);
check("a negative price is ignored too",
  price(null, null, [unit(-5), unit(250000)]).priceFrom, 250000);
check("all-zero units still fall back to the stored floor",
  price(450000, null, [unit(0), unit(0)]).priceFrom, 450000);

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
