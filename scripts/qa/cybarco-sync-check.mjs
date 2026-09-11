#!/usr/bin/env node
/* Assertions for the pure decisions inside src/lib/cybarcoSync.ts — the five
   helpers the write path hangs off, each of which was a review finding:

   - cybarcoUnitRef / duplicateRefs : a unit's identity must survive
     normalizeRef(), and the duplicate checker must count the key the Client
     Presentation matcher counts, not the raw string.
   - unitPlan                       : the unit list and the price range derived
     from it are ONE credibility decision.
   - contentNeeds                   : "what is still missing" per asset kind,
     plans included, so the documented pdftoppm remedy works without --force.
   - soldOutStamp                   : a sold-out date is written only when
     nothing can clear it again.
   - runVerdict                     : a night the site rate-limited must not log
     as an indistinguishably healthy one.

   No database, no network, no PDF: every helper here is pure. The real
   normalizeRef from src/lib/unitRef.ts is used (never a copy of it), because
   "does the matcher see one unit or two" is the only question worth asking.

     node scripts/qa/cybarco-sync-check.mjs

   Exits non-zero on any failed assertion. */
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

/* esbuild is a TRANSITIVE dependency, not a declared one (see
   gv-pricelist-check.mjs): a missing one must say so rather than crash. */
let build;
try {
  ({ build } = await import("esbuild"));
} catch {
  console.error("esbuild is not installed (it is only a transitive dependency).\n  npm i -D esbuild   — or run this check from a tree where it is present.");
  process.exit(2);
}

/* cybarcoSync.ts imports @/lib/prisma, which CONSTRUCTS a PrismaClient at
   module load. Nothing here ever issues a query, but the constructor wants a
   URL to exist — so a placeholder is supplied rather than .env.local, which
   points at the live production database. If this line is ever removed and the
   check starts reading a real DATABASE_URL, that is a bug in the check. */
process.env.DATABASE_URL ||= "postgresql://unused:unused@127.0.0.1:1/unused";

const scratch = join(process.cwd(), "node_modules", ".cybarco-sync-check");
mkdirSync(scratch, { recursive: true });
const written = [];
process.on("exit", () => { for (const f of written) rmSync(f, { force: true }); rmSync(scratch, { recursive: true, force: true }); });

async function bundle(entry, name) {
  const out = await build({
    entryPoints: [entry],
    bundle: true, platform: "node", format: "esm", write: false,
    external: ["@prisma/client", ".prisma/client/default", "@anthropic-ai/sdk", "canvas"],
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  });
  const f = join(scratch, `${name}.mjs`);
  writeFileSync(f, out.outputFiles[0].text);
  written.push(f);
  return f;
}

const S = await import(await bundle("src/lib/cybarcoSync.ts", "sync"));
const { normalizeRef } = await import(await bundle("src/lib/unitRef.ts", "unitref"));

let failures = 0;
const check = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
};

const unit = (block, ref) => ({
  ref, block,
  floor: null, beds: null, areaInternal: null, areaVeranda: null,
  areaBuilt: null, areaPlot: null, price: null, status: "available",
});

/* ── 1. Identity: the block has to survive normalizeRef ──────────────────── */
console.log("cybarcoUnitRef — block qualification");
check("no block keeps the printed reference", S.cybarcoUnitRef(unit(null, "101")), "101");
check("Naftikos: BUILDING A + 'A 101' is not doubled", S.cybarcoUnitRef(unit("BUILDING A", "A 101")), "A 101");
check("Seaview: BUILDING A + 'A101' is not doubled", S.cybarcoUnitRef(unit("BUILDING A", "A101")), "A101");
check("Marina: a named section keeps its whole name", S.cybarcoUnitRef(unit("Island Villas", "85")), "Island Villas 85");
check("Centro: ЗДАНИЕ Б + 101 transliterates to B 101", S.cybarcoUnitRef(unit("ЗДАНИЕ Б", "101")), "B 101");
check("a third building ЗДАНИЕ В transliterates to V 101", S.cybarcoUnitRef(unit("ЗДАНИЕ В", "101")), "V 101");
check("Cyrillic letter INSIDE the reference is folded too", S.cybarcoUnitRef(unit("ЗДАНИЕ Б", "Б101")), "B101");
check("Trilogy: EAST TOWER keeps its heading", S.cybarcoUnitRef(unit("EAST TOWER", "1701")), "EAST TOWER 1701");

console.log("transliterate");
check("Cyrillic building word", S.transliterate("ЗДАНИЕ Б"), "ZDANIE B");
check("Greek is covered as well", S.transliterate("Β"), "V");
check("Latin is untouched", S.transliterate("BUILDING A 101"), "BUILDING A 101");
check("lower case stays lower case", S.transliterate("б"), "b");

/* THE finding: normalizeRef() ends in an ASCII-only character class, so a
   Cyrillic tag is erased by it and two different flats become one key. These
   four assertions are the fix — they fail the moment cybarcoUnitRef stops
   transliterating. */
console.log("the matcher's key (normalizeRef) tells the buildings apart");
const keyOf = (block, ref) => normalizeRef(S.cybarcoUnitRef(unit(block, ref)), "Centro Limassol");
check("ЗДАНИЕ Б 101 keys as b101", keyOf("ЗДАНИЕ Б", "101"), "b101");
check("ЗДАНИЕ В 101 keys as v101", keyOf("ЗДАНИЕ В", "101"), "v101");
check("Б and В are different keys", keyOf("ЗДАНИЕ Б", "101") !== keyOf("ЗДАНИЕ В", "101"), true);
/* Centro's page 1 spells the letter with a LATIN A inside the Cyrillic word; if
   Cybarco ever correct that typo the key must not move. */
check("Latin A and Cyrillic А key identically", keyOf("ЗДАНИЕ A", "101") === keyOf("ЗДАНИЕ А", "101"), true);

/* ── EVERY heading BLOCK_RE matches, and the reference it produces ─────────
   `ref` is rendered to clients (src/app/preview-project/UnitsView.tsx), so what
   blockTag() strips out of a section heading is a client-facing decision and
   not an internal one. The eight assertions above name the interesting cases;
   these name ALL of them, because the cases that broke were the ones nobody had
   written down: widening BLOCK_RE for Limassol Greens made "Villas Pricelist
   31" and "Starlings Apartments Block A A001" publishable references, and every
   assertion in this file stayed green while it did.

   The twenty (heading, printed reference) pairs below were read off the nine
   committed fixtures on 2026-09-11 — every distinct non-null `block` the reader
   produces, with the first reference printed under it — so the list IS the
   corpus BLOCK_RE matches, not a sample of it. Three documents (Aktea 4, Akamas
   Villas, Park Residences) print no heading at all and are the null-block row
   at the top of this section. Kept as literals rather than re-derived from the
   fixtures because this file deliberately loads no PDF; the pairs are pinned in
   scripts/qa/cybarco-pricelist-check.mjs on the reader's side.

   Sixteen of the twenty must produce exactly what they produced before
   2026-09-11 — a change there is a silent migration of live references — and
   the four Limassol Greens captions are the fix. */
console.log("cybarcoUnitRef — all TWENTY headings the nine fixtures print");
const HEADINGS = [
  // doc                heading                          printed ref  client-facing ref
  ["naftikos",          "BUILDING A",                    "A 101",     "A 101"],
  ["naftikos",          "BUILDING B",                    "B 101",     "B 101"],
  ["centro-ru",         "ЗДАНИЕ A",                      "101",       "A 101"],
  ["centro-ru",         "ЗДАНИЕ Б",                      "101",       "B 101"],
  ["marina",            "Castle Residences",             "B22",       "Castle Residences B22"],
  ["marina",            "Island Villas",                 "54",        "Island Villas 54"],
  ["trilogy",           "EAST TOWER",                    "1701",      "EAST TOWER 1701"],
  ["trilogy",           "NORTH RESIDENCES (A)",          "304",       "NORTH RESIDENCES (A) 304"],
  ["trilogy",           "NORTH RESIDENCES (B)",          "1005",      "NORTH RESIDENCES (B) 1005"],
  ["limassol-greens",   "Starlings Apartments Block A",  "A001",      "A001"],
  ["limassol-greens",   "Villas Pricelist",              "31",        "Villas 31"],
  ["limassol-greens",   "Ibis Townhouses Pricelist",     "1",         "Ibis Townhouses 1"],
  ["limassol-greens",   "Kinglet Villas Pricelist",      "1",         "Kinglet Villas 1"],
  ["seaview-heights",   "BUILDING A",                    "A101",      "A101"],
  ["seaview-heights",   "BUILDING B",                    "B101",      "B101"],
  ["seaview-heights",   "BUILDING C",                    "C101",      "C101"],
  ["seaview-heights",   "BUILDING D",                    "D101",      "D101"],
  ["seaview-heights",   "BUILDING E",                    "E101",      "E101"],
  ["seaview-heights",   "BUILDING F",                    "F101",      "F101"],
  ["seaview-heights",   "VILLAS",                        "1",         "VILLAS 1"],
];
check("the list is the measured twenty, not a subset", HEADINGS.length, 20);
for (const [doc, block, ref, expected] of HEADINGS) {
  check(`${doc}: "${block}" + "${ref}"`, S.cybarcoUnitRef(unit(block, ref)), expected);
}
/* The shape of the failure, stated once so a regression reads as what it is:
   nothing a client sees may contain a caption word or a marketing name that the
   document prints only to caption the table. `label` keeps the full spelling. */
check("no client-facing reference carries a price-list caption",
  HEADINGS.map(([, block, ref]) => S.cybarcoUnitRef(unit(block, ref)))
    .filter((r) => /pricelist|price\s*-?\s*list|прайс/i.test(r)), []);
check("no client-facing reference repeats its building letter",
  (S.cybarcoUnitRef(unit("Starlings Apartments Block A", "A001")).match(/A/g) ?? []).length, 1);
/* The two Limassol Greens tables that collide on a bare reference — townhouse 1
   and Kinglet villa 1 — must stay two units after the captions are stripped.
   Stripping too much is the failure mode this catches: both would become "1". */
check("Greens' townhouse 1 and Kinglet villa 1 are still two keys",
  S.duplicateRefs([unit("Ibis Townhouses Pricelist", "1"), unit("Kinglet Villas Pricelist", "1"),
    unit("Villas Pricelist", "31")], "Limassol Greens"), []);

console.log("duplicateRefs — keyed the way the matcher keys it");
check("Centro's two buildings do not collide once qualified",
  S.duplicateRefs([unit("ЗДАНИЕ Б", "101"), unit("ЗДАНИЕ В", "101")], "Centro Limassol"), []);
check("bare 101 twice with no block IS a collision",
  S.duplicateRefs([unit(null, "101"), unit(null, "101")], "Centro Limassol"), ["101 (101 + 101)"]);
/* Counting raw strings cannot see this one: "A 101" and "A101" are two
   different strings and one single matcher key. */
check("different strings, one normalizeRef key, still reported",
  S.duplicateRefs([unit("BUILDING A", "101"), unit(null, "A101")], "Seaview Heights"), ["a101 (A 101 + A101)"]);
check("Cyrillic pair that normalizeRef WOULD have merged is clean",
  S.duplicateRefs([unit("ЗДАНИЕ Б", "101"), unit("ЗДАНИЕ Б", "102"), unit("ЗДАНИЕ В", "101")], "Centro Limassol"), []);

/* ── 2. Units and the price range are one decision ───────────────────────── */
console.log("unitPlan — the unit list and the price range it produced");
const plan = (hasPriceList, fresh, stored, force) => {
  const r = S.unitPlan({ hasPriceList, fresh, stored, force });
  return { write: r.write, keepStored: r.keepStored, reason: r.reason === null ? null : "said" };
};
check("a fresh project with a list writes", plan(true, 60, 0, false), { write: true, keepStored: false, reason: null });
check("an unchanged list writes", plan(true, 60, 60, false), { write: true, keepStored: false, reason: null });
check("Marina losing one row of five still writes", plan(true, 4, 5, false), { write: true, keepStored: false, reason: null });
check("a 0-unit read keeps units AND their price range", plan(true, 0, 60, false), { write: false, keepStored: true, reason: "said" });
check("a 27% drop keeps units AND their price range", plan(true, 44, 60, false), { write: false, keepStored: true, reason: "said" });
check("force overrides and takes the range with it", plan(true, 0, 60, true), { write: true, keepStored: false, reason: "said" });
check("no price list any more: stored units and range kept", plan(false, 0, 60, false), { write: false, keepStored: true, reason: "said" });
check("no price list and nothing stored is silent", plan(false, 0, 0, false), { write: false, keepStored: false, reason: null });

/* ── 3. What still has to be fetched ─────────────────────────────────────── */
console.log("contentNeeds — per asset kind");
const needs = (o) => S.contentNeeds({
  published: false, force: false,
  offeredImages: 0, storedImages: 0, hasBrochure: false, brochurePages: 0, storedPlans: 0, ...o,
});
check("a new project needs both",
  needs({ offeredImages: 36, hasBrochure: true, brochurePages: 20 }), { gallery: true, plans: true });
/* THE finding: first run on the laptop stored 36 photos and 0 plans because
   pdftoppm is absent there. The corrective run on the VPS must still fetch the
   brochure — with an empty gallery as the only proxy it never did. */
check("laptop run stored photos but no plans: the VPS run fetches the brochure",
  needs({ offeredImages: 36, storedImages: 36, hasBrochure: true, brochurePages: 20, storedPlans: 0 }),
  { gallery: false, plans: true });
check("a fully stored project asks for nothing",
  needs({ offeredImages: 36, storedImages: 36, hasBrochure: true, brochurePages: 20, storedPlans: 20 }),
  { gallery: false, plans: false });
/* THE finding this task fixes: `storeUploadedImage` returns null on any
   image-processing or disk error, so with no tolerance a single page that
   failed to store left a project needing plans forever — every night
   re-reading the brochure, re-rasterising up to 100 pages, and (once
   mediaChanged) triggering a hard pm2 restart, for a gap that could never
   close. One page short of a 51-page brochure (Trilogy's measured length) must
   read as "done", not "still needs plans". */
check("Trilogy losing exactly one page of 51 to a store failure is NOT retried forever",
  needs({ hasBrochure: true, brochurePages: 51, storedPlans: 50 }), { gallery: false, plans: false });
/* The tolerance is a page COUNT, not a shortfall this small brochure could
   also exhibit from the very same one-page failure — same failure, same
   constant, regardless of the brochure's length. */
check("a 3-page brochure losing its last page to the same failure is NOT retried forever",
  needs({ hasBrochure: true, brochurePages: 3, storedPlans: 2 }), { gallery: false, plans: false });
/* Two pages short is a real gap, not the tolerated single-page failure — must
   still be fetched, or the tolerance would silently swallow a genuine loss. */
check("Trilogy losing two of 51 pages IS still fetched",
  needs({ hasBrochure: true, brochurePages: 51, storedPlans: 49 }), { gallery: false, plans: true });
/* The tolerance must never cover "nothing was ever stored" — a brochure with
   only one page in it is the edge case that would break if the tolerance were
   applied unconditionally (storedPlans 0 < brochurePages(1) - 1 = 0 is FALSE),
   so zero stored is checked before the tolerance, not folded into the same
   arithmetic. This is what keeps the VPS's first honest run fetching plans for
   every project even though PLANS_PAGE_TOLERANCE is nonzero. */
check("a single-page brochure with nothing stored yet is still fetched",
  needs({ hasBrochure: true, brochurePages: 1, storedPlans: 0 }), { gallery: false, plans: true });
check("a single-page brochure already stored asks for nothing",
  needs({ hasBrochure: true, brochurePages: 1, storedPlans: 1 }), { gallery: false, plans: false });
check("an unreadable brochure this run is not re-fetched blindly",
  needs({ offeredImages: 4, storedImages: 4, hasBrochure: true, brochurePages: 0, storedPlans: 0 }),
  { gallery: false, plans: false });
/* The Aktea-2 class: the listing card's single photo was stored because a fetch
   failed; the gallery page now answers with 18. */
check("one stored photo against 18 offered is re-gathered",
  needs({ offeredImages: 18, storedImages: 1 }), { gallery: true, plans: false });
check("4 stored against 63 offered is re-gathered",
  needs({ offeredImages: 63, storedImages: 4 }), { gallery: true, plans: false });
check("17 of 18 stored is NOT re-downloaded every night",
  needs({ offeredImages: 18, storedImages: 17 }), { gallery: false, plans: false });
check("no image offered at all asks for nothing",
  needs({ offeredImages: 0, storedImages: 0 }), { gallery: false, plans: false });
check("force asks for everything",
  needs({ force: true, offeredImages: 36, storedImages: 36, hasBrochure: true, brochurePages: 20, storedPlans: 20 }),
  { gallery: true, plans: true });
check("a published Development is never re-gathered, gaps and force included",
  S.contentNeeds({ published: true, force: true, offeredImages: 36, storedImages: 0, hasBrochure: true, brochurePages: 20, storedPlans: 0 }),
  { gallery: false, plans: false });

/* ── 3b. And whether anything a RESTART would pick up actually moved ───────
   contentNeeds decides what is fetched; mediaListChanged decides whether the
   run asks for scheduleAppRestart(), a hard pm2 restart that cuts in-flight
   requests. Those are two different questions and conflating them is what made
   the nightly-restart loop: `mediaChanged` used to be set on every SUCCESSFUL
   store, so Trilogy — 49 of 51 brochure pages storable, a deterministic
   shortfall past PLANS_PAGE_TOLERANCE — re-fetched, re-rasterised and re-stored
   the same 49 content-hashed pages every night at 01:00 and restarted the app
   every night for a gap that will never close.

   Both directions are pinned, because either one alone is a bug: a first run
   that stores fifteen projects' plans and asks for NO restart serves them out
   of a bundle that does not know they exist. */
console.log("mediaListChanged — a restart only when a mirrored list actually moved");
const P = (...n) => n.map((i) => `/uploads/cybarco-${i}.jpg`);
check("first run: nothing stored, pages stored now — CHANGED",
  S.mediaListChanged(P(1, 2, 3), []), true);
check("Trilogy's nightly re-store of the identical 49 — not a change",
  S.mediaListChanged(P(...Array.from({ length: 49 }, (_, i) => i)), P(...Array.from({ length: 49 }, (_, i) => i))), false);
check("the shortfall closing later (49 -> 51) IS a change",
  S.mediaListChanged(P(1, 2, 3), P(1, 2)), true);
check("one page replaced by a different one IS a change",
  S.mediaListChanged(P(1, 9), P(1, 2)), true);
check("re-ordered is treated as a change, not as equality",
  S.mediaListChanged(P(2, 1), P(1, 2)), true);
/* Nothing gathered is never a change — a run that did not fetch (needs.gallery
   false) or lost the brochure to a 429 leaves the stored list alone, and
   syncCybarco only writes `gallery`/`plans` when the fresh list is non-empty. */
check("nothing gathered this run is not a change",
  S.mediaListChanged([], P(1, 2)), false);
check("nothing gathered and nothing stored is not a change",
  S.mediaListChanged([], []), false);

/* ── 4. The sold-out stamp ───────────────────────────────────────────────── */
console.log("soldOutStamp — read after the recompute, never before");
/* available === 0 covers both shapes that must stamp: the six projects that
   have no units at all, and a project that just transitioned and whose stored
   feed units were all corrected to sold a few lines earlier. */
check("nothing available: stamp it",
  S.soldOutStamp({ soldOutSince: null, available: 0 }), { stamp: true, contradiction: false });
/* THE finding: stamping while units still read available is what the recompute
   undid two lines later, every night. */
check("available units left: do NOT stamp, say so",
  S.soldOutStamp({ soldOutSince: null, available: 3 }), { stamp: false, contradiction: true });
check("already stamped: leave the first date alone",
  S.soldOutStamp({ soldOutSince: new Date("2026-01-01"), available: 0 }), { stamp: false, contradiction: false });
check("already stamped and contradicted: still not re-stamped",
  S.soldOutStamp({ soldOutSince: new Date("2026-01-01"), available: 3 }), { stamp: false, contradiction: false });

/* ── 5. Was the run healthy, or did the site refuse it? ──────────────────────

   Cybarco rate-limit in practice: two of the three acceptance dry runs each lost
   one brochure to a transient 429. Before runVerdict every such night resolved
   ok:true and the summary dropped the notes, so a night where the site refused
   EVERY fetch logged the same row as a quiet one — and shouldNotifyFailureStreak
   could never fire. The line these assertions pin is WHERE the alarm sits: high
   enough that a normal night is silent, low enough that a refused sweep is not. */
console.log("runVerdict — a refused run must not log as a healthy one");
const verdict = (attempted, failed) => {
  const v = S.runVerdict({ attempted, failed });
  return { ok: v.ok, reason: v.reason === null ? null : "said" };
};
/* The two measured real shapes. Run 1/2 of acceptance: ~50 fetches (15 project
   pages + 15 gallery pages + 11 brochures + 9 price lists), one lost brochure. */
check("one brochure lost out of 50 is a HEALTHY night", verdict(50, 1), { ok: true, reason: null });
check("a clean run is healthy and silent", verdict(50, 0), { ok: true, reason: null });
/* Cloudflare refusing the sweep: every project's two page fetches fail, and a
   failed project page means its brochure and price list are never even tried. */
check("every page fetch refused is a FAILED run, and says why", verdict(30, 30), { ok: false, reason: "said" });
check("a mostly-refused sweep fails too", verdict(50, 41), { ok: false, reason: "said" });
/* The threshold itself, from both sides — a majority, not "any failure". */
check("exactly half refused is NOT a failure", verdict(50, 25), { ok: true, reason: null });
check("one over half IS a failure", verdict(50, 26), { ok: false, reason: "said" });
/* A third of the run lost is a bad night, not a blocked one: failing it would
   put an URGENT item in front of the operator on nights the data is still good,
   which is how an alarm gets ignored by the time it matters. */
check("a third refused still reports ok — the notes carry it", verdict(48, 16), { ok: true, reason: null });
/* No denominator worth dividing: gatherCybarco throws outright when the listing
   parses to zero cards, so a handful of attempts is not a verdict shape at all. */
check("too few attempts to judge: no verdict", verdict(4, 4), { ok: true, reason: null });
check("zero attempts cannot divide", verdict(0, 0), { ok: true, reason: null });
/* The floor is 10 attempts — the first shape that IS judged. */
check("ten attempts all refused is judged", verdict(10, 10), { ok: false, reason: "said" });
/* The reason has to name the numbers: it is what CronRunLog.message and the
   failure notification quote, and "something went wrong" is not actionable. */
check("the reason quotes both counts", /\b21 of 30 fetch\(es\)/.test(S.runVerdict({ attempted: 30, failed: 21 }).reason ?? ""), true);

console.log(failures ? `\n${failures} assertion(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
