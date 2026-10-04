#!/usr/bin/env node
/* Guard for the feed-completeness block (src/lib/feedSync.ts:
   countableFeedUnits + completenessVerdict, used by checkFeedCompleteness and
   syncMitoCore).

   Why it changed on 2026-09-24: Island Blue stopped shipping sold-out projects
   in their units document. Their feed went from ~220 units to 107, our 144
   stored sold units were met by 34, and the guard read that as "71 of 174
   missing, 41 %" and refused their sync every night from 2026-09-18 on. It was
   refusing to prevent a loss that cannot happen — a sold unit on a PUBLISHED
   development is skipped by syncFeedUnitsPreservingUnlisted's hard rule.
   Meanwhile their 69 genuinely available units, 39 more than we held, never
   reached the site.

   The rule both sides now share: count only units this sync could still
   change. That means excluding sold units exactly where they are provably
   safe — published developments — and NOWHERE else, because an unpublished
   development takes deleteMany({source:"feed"}) + createMany, where every unit
   is at risk. Mito is unpublished by design and therefore counts everything.

   Two ways this regresses silently, both pinned below:
     - excluding sold on ONE side only, which the pre-existing comment already
       warned about: before falls far below after and the guard can never fire
       again for developers who DO ship sold units (Medousa, Aristo);
     - the smaller denominator quietly dropping a developer under the 20-unit
       absolute floor, so a total feed failure stops being caught.

     node scripts/qa/feed-completeness-check.mjs

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
const bundlePath = join(ROOT, `.qa-feed-completeness-${process.pid}.mjs`);
process.on("exit", () => rmSync(bundlePath, { force: true }));

const out = await build({
  entryPoints: [join(ROOT, "src/lib/feedSync.ts")],
  bundle: true, platform: "node", format: "esm", write: false,
  external: ["@prisma/client", "@anthropic-ai/sdk", "sharp", "imapflow", "nodemailer"],
  // feedSync pulls in xml2js, which `require`s node builtins at load time —
  // esbuild's ESM output cannot do that without a require shim.
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
});
writeFileSync(bundlePath, out.outputFiles[0].text);
const F = await import(bundlePath);

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
}

const ABS = 20, MITO_ABS = 3;
const unit = (status) => ({ status });
const feed = (available, sold, reserved = 0) => [
  ...Array.from({ length: available }, () => unit("available")),
  ...Array.from({ length: sold }, () => unit("sold")),
  ...Array.from({ length: reserved }, () => unit("reserved")),
];
const blocked = (before, after, abs = ABS) => F.completenessVerdict(before, after, abs).blocked;

/* ---- countableFeedUnits: what the after side is allowed to count ---- */

/* A published project: sold units are untouchable, so they are not measured. */
check("a published project counts only what can change",
  F.countableFeedUnits(feed(69, 34), true), 69);
/* The same project unpublished: deleteMany would take the lot. */
check("an unpublished project counts everything",
  F.countableFeedUnits(feed(69, 34), false), 103);
check("reserved is not sold and always counts",
  F.countableFeedUnits(feed(0, 0, 12), true), 12);
check("an all-sold published project counts nothing",
  F.countableFeedUnits(feed(0, 10), true), 0);
check("…but unpublished it counts all ten", F.countableFeedUnits(feed(0, 10), false), 10);
check("an empty feed response is zero either way",
  [F.countableFeedUnits([], true), F.countableFeedUnits([], false)], [0, 0]);

/* ---- the reported case, with Island Blue's real figures ---- */

/* Measured 2026-09-24. Before the fix: 174 held (144 sold + 30 available)
   against 103 returned. After: 30 against 69 — the feed offers MORE than we
   hold, which is the actual situation and the opposite of an emergency. */
check("the old counting blocked Island Blue", blocked(174, 103), true);
check("the new counting lets Island Blue through", blocked(30, 69), false);
check("…and reports a negative shortfall, not a positive one",
  F.completenessVerdict(30, 69, ABS).missing, -39);

/* ---- the one-sided-exclusion trap the old comment warned about ---- */

/* Medousa's real shape (2026-09-24): 166 countable of 328 held. If sold were
   dropped from the before side while the after side still counted the feed's
   sold units, before would sit far below after and nothing could ever block —
   the guard would be decoration for exactly the developers who still ship sold
   units. Both sides drop them, so a real loss is still caught. */
check("Medousa still blocks when its available units really vanish",
  blocked(166, 40), true);
check("…and one-sided counting would have hidden it", blocked(166, 328), false);

/* Aristo ships almost no sold units, so the change is nearly a no-op there —
   187 held, 186 countable. It must behave exactly as before. */
check("Aristo is unaffected by the change", blocked(186, 186), false);
check("…and still blocks on a real loss", blocked(186, 100), true);

/* ---- the absolute floor, against every developer's real new denominator ----
   The smaller denominator is the cost of this change. A total feed failure
   (after = 0) must still trip `missing > 20` for every developer the guard
   covers. Figures measured from production 2026-09-24. */
const COUNTABLE_TODAY = {
  bbf: 573, leptos: 311, aristo: 186, medousa: 166,
  domenica: 117, inex: 77, squareone: 55, "island-blue": 30, pafilia: 25,
};
for (const [dev, before] of Object.entries(COUNTABLE_TODAY)) {
  check(`a dead feed still blocks ${dev} (${before} countable)`, blocked(before, 0), true);
}
/* Where that stops being true, stated out loud rather than discovered later:
   at 20 or fewer countable units the floor can no longer be exceeded. Pafilia
   at 25 is the closest any developer sits to it. */
check("at exactly 20 countable units a dead feed no longer blocks", blocked(20, 0), false);
check("at 21 it does", blocked(21, 0), true);

/* ---- threshold arithmetic ---- */
/* Both conditions must hold, so the floor is only testable where the
   percentage is already satisfied — at 100 held, losing 20 is 20 % AND
   exactly the floor, which must NOT block; 21 must. Testing it against a
   1000-unit base would pass on the percentage instead and prove nothing. */
check("the floor is strict, not inclusive", blocked(100, 80), false);
check("…one more unit trips it", blocked(100, 79), true);
check("a big absolute loss under 15 % is still no block", blocked(1000, 979), false);
check("15 % exactly does not block", blocked(200, 170), false);
check("just over 15 % does", blocked(200, 169), true);
check("holding nothing is never a block", blocked(0, 0), false);
check("…even against an empty feed", blocked(0, 500), false);
check("a feed that grew is never a block", blocked(100, 400), false);
check("the percentage label is rounded for the message",
  F.completenessVerdict(174, 103, ABS).pctLabel, 41);

/* Mito keeps its own floor of 3 — its catalogue is too small for 20 to ever
   bind, and its units are on the hard-delete path. */
check("Mito's floor still catches a small real loss", blocked(16, 12, MITO_ABS), true);
check("…and tolerates an ordinary night's sales", blocked(16, 13, MITO_ABS), false);

/* ---- the call sites have to keep asking for the right thing ---- */
const src = await import("node:fs").then((fs) => fs.readFileSync(join(ROOT, "src/lib/feedSync.ts"), "utf8"));
check("checkFeedCompleteness excludes sold on published",
  /feedUnitsAtRisk\(dev, \{ excludeSoldOnPublished: true \}\)/.test(src), true);
check("Mito explicitly does NOT",
  /feedUnitsAtRisk\(dev, \{ excludeSoldOnPublished: false \}\)/.test(src), true);
check("the db side excludes sold ONLY on published developments",
  /NOT:\s*\{\s*AND:\s*\[\s*\{\s*status:\s*"sold"\s*\}\s*,\s*\{\s*development:\s*\{\s*publishStatus:\s*"published"/.test(src), true);
check("the after side goes through countableFeedUnits",
  /afterCount \+= vm \? countableFeedUnits\(vm\.units, publishedByFeedId\.get\(id\) === true\)/.test(src), true);
check("a project we do not hold yet counts as unpublished",
  /publishedByFeedId\.get\(id\) === true/.test(src), true);
check("the unit-diff hard rule this all rests on is still there",
  /if \(old\.status === "sold" \|\| old\.status === "unlisted"\) continue;/.test(src), true);

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
