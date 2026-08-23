// READ-ONLY. Checks the Page Power output against the invariants in
// docs/superpowers/specs/2026-08-23-seo-page-power-design.md.
//
// THIS SCRIPT NEEDS A ROUTE THAT IS NOT IN THE REPO, ON PURPOSE. TypeScript
// modules cannot be imported from a plain .mjs script, so the only way to
// exercise the real modules rather than a re-implementation of them is through
// the running app — and a permanently mounted route that dumps every page's
// search performance is not something to leave on a production build for the
// sake of a diagnostic. Task 5 of the plan therefore creates it, uses it and
// deletes it.
//
// What used to happen when someone ran this afterwards was a JSON parse error
// on Next's 404 page and no hint at all. Now the route's full source is below
// and every failure path prints it. Re-create it, run this, delete it again.
const PROBE_PATH = "src/app/api/page-power-probe/route.ts";
const PROBE_SOURCE = `// TEMPORARY — created and deleted around a run of scripts/verify-page-power.mjs.
import { getPageVerdicts } from "@/lib/seo/pagePower/pageVerdicts";
import { getClassVerdicts } from "@/lib/seo/pagePower/classVerdicts";
import { getInventory } from "@/lib/seo/pagePower/inventory";

export const dynamic = "force-dynamic";

export async function GET() {
  const [pages, classes, inventory] = await Promise.all([
    getPageVerdicts(), getClassVerdicts(), getInventory(),
  ]);
  return Response.json({ ...pages, classes, inventory: inventory.map((p) => p.path) });
}
`;

const BASE = process.env.PROBE_BASE ?? "http://localhost:3011";

// Recorded from production on 2026-08-23, with the tunnel on localhost:5433 and
// NEW_PROJECTS_INDEXABLE=true. Diagnosis counts move every day — they are
// printed against this, never asserted against it. The PAGE COUNT is asserted,
// loosely, because the one way it moves by tens of percent is a misconfigured
// run rather than a changed site: with NEW_PROJECTS_INDEXABLE unset the
// inventory silently drops all 588 Development pages and every count below is
// wrong in a way that reads like a finding. That is not hypothetical; it is how
// this baseline was first mis-measured.
const BASELINE = {
  measured: "2026-08-23",
  pages: 1691,
  coveragePct: 99.1,
  publishedInsideWindow: 690,
  sitemapUrls: 1691,
  diagnoses: { buried: 79, healthy: 39, invisible: 1125, unclicked: 12, unjudged: 436 },
};
const PAGE_COUNT_DRIFT = 0.25;

const SITEMAP_TYPES = ["projects", "blog", "pages", "developers", "case-studies", "developments"];
const SITE_ORIGIN = "https://cyprusvipestates.com";

function bail(what, detail) {
  console.error(`\nCANNOT VERIFY: ${what}`);
  console.error(`  ${detail}\n`);
  console.error(`The probe route this script reads is deliberately not committed. To run this:`);
  console.error(`\n  1. Create ${PROBE_PATH} containing exactly:\n`);
  console.error(PROBE_SOURCE.split("\n").map((l) => `     ${l}`).join("\n"));
  console.error(`  2. Open the production tunnel on localhost:5433 and start the app with the`);
  console.error(`     repo-root .env.local in place and NEW_PROJECTS_INDEXABLE=true:\n`);
  console.error(`       NEW_PROJECTS_INDEXABLE=true npx next dev -p 3011\n`);
  console.error(`  3. node scripts/verify-page-power.mjs        (PROBE_BASE overrides ${BASE})`);
  console.error(`  4. rm -rf ${PROBE_PATH.replace(/\/route\.ts$/, "")}\n`);
  process.exit(2);
}

async function getJson(path) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(180000) });
  } catch (err) {
    bail(`${BASE}${path} is not answering`, `${err.name}: ${err.message} — is the dev server up on ${BASE}?`);
  }
  // 500 rather than 404 is the EXPECTED shape of "the route is not there": an
  // unmatched `/api/...` path falls through to the `[lang]/[...slug]` catch-all,
  // which asks Prisma for a Singlepage in the locale "api" and throws. So both
  // statuses point at the same missing file, and neither is worth telling apart.
  if (!res.ok) bail(`${BASE}${path} returned HTTP ${res.status}`, "almost certainly the probe route is not mounted — it is not committed, see below");
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    bail(`${BASE}${path} did not return JSON`, `first 120 characters: ${JSON.stringify(text.slice(0, 120))}`);
  }
}

const r = await getJson("/api/page-power-probe");
if (!Array.isArray(r.verdicts)) bail("the probe returned JSON without a `verdicts` array", `keys: ${Object.keys(r).join(", ")}`);
if (!Array.isArray(r.inventory)) bail("the probe returned no `inventory` array", "re-create the route from the source above — it gained an `inventory` field on 2026-08-23");

// "What we tell Google exists" against "what Page Power judges". This is the
// check that exists because the fixed-page list was caught short three times
// (see FIXED_PAGES in src/lib/seo/pagePower/inventory.ts): coverage cannot catch
// an omission, because coverage is a share of CLICKS and the pages that go
// missing are the ones with none. Every `<loc>` the sitemap emits must be an
// inventory path, and nothing may be in the inventory that the sitemap does not
// advertise — the second direction catches a page being judged that the site is
// not asking to have indexed.
const sitemapPaths = new Set();
for (const type of SITEMAP_TYPES) {
  let res;
  try {
    res = await fetch(`${BASE}/sitemaps/${type}.xml`, { signal: AbortSignal.timeout(180000) });
  } catch (err) {
    bail(`${BASE}/sitemaps/${type}.xml is not answering`, `${err.name}: ${err.message}`);
  }
  if (!res.ok) bail(`${BASE}/sitemaps/${type}.xml returned HTTP ${res.status}`, "the sitemap route is part of the app, not of the probe");
  const xml = await res.text();
  for (const m of xml.matchAll(/<loc>([^<]*)<\/loc>/g)) {
    if (!m[1].startsWith(SITE_ORIGIN)) continue;
    sitemapPaths.add(m[1].slice(SITE_ORIGIN.length) || "/");
  }
}

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const counts = {};
for (const v of r.verdicts) counts[v.diagnosis] = (counts[v.diagnosis] ?? 0) + 1;
console.log(`pages: ${r.verdicts.length}`);
for (const [k, n] of Object.entries(counts).sort()) console.log(`  ${k.padEnd(10)} ${n}`);
console.log(`coverage: ${r.coveragePct.toFixed(1)}%`);
console.log(`window: ${r.windowStart.slice(0, 10)} .. ${r.windowEnd.slice(0, 10)}`);
console.log(`published inside the window: ${r.publishedInsideWindow?.length ?? "(field missing)"}`);
console.log(`sitemap URLs: ${sitemapPaths.size}`);
console.log("\nclasses:");
for (const c of r.classes) console.log(`  ${c.templateClass.padEnd(20)} ${c.diagnosis.padEnd(9)} entering=${c.enteringSessions} onward=${c.onwardComparisonSessions} tracedLeads=${c.attributableLeads}`);

// Printed, not asserted: these move with the site. A run that looks nothing like
// this one is worth a second look before its numbers are quoted anywhere.
const drift = (now, then) => (now === then ? " (unchanged)" : ` (${now > then ? "+" : ""}${(now - then).toLocaleString("en-GB")} vs ${BASELINE.measured})`);
console.log(`\nagainst the ${BASELINE.measured} baseline:`);
console.log(`  pages      ${r.verdicts.length}${drift(r.verdicts.length, BASELINE.pages)}`);
console.log(`  coverage   ${r.coveragePct.toFixed(1)}% (was ${BASELINE.coveragePct}%)`);
console.log(`  sitemap    ${sitemapPaths.size}${drift(sitemapPaths.size, BASELINE.sitemapUrls)}`);
console.log(`  too young  ${r.publishedInsideWindow?.length ?? 0}${drift(r.publishedInsideWindow?.length ?? 0, BASELINE.publishedInsideWindow)}`);
for (const [k, then] of Object.entries(BASELINE.diagnoses)) console.log(`  ${k.padEnd(10)} ${counts[k] ?? 0}${drift(counts[k] ?? 0, then)}`);

const VALID = ["invisible", "buried", "unclicked", "healthy", "unjudged"];
check(r.verdicts.every((v) => VALID.includes(v.diagnosis)), "a page carries a diagnosis outside the allowed set");
check(r.verdicts.every((v) => v.key === `${v.locale}::${v.path}`), "a page key does not match its locale and path");
check(new Set(r.verdicts.map((v) => v.key)).size === r.verdicts.length, "duplicate page keys — the inventory is not deduplicated");
check(r.coveragePct >= 85, `coverage ${r.coveragePct.toFixed(1)}% is below the 85% floor — new redirects the canonical map does not know`);
check(r.verdicts.filter((v) => v.diagnosis === "buried").every((v) => v.position > 20), "a buried page has a position of 20 or better");
check(r.verdicts.filter((v) => v.diagnosis === "unclicked").every((v) => v.impressions >= 300), "an unclicked page is below the 300-impression floor");
check(r.verdicts.filter((v) => v.diagnosis === "invisible").every((v) => v.impressions < 10), "an invisible page has 10 or more impressions");
check(r.verdicts.every((v) => v.reason && v.reason.length > 0), "a verdict has no reason text");

const inventoryPaths = new Set(r.inventory);
const missingFromInventory = Array.from(sitemapPaths).filter((p) => !inventoryPaths.has(p));
const missingFromSitemap = Array.from(inventoryPaths).filter((p) => !sitemapPaths.has(p));
check(missingFromInventory.length === 0, `${missingFromInventory.length} URL(s) the sitemap advertises are not in the inventory, so no verdict can ever be emitted for them — add them to FIXED_PAGES or to the query that should have produced them: ${missingFromInventory.slice(0, 12).join(", ")}`);
check(missingFromSitemap.length === 0, `${missingFromSitemap.length} inventory page(s) the sitemap does not advertise, so Page Power is judging pages the site is not asking Google to index: ${missingFromSitemap.slice(0, 12).join(", ")}`);

const young = new Set(r.publishedInsideWindow ?? []);
const verdictKeys = new Set(r.verdicts.map((v) => v.key));
check(Array.isArray(r.publishedInsideWindow), "the probe returned no `publishedInsideWindow` array — the publication-age guard is not reporting");
check(young.size === (r.publishedInsideWindow ?? []).length, "duplicate keys in publishedInsideWindow");
check(Array.from(young).every((k) => verdictKeys.has(k)), "publishedInsideWindow names a key that is not a verdict");
// The guard must never CHANGE a diagnosis, only the sentence under it and the
// Action Center's count — see PageVerdictResult.publishedInsideWindow.
check(
  r.verdicts.filter((v) => v.diagnosis === "invisible" && young.has(v.key)).every((v) => v.reason.startsWith("Published ")),
  "an invisible page published inside the window does not carry the publication-age reason",
);
check(
  r.verdicts.filter((v) => v.diagnosis === "invisible" && !young.has(v.key)).every((v) => !v.reason.startsWith("Published ")),
  "a page carries the publication-age reason without being in publishedInsideWindow",
);

check(
  Math.abs(r.verdicts.length - BASELINE.pages) <= BASELINE.pages * PAGE_COUNT_DRIFT,
  `the inventory is ${r.verdicts.length} pages against ${BASELINE.pages} on ${BASELINE.measured}, more than ${PAGE_COUNT_DRIFT * 100}% apart. The usual cause is NEW_PROJECTS_INDEXABLE being unset, which drops every Development page from the inventory and makes every count above wrong`,
);

console.log(failures.length ? `\n${failures.length} FAILURE(S):` : "\nall invariants hold");
for (const f of failures) console.log(`  - ${f}`);
process.exit(failures.length ? 1 : 0);
