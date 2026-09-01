#!/usr/bin/env node
/* Shows, per developer, exactly what the feed-completeness guard will decide
   tonight — and why.

   Written after Medousa sat blocked from 2026-08-27 to 2026-08-31 with nobody
   able to see the arithmetic. The guard reported "105 of 436 units are missing
   (24 %)", which was true and misleading: 105 of them belonged to an ARCHIVED
   project that is legitimately absent from the feed forever, so the run could
   never succeed again. The count now excludes archived developments
   (feedUnitsAtRisk in feedSync.ts); this script makes the same numbers
   inspectable before they block a run.

     node --env-file=.env.local scripts/qa/feed-guard-check.mjs

   Read-only. Exits 1 if any developer would be blocked. */
import { build } from "esbuild";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const FEED_INCOMPLETE_PCT = 0.15;
const FEED_INCOMPLETE_ABS_FLOOR = 20;

const scratch = join(process.cwd(), "node_modules", ".feed-guard-check");
mkdirSync(scratch, { recursive: true });
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
const out = await build({
  entryPoints: ["src/app/preview-project/feeds.ts"],
  bundle: true, platform: "node", format: "esm", write: false,
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
const f = join(scratch, "feeds.mjs");
writeFileSync(f, out.outputFiles[0].text);
const F = await import(f);

const prisma = new PrismaClient();
const DEVS = ["island-blue", "inex", "bbf", "aristo", "pafilia", "domenica", "medousa", "squareone", "leptos"];
let blockedAny = false;

for (const dev of DEVS) {
  let ids = [];
  try { ids = await F.listProjectIds(dev); } catch (e) { console.log(`  ${dev.padEnd(13)} listProjectIds failed: ${String(e.message).slice(0, 60)}`); continue; }
  if (!ids.length) { console.log(`  ${dev.padEnd(13)} feed returned no ids — skipped (needs an API key?)`); continue; }

  let after = 0;
  for (const id of ids) {
    try { const vm = await F.getPreviewProject(dev, id); after += vm?.units.length ?? 0; } catch { /* counted as 0, same as the guard */ }
  }
  const atRisk = await prisma.developmentUnit.count({ where: { source: "feed", development: { dev, publishStatus: { not: "archived" } } } });
  const all = await prisma.developmentUnit.count({ where: { source: "feed", development: { dev } } });
  const archived = all - atRisk;

  const missing = atRisk - after;
  const pct = atRisk > 0 ? missing / atRisk : 0;
  const blocked = atRisk > 0 && missing > FEED_INCOMPLETE_ABS_FLOOR && pct > FEED_INCOMPLETE_PCT;
  if (blocked) blockedAny = true;

  // What the OLD rule would have said, so a regression is obvious at a glance.
  const oldMissing = all - after;
  const oldBlocked = all > 0 && oldMissing > FEED_INCOMPLETE_ABS_FLOOR && oldMissing / all > FEED_INCOMPLETE_PCT;

  console.log(
    `  ${dev.padEnd(13)} feed ${String(after).padStart(4)} | at risk ${String(atRisk).padStart(4)}` +
    ` | archived ${String(archived).padStart(3)} | missing ${String(missing).padStart(4)} (${String(Math.round(pct * 100)).padStart(3)} %)` +
    `  ${blocked ? "BLOCKED" : "ok"}${!blocked && oldBlocked ? "   <- old rule would have blocked on archived units" : ""}`,
  );
}
await prisma.$disconnect();
console.log(`\n  ${blockedAny ? "at least one developer would be blocked" : "no developer would be blocked"}`);
process.exit(blockedAny ? 1 : 0);
