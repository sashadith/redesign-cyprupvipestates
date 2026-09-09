#!/usr/bin/env node
/* One-off: create the DeveloperAccount for G&V Developers.
 *
 *   node --env-file=.env.local scripts/setup-gv-account.mjs
 *
 * Idempotent — re-running updates the existing row rather than creating a
 * second one. The slug MUST stay "gv-drive": driveAvailabilitySync keys both
 * PDF_TABLE_PRICELIST_DEVS (which reader to use) and EXCLUDED_FOLDERS_BY_DEV
 * off it, so a different slug silently gives this developer the spreadsheet
 * path and no folder exclusions.
 *
 * The interval is weekly, matching Kuutio and Korantina: G&V's price lists
 * change weeks apart, and syncAllDrives honours driveSyncInterval. */
import { PrismaClient } from "@prisma/client";

const SLUG = "gv-drive";
const FOLDER = "https://drive.google.com/drive/folders/1VQEg9Nue9YiTErIb2zYYSnKbqWyd-qno";

const prisma = new PrismaClient();
try {
  const before = await prisma.developerAccount.findUnique({ where: { slug: SLUG } });
  const row = await prisma.developerAccount.upsert({
    where: { slug: SLUG },
    update: { driveFolderUrl: FOLDER, driveSyncInterval: "weekly" },
    create: { name: "G&V (drive)", slug: SLUG, driveFolderUrl: FOLDER, driveSyncInterval: "weekly" },
  });
  console.log(`${before ? "updated" : "created"}  ${row.slug}  "${row.name}"`);
  console.log(`  id       ${row.id}`);
  console.log(`  folder   ${row.driveFolderUrl}`);
  console.log(`  interval ${row.driveSyncInterval}`);
} finally {
  await prisma.$disconnect();
}
