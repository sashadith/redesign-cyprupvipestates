// One-off: clear DevelopmentOverride.district on the four rows where it pins
// "Paphos" while the override's OWN town/area already says Polis or Kouklia.
// Those overrides were written when Polis and Kouklia did not exist as
// districts, so they encode a choice made under an obsolete set of options —
// not a judgement to keep. Clearing (rather than setting Polis/Kouklia) lets
// the base column win again, so these rows keep tracking the classifier as it
// evolves instead of being pinned forever.
//
//   node /tmp/clear-partner-overrides.mjs           # dry run
//   node /tmp/clear-partner-overrides.mjs --apply   # write
//
// Everything else on the override row (town, area, coordinates, gallery, …) is
// left untouched. Engomi Plots is deliberately NOT in this list: its override
// says Nicosia and is CORRECT — our classifier is the wrong one there.
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const TARGETS = ["Argaka Village 6", "Grigio Court", "Imperial Residences", "Royal Residences"];

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const apply = process.argv.includes("--apply");
const rows = await prisma.development.findMany({
  where: { publicName: { in: TARGETS } },
  select: { id: true, publicName: true, district: true, override: { select: { id: true, district: true, town: true, area: true } } },
  orderBy: { publicName: "asc" },
});

if (rows.length !== TARGETS.length)
  throw new Error(`expected ${TARGETS.length} developments, found ${rows.length} — refusing to guess`);

const todo = [];
for (const r of rows) {
  if (!r.override) { console.log(`  SKIP ${r.publicName}: no override row`); continue; }
  if (r.override.district == null) { console.log(`  SKIP ${r.publicName}: override.district already null`); continue; }
  if (r.override.district !== "Paphos")
    throw new Error(`${r.publicName}: override.district is "${r.override.district}", expected "Paphos" — refusing to touch`);
  console.log(`  ${r.publicName} | override.district "Paphos" -> null | keeps town="${r.override.town ?? ""}" area="${r.override.area ?? ""}" | base.district=${r.district}`);
  todo.push(r);
}

console.log(`\n${todo.length} override(s) would be cleared.`);
if (!apply) {
  console.log("DRY RUN — nothing written. Re-run with --apply to write.");
} else {
  for (const r of todo) {
    await prisma.developmentOverride.update({ where: { id: r.override.id }, data: { district: null } });
    console.log(`  ✓ ${r.publicName}`);
  }
  console.log(`APPLIED: ${todo.length} override(s) cleared.`);
}
await prisma.$disconnect();
