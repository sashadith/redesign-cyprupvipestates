#!/usr/bin/env node
/* Ground-truth check for the Cybarco listing-page parser (src/lib/cybarco.ts).

   The fixtures in scripts/qa/fixtures/cybarco/{listing.html,sitemap.xml} are a
   REAL capture of the live listing page and its Yoast sitemap, taken
   2026-09-10. Counted by hand off the live listing on 2026-09-10 and
   independently confirmed by the operator ("es sind 9 verfügbare projekte.
   rest ist sold out"), which is why 15/9/6 below is treated as ground truth
   and not as whatever the parser happens to produce.

     node scripts/qa/cybarco-parse-check.mjs

   Exits non-zero on the first failed assertion. */
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/* esbuild is a TRANSITIVE dependency here, not a declared one — it is present
   because something else pulls it in, and a future dependency change could
   remove it without any signal. Declaring it just for this dev-only script
   would force a `CVP_RUN_INSTALL=1` on the next production deploy for something
   that never runs in production, so it is imported defensively instead: a
   missing esbuild must say so, not crash with a bare module-not-found. */
let build;
try {
  ({ build } = await import("esbuild"));
} catch {
  console.error("esbuild is not installed (it is only a transitive dependency).\n  npm i -D esbuild   — or run this check from a tree where it is present.");
  process.exit(2);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const written = [];
/* Bundles land INSIDE the tree, not in tmpdir like the Korantina check does,
   because these keep `@anthropic-ai/sdk` and `@prisma/client` external — a
   bundle in /tmp cannot resolve them, and pulling the whole AI SDK into the
   bundle just to never call it is a slow way to prove nothing. */
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
process.on("exit", () => { for (const p of written) rmSync(p, { force: true }); });

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
}

const CB = await import(await bundle("src/lib/cybarco.ts", "cybarco"));
const fx = (n) => readFileSync(join(ROOT, "scripts/qa/fixtures/cybarco", n), "utf8");

const cards = CB.parseListing(fx("listing.html"), fx("sitemap.xml"));

/* Counted by hand off the live listing on 2026-09-10 and independently
   confirmed by the operator ("es sind 9 verfügbare projekte. rest ist sold
   out"), which is why 15/9/6 is treated as ground truth and not as whatever
   the parser happens to produce. */
check("15 projects", cards.length, 15);
check("9 not sold out", cards.filter((c) => c.status !== "sold_out").length, 9);
check("6 sold out", cards.filter((c) => c.status === "sold_out").length, 6);

/* The site spells the same status four ways — "Under construction", "Under
   Construction", "Sold Out", "Sold out". Normalisation is under test. */
check("status vocabulary is closed",
  [...new Set(cards.map((c) => c.status))].sort(),
  ["ready", "sold_out", "under_construction"]);

const by = (s) => cards.find((c) => c.slug === s);
check("naftikos name", by("naftikos-residences").name, "Naftikos Residences");
check("naftikos priceFrom", by("naftikos-residences").priceFrom, 740000);
check("naftikos district", by("naftikos-residences").district, "Limassol");
check("naftikos status", by("naftikos-residences").status, "under_construction");
check("akamas district keeps the region", by("akamas-bay-villas").district, "Pafos");
check("akamas priceFrom", by("akamas-bay-villas").priceFrom, 1260000);
check("marina is ready to move in", by("limassol-marina").status, "ready");
check("park residences is Nicosia", by("park-residences-nicosia").district, "Nicosia");

/* Four sold-out cards carry no link. Their slug comes from matching the card
   name against the sitemap — never from slugifying the display name, because a
   drifting derived slug re-keys a project and creates a duplicate Development.
   That is exactly how Korantina's table-ordinal bug manifested. */
check("the-oval resolved from sitemap", !!by("the-oval"), true);
check("sea-gallery-villas resolved from sitemap", !!by("sea-gallery-villas"), true);
check("aktea-residences-2 resolved from sitemap", !!by("aktea-residences-2"), true);
check("aktea-residences-3 resolved from sitemap", !!by("aktea-residences-3"), true);
check("every card has a slug", cards.every((c) => !!c.slug), true);
check("slugs are unique", new Set(cards.map((c) => c.slug)).size, 15);
check("sold-out cards have no priceFrom", by("the-oval").priceFrom, null);

check("sitemap yields only EN top-level project slugs",
  CB.slugsFromSitemap(fx("sitemap.xml")).includes("aktea-residences-3"), true);
check("sitemap excludes RU", CB.slugsFromSitemap(fx("sitemap.xml")).some((s) => s.startsWith("ru/")), false);
check("sitemap excludes subpages", CB.slugsFromSitemap(fx("sitemap.xml")).some((s) => s.includes("/")), false);

/* Two throws in cybarco.ts are safety-critical and must never regress into a
   silent default — the brief names the status throw as a binding constraint
   ("An unrecognised status mark must throw, not default to a value"), and the
   slug throw exists for the same reason (a drifting derived slug re-keys a
   project). Both hostile inputs are DERIVED from the real fixture string in
   memory below — no new fixture files, no edits to the committed fixtures. */
check("throws on an unrecognised status mark", (() => {
  const hostile = fx("listing.html").replace(
    '<span class="mark">Under construction</span>',
    '<span class="mark">Coming Soon</span>'
  );
  try {
    CB.parseListing(hostile, fx("sitemap.xml"));
    return "no throw";
  } catch (e) {
    return e.message.includes("unrecognised status mark") && e.message.includes("Coming Soon");
  }
})(), true);

check("throws when an unlinked card's name has no sitemap match", (() => {
  const hostile = fx("listing.html").replace(
    '<h3 class="h4">The Oval</h3>',
    '<h3 class="h4">Nonexistent Orphan Project</h3>'
  );
  try {
    CB.parseListing(hostile, fx("sitemap.xml"));
    return "no throw";
  } catch (e) {
    return e.message.includes("no sitemap slug") && e.message.includes("Nonexistent Orphan Project");
  }
})(), true);

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
