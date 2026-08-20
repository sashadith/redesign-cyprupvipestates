// Rollback: restores the `seo` blobs from a backup file written by apply-seo.mjs.
// Usage: node --env-file=.env.local restore-seo.mjs <backup-file.json>
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const file = process.argv[2];
if (!file) throw new Error("usage: restore-seo.mjs <backup-file.json>");
const backup = JSON.parse(readFileSync(file, "utf8"));
for (const [slug, seo] of Object.entries(backup)) {
  const d = await prisma.development.findFirst({ where: { slug }, select: { override: { select: { id: true } } } });
  if (!d?.override?.id) { console.log(`SKIP ${slug} (no override row)`); continue; }
  await prisma.developmentOverride.update({ where: { id: d.override.id }, data: { seo } });
  console.log(`restored ${slug}`);
}
console.log("Done.");
await prisma.$disconnect();
