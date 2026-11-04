// One-off backfill (2026-10-20): bring every stored DevelopmentUnit.type onto
// the canonical vocabulary in src/lib/unitType.ts. Run AFTER the release that
// carries the write-time normalization is live (otherwise the next sync on the
// old code writes the old spellings straight back):
//   npx esbuild scripts/backfill-unit-types.ts --bundle --platform=node --format=cjs --packages=external --alias:@=./src --outfile=/tmp/backfill-unit-types.cjs
//   node /tmp/backfill-unit-types.cjs           (dry run: counts per old → new)
//   node /tmp/backfill-unit-types.cjs --apply   (writes)
// Units whose type is empty, a block letter or "Building" get the type the
// operator agreed per project (PROJECT_TYPE below, from each project's own
// published description); Leptos' "Apartments / Penthouses" becomes Apartment.
import { prisma } from "@/lib/prisma";
import { canonicalUnitType } from "@/lib/unitType";

const APPLY = process.argv.includes("--apply");
const PROJECT_TYPE: Record<string, string> = {
  "Elpez": "Villa", "Gallery": "Villa", "Alta Mare Phase I": "Villa", "Tenera Villas 1A & 1B": "Villa", "Terra Homes": "Villa", "Baia": "Villa",
  "Tress": "Apartment", "Cedar Park": "Apartment",
  "Thalassa Residences 2": "Shop",
  "Plus 92": "Commercial", "Regent": "Commercial",
};

async function main() {
  const units = await prisma.developmentUnit.findMany({
    select: { id: true, type: true, label: true, name: true, development: { select: { publicName: true, publishStatus: true } } },
  });
  const changes: { id: string; from: string | null; to: string }[] = [];
  const unresolved: string[] = [];
  for (const u of units) {
    const v = canonicalUnitType(u.type, u);
    let to: string | null = v.kind === "type" ? v.type : v.kind === "ambiguous" ? v.fallback : null;
    if (v.kind === "none") to = PROJECT_TYPE[u.development.publicName] ?? null;
    if (!to) { if (u.development.publishStatus !== "archived") unresolved.push(`${u.development.publicName} (${u.development.publishStatus}): ${u.label ?? u.name ?? u.id} type=${JSON.stringify(u.type)}`); continue; }
    if (to !== u.type) changes.push({ id: u.id, from: u.type, to });
  }
  const tally = new Map<string, number>();
  for (const c of changes) tally.set(`${JSON.stringify(c.from)} → ${c.to}`, (tally.get(`${JSON.stringify(c.from)} → ${c.to}`) ?? 0) + 1);
  console.log(`${units.length} units, ${changes.length} to change:`);
  for (const [k, n] of Array.from(tally.entries()).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${k}`);
  console.log(`\nleft without a type (${unresolved.length}):`);
  for (const l of unresolved) console.log("  " + l);
  if (!APPLY) { console.log("\nDry run — nothing written."); return; }
  const byTo = new Map<string, string[]>();
  for (const c of changes) byTo.set(c.to, [...(byTo.get(c.to) ?? []), c.id]);
  let n = 0;
  for (const [to, ids] of Array.from(byTo.entries())) n += (await prisma.developmentUnit.updateMany({ where: { id: { in: ids } }, data: { type: to } })).count;
  console.log(`\nApplied: ${n} unit(s) updated.`);
}
main().finally(() => prisma.$disconnect());
