#!/usr/bin/env node
/* Self-test for the two nightly sold-out sweeps (src/lib/soldOutSweeps.ts).

   Both sweeps share one failure shape: the signal they read goes quiet for a
   whole developer (or for the whole site) exactly as it does for one dead
   project, so without a guard an outage reads as "everything is gone". These
   assertions exist for the guards, not for the happy path.

     node scripts/qa/sold-out-sweep-check.mjs

   Exits non-zero on any failed assertion. */
import { build } from "esbuild";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const scratch = join(process.cwd(), "node_modules", ".sold-out-sweep-check");
mkdirSync(scratch, { recursive: true });
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
const out = await build({
  entryPoints: ["src/lib/soldOutSweeps.ts"],
  bundle: true, platform: "node", format: "esm", write: false,
  external: ["@prisma/client", ".prisma/client/default"],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
const f = join(scratch, "s.mjs");
writeFileSync(f, out.outputFiles[0].text);
const { isMissingFromFeed, slugFromPage, sumImpressionsForSlug, MISSING_FROM_FEED_DAYS, PEER_FRESH_HOURS, DEAD_PAGE_IMPRESSION_DAYS } = await import(f);

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `\n       erwartet ${JSON.stringify(expected)}, war ${JSON.stringify(actual)}`}`);
};
const NOW = new Date("2026-09-09T04:00:00Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * 86_400_000);
const hoursAgo = (n) => new Date(NOW.getTime() - n * 3_600_000);

console.log("\nthe thresholds are the ones that were reasoned about");
check("missing after 5 days", MISSING_FROM_FEED_DAYS, 5);
check("a peer counts as fresh for 48 hours", PEER_FRESH_HOURS, 48);
check("a page is dead after 90 days without an impression", DEAD_PAGE_IMPRESSION_DAYS, 90);

/* The guard this sweep exists for. A whole feed going quiet freezes every one
   of that developer's projects at the same age — five days of an outage must
   not read as the entire catalogue selling out. */
console.log("\na whole developer going stale is an outage, not a sell-out");
check("every project stale: nothing fires",
  isMissingFromFeed(daysAgo(9), [daysAgo(9), daysAgo(9), daysAgo(9)], NOW), false);
check("...even at 60 days stale",
  isMissingFromFeed(daysAgo(60), [daysAgo(60), daysAgo(60)], NOW), false);
check("...and a developer with no siblings at all cannot fire either",
  isMissingFromFeed(daysAgo(30), [], NOW), false);
check("one stale among fresh IS the project being gone",
  isMissingFromFeed(daysAgo(9), [daysAgo(9), hoursAgo(2), daysAgo(9)], NOW), true);

console.log("\nthe 5-day floor holds");
check("4 days is still a hiccup", isMissingFromFeed(daysAgo(4), [hoursAgo(2)], NOW), false);
check("5 days exactly is missing", isMissingFromFeed(daysAgo(5), [hoursAgo(2)], NOW), true);
check("just under 5 days is not", isMissingFromFeed(hoursAgo(119), [hoursAgo(2)], NOW), false);

console.log("\nthe peer-freshness window is 48 hours, not 24");
// Drive and SharePoint developers sync weekly and move as a block; a run that
// slips by a day must not disarm the guard for the whole developer.
check("a peer synced 47h ago still counts", isMissingFromFeed(daysAgo(9), [hoursAgo(47)], NOW), true);
check("a peer synced 49h ago does not", isMissingFromFeed(daysAgo(9), [hoursAgo(49)], NOW), false);

console.log("\na row that never synced is a manual row, not a missing one");
check("null syncedAt never fires", isMissingFromFeed(null, [hoursAgo(1)], NOW), false);
check("null peers are ignored, not counted as fresh",
  isMissingFromFeed(daysAgo(9), [null, null, daysAgo(9)], NOW), false);

console.log("\nimpressions are summed across every locale the page appears under");
{
  const m = new Map([
    ["/projects/tenera-homes", 300],
    ["/de/projects/tenera-homes", 100],
    ["/ru/projects/tenera-homes/", 12],
    ["/projects/tenera-homes?utm=x", 5],
    ["/projects/tenera-homes-2", 999],   // a DIFFERENT project
    ["/projects/other", 40],
  ]);
  check("all four locale/query variants add up", sumImpressionsForSlug(m, ["tenera-homes"]), 417);
  check("a longer slug is not the same project", sumImpressionsForSlug(m, ["tenera-homes-2"]), 999);
  check("an unknown slug is zero", sumImpressionsForSlug(m, ["nothing-here"]), 0);
  check("trailing slash", slugFromPage("/projects/x/"), "x");
  check("query string", slugFromPage("/projects/x?a=1"), "x");
  check("fragment", slugFromPage("/projects/x#top"), "x");
  check("plain", slugFromPage("/de/projects/x"), "x");
}

/* The defect the production dry run caught before this ever ran: a
   Development's traffic can live under a superseded legacy page's slug, which
   carries a developer suffix. 122 of 344 developments are in that shape, so
   matching the Development slug alone would have archived live pages. */
console.log("\na superseded legacy page's traffic counts as the project's own");
{
  const m = new Map([
    ["/projects/germasogeia-view-2-island-blue", 8],
    ["/en/projects/germasogeia-view-2-island-blue", 6],
    ["/de/projects/germasogeia-view-2-island-blue", 1],
    ["/projects/germasogeia-view", 1],            // a DIFFERENT, still-live project
  ]);
  check("the development slug alone finds nothing", sumImpressionsForSlug(m, ["germasogeia-view-2"]), 0);
  check("...with the superseded slug it finds all 15", sumImpressionsForSlug(m, ["germasogeia-view-2", "germasogeia-view-2-island-blue"]), 15);
  check("and the neighbouring project is not swept in", sumImpressionsForSlug(m, ["germasogeia-view-2", "germasogeia-view-2-island-blue"]) === 16, false);
  check("an empty or null slug in the list is ignored", sumImpressionsForSlug(m, ["", "germasogeia-view"]), 1);
}

console.log(`\n${failures ? `${failures} failed` : "all checks passed"}`);
process.exit(failures ? 1 : 0);
