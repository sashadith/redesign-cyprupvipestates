#!/usr/bin/env node
/* Self-test for the shared-folder watcher (src/lib/shareWatch.ts).

   The watcher exists because Marfields' SharePoint folder changes two to four
   times a year, so a sync adapter would poll ~50 times to find nothing. Its
   whole job is to be quiet, and the ways it could fail are all ways of being
   loud: reporting a re-upload as a delete plus an add, reporting the entire
   folder on its first run, or reporting nothing when a file really moved.

     node scripts/qa/share-watch-check.mjs

   Exits non-zero on any failed assertion. */
import { build } from "esbuild";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const scratch = join(process.cwd(), "node_modules", ".share-watch-check");
mkdirSync(scratch, { recursive: true });
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
const out = await build({
  entryPoints: ["src/lib/shareWatch.ts"],
  bundle: true, platform: "node", format: "esm", write: false,
  external: ["@prisma/client", ".prisma/client/default"],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
const f = join(scratch, "w.mjs");
writeFileSync(f, out.outputFiles[0].text);
const { diffSnapshots, hasChanges, WATCHED_SHARES } = await import(f);

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `\n       erwartet ${JSON.stringify(expected)}, war ${JSON.stringify(actual)}`}`);
};
const e = (path, modified, size) => ({ path, modified, size });
const BASE = [
  e("/GAIA/pricelist/Gaia_all.pdf", "2026-07-10T00:00:00Z", 526000),
  e("/GAIA/plans/floor.pdf", "2024-05-09T00:00:00Z", 225000),
  e("/NCPR/NCPR Price List July 26.pdf", "2026-02-05T00:00:00Z", 399000),
];

console.log("\nthe first run stores a baseline instead of shouting");
{
  // 303 "added" lines for a folder nobody has watched before is noise, not news.
  const c = diffSnapshots(null, BASE);
  check("firstRun is flagged", c.firstRun, true);
  check("nothing is reported as added", c.added, []);
  check("total is still counted", c.total, 3);
  check("and it does not count as a change", hasChanges(c), false);
}

console.log("\na quiet week says nothing");
{
  const c = diffSnapshots(BASE, BASE.slice());
  check("no changes", [c.added, c.changed, c.removed], [[], [], []]);
  check("hasChanges is false", hasChanges(c), false);
}

console.log("\na re-uploaded price list is ONE change, not a delete plus an add");
{
  // The reason the snapshot is keyed by path and not by SharePoint item id:
  // a re-upload gets a new id, which by id reads as two events for what a
  // human calls "they updated the price list".
  const next = BASE.map((x) => x.path.includes("Gaia_all") ? e(x.path, "2026-09-09T00:00:00Z", 530000) : x);
  const c = diffSnapshots(BASE, next);
  check("one changed", c.changed, ["/GAIA/pricelist/Gaia_all.pdf"]);
  check("nothing added", c.added, []);
  check("nothing removed", c.removed, []);
  check("hasChanges is true", hasChanges(c), true);
}

console.log("\na same-timestamp overwrite is caught by the size");
{
  // SharePoint has been seen to leave modifiedTime untouched on a same-name
  // overwrite; the size is then the only evidence the content moved.
  const next = BASE.map((x) => x.path.includes("Gaia_all") ? e(x.path, x.modified, 999999) : x);
  const c = diffSnapshots(BASE, next);
  check("still reported as changed", c.changed, ["/GAIA/pricelist/Gaia_all.pdf"]);
}

console.log("\nadditions and removals are told apart");
{
  const next = [...BASE.filter((x) => !x.path.includes("NCPR")), e("/GAIA/pricelist/Gaia_2027.pdf", "2027-01-02T00:00:00Z", 1000)];
  const c = diffSnapshots(BASE, next);
  check("the new file", c.added, ["/GAIA/pricelist/Gaia_2027.pdf"]);
  check("the gone file", c.removed, ["/NCPR/NCPR Price List July 26.pdf"]);
  check("nothing miscounted as changed", c.changed, []);
}

console.log("\nlists come out sorted, so two mornings are comparable");
{
  const next = [...BASE, e("/ZZZ/b.pdf", "2027-01-01T00:00:00Z", 1), e("/AAA/a.pdf", "2027-01-01T00:00:00Z", 1)];
  check("added is sorted", diffSnapshots(BASE, next).added, ["/AAA/a.pdf", "/ZZZ/b.pdf"]);
}

console.log("\nthe watched list is configured, and Marfields is on it");
{
  check("at least one share", WATCHED_SHARES.length >= 1, true);
  const mf = WATCHED_SHARES.find((s) => s.key === "marfields");
  check("marfields present", !!mf, true);
  check("...with a SharePoint share link", /marfields-my\.sharepoint\.com\/:f:\//.test(mf?.url ?? ""), true);
  check("...and a human label", mf?.label, "Marfields");
}

console.log(`\n${failures ? `${failures} failed` : "all checks passed"}`);
process.exit(failures ? 1 : 0);
