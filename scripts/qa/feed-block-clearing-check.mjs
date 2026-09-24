#!/usr/bin/env node
/* Guard for the feed-completeness alarm's LIFECYCLE — pendingFeedBlocks in
   src/lib/actionCenter/rules/developers.ts, and the cron row that lets it
   clear (src/app/api/cron/feed-sync/route.ts).

   The rule always claimed a later clean run supersedes a block. Nothing ever
   wrote that clean run: a blocked developer logged feed-incomplete:<dev>
   ok=false, a healthy one logged feed-sync:<dev> — a DIFFERENT key — so the
   rule's `row.ok` was never once true.

   Measured against production 2026-09-24:

     feed-incomplete: rows with ok=true      0 of 14
     domenica   blocked 2026-08-31, clean every night since, shown 24.6 days
     medousa    blocked 2026-09-01, clean every night since, shown 23.6 days

   Two of the three URGENT items in the panel meant nothing, and the third
   (island-blue) would have joined them the moment its feed recovered. An
   alarm that cannot switch itself off is worse than no alarm, because the
   real one is indistinguishable from the three that have been lit for weeks.

     node scripts/qa/feed-block-clearing-check.mjs

   Exits non-zero on the first failed assertion. */
import { writeFileSync, rmSync, readFileSync } from "node:fs";
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
const bundlePath = join(ROOT, `.qa-feed-block-${process.pid}.mjs`);
process.on("exit", () => rmSync(bundlePath, { force: true }));
const out = await build({
  entryPoints: [join(ROOT, "src/lib/actionCenter/rules/developers.ts")],
  bundle: true, platform: "node", format: "esm", write: false,
  external: ["@prisma/client", "@anthropic-ai/sdk", "sharp", "nodemailer", "imapflow"],
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
});
writeFileSync(bundlePath, out.outputFiles[0].text);
const D = await import(bundlePath);

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
}

/* Rows arrive newest-first, exactly as the Prisma query orders them. */
const at = (iso) => new Date(iso);
const row = (dev, ok, iso, message = null) => ({ job: `feed-incomplete:${dev}`, ok, ranAt: at(iso), message });
const devs = (rows) => D.pendingFeedBlocks(rows).map((b) => b.devKey).sort();

/* Island Blue's live case: blocked, nothing since. */
check("a block with nothing after it is reported",
  devs([row("island-blue", false, "2026-09-24T04:04:16Z", "78 of 174 units are missing")]), ["island-blue"]);

/* Domenica and Medousa's case — the whole bug. Before the fix no clean row
   existed at all, so this list could never shrink. */
check("a block followed by a clean run is NOT reported",
  devs([
    row("domenica", true, "2026-09-24T04:04:16Z", "feed complete — 16 project(s) checked"),
    row("domenica", false, "2026-08-31T04:05:47Z", "22 of 131 units are missing"),
  ]), []);

/* …and it must come back if the feed breaks again. */
check("a block after a clean run is reported again",
  devs([
    row("medousa", false, "2026-09-24T04:05:00Z", "105 of 436 units are missing"),
    row("medousa", true, "2026-09-23T04:05:00Z"),
    row("medousa", false, "2026-09-01T04:05:57Z"),
  ]), ["medousa"]);

check("a developer that has never blocked is not reported",
  devs([row("bbf", true, "2026-09-24T04:04:16Z"), row("bbf", true, "2026-09-23T04:04:16Z")]), []);

/* The real panel state on the day this was written: three keys, and after the
   next clean night only the genuinely broken one may remain. */
const THAT_DAY = [
  row("island-blue", false, "2026-09-24T04:04:16Z"),
  row("domenica", false, "2026-08-31T04:05:47Z"),
  row("medousa", false, "2026-09-01T04:05:57Z"),
];
check("all three showed that day", devs(THAT_DAY), ["domenica", "island-blue", "medousa"]);
check("…and one clean night each clears the two that had recovered",
  devs([
    row("domenica", true, "2026-09-25T04:04:16Z"),
    row("medousa", true, "2026-09-25T04:04:16Z"),
    ...THAT_DAY,
  ]), ["island-blue"]);

/* Housekeeping that would otherwise bite quietly. */
check("an empty log reports nothing", D.pendingFeedBlocks([]), []);
check("the developer key is stripped of the job prefix",
  D.pendingFeedBlocks([row("island-blue", false, "2026-09-24T04:04:16Z")])[0].devKey, "island-blue");
check("the blocking message is carried through, not the clean one",
  D.pendingFeedBlocks([
    row("island-blue", false, "2026-09-24T04:04:16Z", "78 of 174 units are missing"),
  ])[0].message, "78 of 174 units are missing");
check("…and so is the time it was first seen",
  D.pendingFeedBlocks([row("x", false, "2026-09-24T04:04:16Z")])[0].since.toISOString(), "2026-09-24T04:04:16.000Z");

/* Order is the contract: the caller passes newest-first and the first sighting
   of a job wins. Fed the other way round, a stale block would outrank the
   clean run that resolved it — which is precisely the bug, re-created. */
check("the newest row for a developer decides",
  devs([
    row("domenica", true, "2026-09-24T04:04:16Z"),
    row("domenica", false, "2026-08-31T04:05:47Z"),
  ]), []);

/* ── the cron row that makes any of this possible ──────────────────────── */
const route = readFileSync(join(ROOT, "src/app/api/cron/feed-sync/route.ts"), "utf8");
check("a blocked developer still logs the refusal",
  /logCronRun\(`feed-incomplete:\$\{r\.dev\}`, false, r\.blockedMessage\)/.test(route), true);
check("a developer that was NOT blocked now logs the all-clear",
  /logCronRun\(`feed-incomplete:\$\{r\.dev\}`, true, /.test(route), true);
check("…on the same key the rule reads, or it would clear nothing",
  (route.match(/`feed-incomplete:\$\{r\.dev\}`/g) || []).length, 2);
check("…and before the loop moves on to the feed-sync row",
  route.indexOf("feed-incomplete:${r.dev}`, true") < route.indexOf("feed-sync:${r.dev}"), true);

/* The panel's item id must not change shape, or snoozes and dismissals stored
   against the old one would silently stop matching. */
const rules = readFileSync(join(ROOT, "src/lib/actionCenter/rules/developers.ts"), "utf8");
check("the item id keeps its historical doubled prefix",
  /id: `feed-incomplete:feed-incomplete:\$\{b\.devKey\}`/.test(rules), true);
check("the rule reads its answer from pendingFeedBlocks",
  /return pendingFeedBlocks\(rows\)\.map\(/.test(rules), true);

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
