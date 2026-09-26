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

/* ── Plus Properties writes the same verdict per project, under its own
   prefix: plus-incomplete:<project key>. The key is everything after the
   FIRST ":" of the job ("67-68-69" has dashes, never a colon). */
const plus = (key, ok, iso, message = null) => ({ job: `plus-incomplete:${key}`, ok, ranAt: at(iso), message });
check("a blocked Plus project is reported, by its project key",
  D.pendingFeedBlocks([plus("67-68-69", false, "2026-09-26T02:31:00Z", "4 of 6 units are missing")]).map((b) => [b.devKey, b.job]),
  [["67-68-69", "plus-incomplete:67-68-69"]]);
/* "feed-incomplete:" and "plus-incomplete:" happen to be the same length, so
   pin the rule itself: the key starts after the first ":", whatever the prefix. */
check("the key is everything after the job's first ':'",
  D.pendingFeedBlocks([{ job: "any-prefix:a:b", ok: false, ranAt: at("2026-09-26T02:31:00Z"), message: null }])[0].devKey, "a:b");
check("…and a later clean run clears it",
  devs([plus("57", true, "2026-09-27T02:31:00Z"), plus("57", false, "2026-09-26T02:31:00Z")]), []);
check("a Plus key never collides with a feed developer of the same name",
  D.pendingFeedBlocks([plus("x", false, "2026-09-26T02:31:00Z"), row("x", true, "2026-09-26T04:00:00Z")]).map((b) => b.job), ["plus-incomplete:x"]);

/* The rule queries each prefix on its own (newest first, take 500 each) and
   concatenates the two lists. The two prefixes never share a job, so the
   order ACROSS the lists cannot change which row is a job's latest. */
const feedRows = [row("island-blue", false, "2026-09-24T04:04:16Z"), row("domenica", true, "2026-09-25T04:04:16Z"), row("domenica", false, "2026-08-31T04:05:47Z")];
const plusRows = [plus("57", false, "2026-09-26T02:31:00Z"), plus("33", true, "2026-09-26T02:31:00Z"), plus("33", false, "2026-09-25T02:31:00Z")];
const jobsOf = (rows) => D.pendingFeedBlocks(rows).map((b) => b.job).sort();
check("two newest-first lists, concatenated either way round, give the same blocks",
  [jobsOf(feedRows.concat(plusRows)), jobsOf(plusRows.concat(feedRows))],
  [["feed-incomplete:island-blue", "plus-incomplete:57"], ["feed-incomplete:island-blue", "plus-incomplete:57"]]);

/* The panel item. The feed one must stay byte-identical (snoozes and
   dismissals are stored against its id); the Plus one names the project. */
const feedItem = D.feedBlockItem(D.pendingFeedBlocks([row("island-blue", false, "2026-09-24T04:04:16Z", "78 of 174 units are missing")])[0]);
check("feed item: id, title and link unchanged",
  [feedItem.id, feedItem.title, feedItem.deepLink, feedItem.description],
  ["feed-incomplete:feed-incomplete:island-blue", "island-blue feed looks incomplete — nothing was synced", "/admin/developments?dev=island-blue", "78 of 174 units are missing"]);
const plusItem = D.feedBlockItem(D.pendingFeedBlocks([plus("57", false, "2026-09-26T02:31:00Z", "4 of 6 units are missing")])[0]);
check("Plus item: its own id, title and link",
  [plusItem.id, plusItem.title, plusItem.deepLink, plusItem.severity, plusItem.description],
  ["feed-incomplete:plus-incomplete:57", "Plus Properties 57: price list looks incomplete — units were not updated", "/admin/developments?dev=plusproperties", "URGENT", "4 of 6 units are missing"]);

/* Follow-up B: a Plus project whose price list is missing altogether was
   skipped whole (MISSING_PRICE_LIST, src/lib/plusIncomplete.ts): nothing was
   written, not just its units, and the title says so. The message is read
   from the sync's own constant, never copied. */
const readOr = (p) => { try { return readFileSync(join(ROOT, p), "utf8"); } catch { return ""; } };
const incompleteSrc = readOr("src/lib/plusIncomplete.ts");
const MISSING = (/export const MISSING_PRICE_LIST = "([^"]+)";/.exec(incompleteSrc) || [])[1];
check("plusIncomplete.ts exports the missing-price-list message", typeof MISSING, "string");
const missingItem = D.feedBlockItem(D.pendingFeedBlocks([plus("57", false, "2026-09-26T02:31:00Z", MISSING)])[0]);
check("Plus item, price list missing: its own title, same id, link and severity",
  [missingItem.id, missingItem.title, missingItem.deepLink, missingItem.severity, missingItem.description],
  ["feed-incomplete:plus-incomplete:57", "Plus Properties 57: price list missing from the folder — nothing was changed", "/admin/developments?dev=plusproperties", "URGENT", MISSING]);
check("a feed row carrying the same text keeps the feed item, byte for byte",
  (({ id, title, deepLink, description }) => [id, title, deepLink, description])(D.feedBlockItem(D.pendingFeedBlocks([row("island-blue", false, "2026-09-24T04:04:16Z", MISSING)])[0])),
  ["feed-incomplete:feed-incomplete:island-blue", "island-blue feed looks incomplete — nothing was synced", "/admin/developments?dev=island-blue", MISSING]);

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
/* Each prefix has its own window. One shared take:500 would let ~35 Plus rows
   a night shrink the feed-incomplete history from ~55 nights to ~11. */
const fnStart = rules.indexOf("async function feedIncompleteWarnings()");
const fnSrc = fnStart < 0 ? "" : rules.slice(fnStart, rules.indexOf("\n}\n", fnStart));
const prefixQuery = (prefix) => new RegExp(`prisma\\.cronRunLog\\.findMany\\(\\{ where: \\{ job: \\{ startsWith: "${prefix}" \\} \\}, orderBy: \\{ ranAt: "desc" \\}, take: 500 \\}\\)`);
check("the rule queries feed-incomplete: on its own, newest first, take 500", prefixQuery("feed-incomplete:").test(fnSrc), true);
check("…and plus-incomplete: on its own, newest first, take 500", prefixQuery("plus-incomplete:").test(fnSrc), true);
check("…in exactly two queries, never one shared OR query",
  [(fnSrc.match(/prisma\.cronRunLog\.findMany\(/g) || []).length, /OR:/.test(fnSrc), (fnSrc.match(/take: 500/g) || []).length], [2, false, 2]);
check("the rule reads its answer from pendingFeedBlocks over both lists, and builds its items with feedBlockItem",
  /return pendingFeedBlocks\(feedRows\.concat\(plusRows\)\)\.map\(feedBlockItem\);/.test(fnSrc), true);
/* Follow-up B wiring: the rule compares against the sync's constant and never
   carries its own copy of the text. */
check("the rule imports MISSING_PRICE_LIST from the dependency-free plusIncomplete module",
  /import \{ MISSING_PRICE_LIST \} from "@\/lib\/plusIncomplete";/.test(rules), true);
/* The Action Center must not pull the sync (Drive, xml2js, node-html-parser)
   into the admin's server graph for one string; plusIncomplete.ts is
   constants only, so importing it can never pull anything in. */
check("the rule never imports plusPropertiesSync",
  /(from\s*|import\s*\(\s*|require\s*\(\s*)["'][^"']*plusPropertiesSync["']/.test(rules), false);
check("plusIncomplete.ts exists and has no import statements",
  [incompleteSrc.length > 0, /^\s*import\b|\bimport\s*\(|\brequire\s*\(|^\s*export\s[^;]*\bfrom\s*["']/m.test(incompleteSrc)], [true, false]);
check("…and exports only constants",
  incompleteSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").split(";").map((x) => x.trim()).filter(Boolean).every((x) => /^export const \w+ = /.test(x)), true);
const plusSyncSrc = readFileSync(join(ROOT, "src/lib/plusPropertiesSync.ts"), "utf8");
check("the sync takes the constant from plusIncomplete and re-exports it, holding no copy of its own",
  [/import \{ MISSING_PRICE_LIST \} from "\.\/plusIncomplete";/.test(plusSyncSrc), /export \{ MISSING_PRICE_LIST \};/.test(plusSyncSrc), MISSING ? plusSyncSrc.includes(MISSING) : "no constant"],
  [true, true, false]);
check("…compares the row's message with it",
  /b\.message === MISSING_PRICE_LIST/.test(rules), true);
check("…and holds no copy of the text", MISSING ? rules.includes(MISSING) : "no constant", false);
/* The other take:500 in this file (feedSyncFailures, feed-sync:/drive-sync:)
   is a different rule and stays as it is. */
check("feedSyncFailures keeps its own single query",
  /OR: \[\{ job: \{ startsWith: "feed-sync:" \} \}, \{ job: \{ startsWith: "drive-sync:" \} \}\],\s*\},\s*orderBy: \{ ranAt: "desc" \},\s*take: 500,/.test(rules), true);

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
