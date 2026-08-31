#!/usr/bin/env node
/* Self-test for the SEO advisor's fingerprint and suppression rules.

   Both were dead before 2026-08-31, and nothing said so. The fingerprint
   hashed the model's freshly-written title, so across 40 suggestions in 10
   real runs not one fingerprint ever recurred and "dismissed twice in 90
   days" could never reach two — while the cron logged "0 suppressed" every
   week, which read as "nothing repeated" rather than "this cannot fire".

   The cases below pin the behaviour that replaced them. Synthetic: no
   network, no database.

     node scripts/qa/advisor-suppression-check.mjs

   Exits non-zero on any failed assertion. */
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync } from "node:fs";

let build;
try { ({ build } = await import("esbuild")); }
catch { console.error("esbuild is not installed (transitive dep only)."); process.exit(2); }

// Bundles must sit inside the repo: "external" leaves the Anthropic import in
// place, and only here does node_modules resolve.
const scratch = join(process.cwd(), "node_modules", ".advisor-check");
mkdirSync(scratch, { recursive: true });
const stub = join(scratch, `prisma-stub-${process.pid}.ts`);
writeFileSync(stub, "export const prisma = { advisorRun: { findMany: async () => (globalThis.__RUNS__ ?? []) } };\n");
const made = [stub];
process.on("exit", () => { for (const f of made) rmSync(f, { force: true }); });

// One bundle per entry point. esbuild prepends the banner to EVERY output, so
// concatenating two of them declares createRequire twice and the import dies.
async function load(entry, tag) {
  const out = await build({
    entryPoints: [entry], bundle: true, platform: "node", format: "esm", write: false,
    alias: { "@/lib/prisma": stub },
    external: ["@anthropic-ai/sdk"],
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  });
  const path = join(scratch, `advisor-${tag}-${process.pid}.mjs`);
  writeFileSync(path, out.outputFiles[0].text);
  made.push(path);
  return import(path);
}
const F = await load("src/lib/seoAdvisor/suppression.ts", "supp");
const A = await load("src/lib/seoAdvisor/analyze.ts", "analyze");

let failures = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}\n       expected ${e}\n       actual   ${a}`);
}

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 7, 31, 12, 0, 0);
const ago = (d) => new Date(NOW - d * DAY);
const iso = (d) => ago(d).toISOString();
const sug = (o) => ({ id: "x", fingerprint: "fp", title: "t", rationale: "r", action: "a",
  impact_estimate: "med", effort: "small", category: "CTR", status: "open", ...o });
const setRuns = (runs) => { globalThis.__RUNS__ = runs; };
const fp = (cat, title, targets) => A.fingerprintOf(cat, title, targets);

console.log("\nnormalizeTarget — harmless variation must not change the key");
check("origin stripped",         A.normalizeTarget("https://cyprusvipestates.com/de/blog/x"), "/de/blog/x");
check("trailing slash stripped", A.normalizeTarget("/de/blog/x/"), "/de/blog/x");
check("query stripped",          A.normalizeTarget("/de/blog/x?utm=1"), "/de/blog/x");
check("hash stripped",           A.normalizeTarget("/de/blog/x#top"), "/de/blog/x");
check("case flattened",          A.normalizeTarget("/DE/Blog/X"), "/de/blog/x");
check("leading slash added",     A.normalizeTarget("de/blog/x"), "/de/blog/x");
check("blank stays blank",       A.normalizeTarget("   "), "");

console.log("\nfingerprint — same pages, same key, whatever the model writes");
check("rewording does not re-key",
  fp("CTR", "Rewrite the title on the pet page", ["/de/blog/haustier"]) ===
  fp("CTR", "Link the orphaned pet guide instead", ["/de/blog/haustier"]), true);
check("target order does not matter",
  fp("CTR", "t", ["/a", "/b"]) === fp("CTR", "t", ["/b", "/a"]), true);
check("url form does not matter",
  fp("CTR", "t", ["https://x.com/a/"]) === fp("CTR", "t", ["/a"]), true);
check("a different page is a different key",
  fp("CTR", "t", ["/a"]) === fp("CTR", "t", ["/b"]), false);
check("a different category is a different key",
  fp("CTR", "t", ["/a"]) === fp("Internal Linking", "t", ["/a"]), false);
// Deliberate: with no page named there is nothing stable to key on, so it
// stays title-based rather than collapsing a whole category onto one key.
check("no targets falls back to the title",
  fp("CTR", "one", []) === fp("CTR", "two", []), false);
check("no targets, same title, same key",
  fp("CTR", "one", []) === fp("CTR", "  ONE  ", []), true);
check("blank targets are ignored",
  fp("CTR", "t", ["", "  "]) === fp("CTR", "t", []), true);

console.log("\nsuppression — one dismissal is enough, for 90 days");
setRuns([{ runDate: ago(7), suggestions: [sug({ status: "dismissed", dismissedAt: iso(7) })] }]);
check("dismissed 7 days ago",   (await F.getSuppressedFingerprints(NOW)).get("fp"), "dismissed");
setRuns([{ runDate: ago(89), suggestions: [sug({ status: "dismissed", dismissedAt: iso(89) })] }]);
check("dismissed 89 days ago",  (await F.getSuppressedFingerprints(NOW)).get("fp"), "dismissed");
setRuns([{ runDate: ago(91), suggestions: [sug({ status: "dismissed", dismissedAt: iso(91) })] }]);
check("dismissed 91 days ago is free again", (await F.getSuppressedFingerprints(NOW)).get("fp"), undefined);

console.log("\nsuppression — an approved suggestion pauses, then returns");
setRuns([{ runDate: ago(7), suggestions: [sug({ status: "approved", approvedAt: iso(7) })] }]);
check("approved 7 days ago is paused",  (await F.getSuppressedFingerprints(NOW)).get("fp"), "recently-approved");
setRuns([{ runDate: ago(41), suggestions: [sug({ status: "approved", approvedAt: iso(41) })] }]);
check("approved 41 days ago still paused", (await F.getSuppressedFingerprints(NOW)).get("fp"), "recently-approved");
setRuns([{ runDate: ago(43), suggestions: [sug({ status: "approved", approvedAt: iso(43) })] }]);
check("approved 43 days ago comes back", (await F.getSuppressedFingerprints(NOW)).get("fp"), undefined);

console.log("\nsuppression — edges");
setRuns([{ runDate: ago(7), suggestions: [sug({ status: "open" })] }]);
check("an open suggestion suppresses nothing", (await F.getSuppressedFingerprints(NOW)).get("fp"), undefined);
setRuns([
  { runDate: ago(10), suggestions: [sug({ status: "approved", approvedAt: iso(10) })] },
  { runDate: ago(3), suggestions: [sug({ status: "dismissed", dismissedAt: iso(3) })] },
]);
check("a dismissal outranks a pause", (await F.getSuppressedFingerprints(NOW)).get("fp"), "dismissed");
// Same pair, runs the other way round. Without this the assertion above
// passes for the wrong reason: the dismissal simply happens to be written
// last and overwrites. Found by mutating the approved branch to set
// unconditionally — which survived until this case existed.
setRuns([
  { runDate: ago(3), suggestions: [sug({ status: "dismissed", dismissedAt: iso(3) })] },
  { runDate: ago(10), suggestions: [sug({ status: "approved", approvedAt: iso(10) })] },
]);
check("dismissal still wins when seen first", (await F.getSuppressedFingerprints(NOW)).get("fp"), "dismissed");
setRuns([{ runDate: ago(5), suggestions: [sug({ status: "approved" })] }]);
check("missing timestamp falls back to the run date", (await F.getSuppressedFingerprints(NOW)).get("fp"), "recently-approved");
setRuns([{ runDate: ago(5), suggestions: [sug({ fingerprint: undefined, status: "dismissed" })] }]);
check("no fingerprint is skipped", (await F.getSuppressedFingerprints(NOW)).size, 0);

console.log("\nfilterSuppressed — reports what it dropped, and why");
setRuns([{ runDate: ago(3), suggestions: [sug({ status: "dismissed", dismissedAt: iso(3) })] }]);
{
  const r = await F.filterSuppressed([
    { fingerprint: "fp", title: "repeat" },
    { fingerprint: "other", title: "fresh" },
  ]);
  check("keeps the unseen one", r.kept.map((s) => s.title), ["fresh"]);
  check("names the dropped one", r.dropped, [{ title: "repeat", reason: "dismissed" }]);
}

console.log(`\n${failures ? `${failures} failed` : "all checks passed"}`);
process.exit(failures ? 1 : 0);
