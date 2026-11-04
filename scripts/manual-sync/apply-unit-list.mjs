#!/usr/bin/env node
/* Manual developers without their own sync script (Prospecta, Quality Home, SOL):
 * compare a price list's status/price per unit with the DB, and write the changes.
 *
 *   node --import tsx --env-file=.env.local scripts/manual-sync/apply-unit-list.mjs <accountSlug> <list.json>          # dry run
 *   node --import tsx --env-file=.env.local scripts/manual-sync/apply-unit-list.mjs <accountSlug> <list.json> --apply  # write
 *
 * list.json: { "<Development.publicName>": [{ "ref": "101", "status": "available|reserved|sold", "price": 380000 }, …] }
 * (produced by prospecta-pricelist.py, sol-prices.py, or by hand from quality-home-pricelist.py).
 *
 * Only status and price change, and only on source:"manual" units (it throws on a feed
 * unit). A ref in the list but not in the DB, or in the DB but not in the list, is
 * REPORTED, never created or unlisted — those are operator decisions (a project
 * that drops out of a list is not proof it sold out). A non-available unit carries
 * no price, like every other connector. */
import fs from "node:fs";
import { prisma } from "../../src/lib/prisma.ts";
import { recomputeDevelopmentDerivedState } from "../../src/lib/developmentDerivedState.ts";
const APPLY = process.argv.includes("--apply");
const [acc, file] = process.argv.slice(2);
const want = JSON.parse(fs.readFileSync(file, "utf8"));
const a = await prisma.developerAccount.findUnique({ where: { slug: acc } });
const devs = await prisma.development.findMany({ where: { developerAccountId: a.id }, select: { id: true, publicName: true, units: { select: { id: true, ref: true, status: true, price: true, source: true } } } });
for (const [name, rows] of Object.entries(want)) {
  const d = devs.find((x) => x.publicName === name);
  if (!d) { console.log(`## ${name}: NOT IN DB`); continue; }
  const byRef = new Map(d.units.map((u) => [String(u.ref), u]));
  const out = [];
  for (const r of rows) {
    const u = byRef.get(String(r.ref));
    if (!u) { out.push(`  NEW ${r.ref} ${r.status} ${r.price ?? ""}`); continue; }
    byRef.delete(String(r.ref));
    const ns = r.status, np = r.status === "available" ? r.price : null;
    const op = u.status === "available" ? u.price : null;
    if (u.status !== ns || (ns === "available" && op !== np)) {
      out.push(`  ${r.ref}: ${u.status} ${op ?? ""} → ${ns} ${np ?? ""}`);
      if (APPLY) { if (u.source !== "manual") throw new Error(`${name} ${r.ref}: not a manual unit`); await prisma.developmentUnit.update({ where: { id: u.id }, data: { status: ns, price: np } }); d.changed = true; }
    }
  }
  for (const u of byRef.values()) if (u.status !== "unlisted") out.push(`  MISSING-IN-LIST ${u.ref} (${u.status})`);
  if (d.changed) await recomputeDevelopmentDerivedState(d.id);
  console.log(`## ${name} (${d.id}) ${out.length ? (APPLY ? "WRITTEN" : "") : "no change"}`); out.forEach((l) => console.log(l));
}
await prisma.$disconnect();
