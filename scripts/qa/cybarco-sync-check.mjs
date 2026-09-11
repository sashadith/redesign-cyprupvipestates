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
