/* One-off data fix: eight legacyProjectRedirect rows point at /developers/aristo,
   which 404s — the developer's real slug is aristo-developers. Two legacy
   projects (Petridia E, Rosemarine Residences) × four locales redirect into that
   404 today, and six pinned cards across the site link at them.

   Verified in production 2026-09-03:
     /projects/petridia-e-aristo            308 -> /developers/aristo -> 404
     /developers/aristo-developers          200

   Only rewrites rows whose targetPath is exactly /developers/aristo (optionally
   locale-prefixed); rows already pointing at aristo-developers are left alone,
   so re-running is a no-op. Aborts if the count isn't the expected 8. */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const prisma = new PrismaClient();
const EXACT = /^(?:\/(?:de|pl|ru))?\/developers\/aristo$/;

const all = await prisma.legacyProjectRedirect.findMany({
  where: { targetPath: { contains: "/developers/aristo" } },
  select: { id: true, projectId: true, targetPath: true },
});
const toFix = all.filter((r) => EXACT.test(r.targetPath));

console.log(`rows matching /developers/aristo: ${all.length} | to fix: ${toFix.length}`);
for (const r of toFix) console.log(`   ${r.targetPath}  ->  ${r.targetPath}-developers`);

if (toFix.length !== 8) {
  console.log("ABORT: expected exactly 8 rows, refusing to write.");
  await prisma.$disconnect();
  process.exit(1);
}

let written = 0;
for (const r of toFix) {
  await prisma.legacyProjectRedirect.update({
    where: { id: r.id },
    data: { targetPath: `${r.targetPath}-developers` },
  });
  written++;
}
console.log(`\nwritten: ${written} rows`);

const after = await prisma.legacyProjectRedirect.findMany({
  where: { targetPath: { contains: "/developers/aristo" } },
  select: { targetPath: true },
});
const counts = {};
for (const r of after) counts[r.targetPath] = (counts[r.targetPath] || 0) + 1;
console.log("state after:");
for (const [k, v] of Object.entries(counts)) console.log(`   ${v}x  ${k}`);

await prisma.$disconnect();
