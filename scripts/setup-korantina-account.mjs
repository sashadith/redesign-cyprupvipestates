#!/usr/bin/env node
/* Creates (or updates) the Korantina Homes DeveloperAccount — the one row the
   SharePoint sync needs before it can do anything. Idempotent: run it again to
   change the link or the interval.

   The share link is passed as an ARGUMENT and never committed. It is an "anyone
   with the link" URL, which makes it a bearer credential: whoever holds it can
   read Korantina's whole folder. Same treatment Kuutio's Dropbox link gets — it
   lives in the database, not in the repo.

     node --env-file=.env scripts/setup-korantina-account.mjs "<share-url>" [interval]

   interval: daily | 2day | weekly | off   (default: weekly)

   After this, do the FIRST import as a dry run and read it before writing anything:
     curl -s "http://127.0.0.1:3000/api/cron/korantina-sync?key=$CRON_SECRET&dry=1" | jq
*/
import { PrismaClient } from "@prisma/client";

const [, , shareUrl, interval = "weekly"] = process.argv;
if (!shareUrl) {
  console.error('usage: node scripts/setup-korantina-account.mjs "<sharepoint-share-url>" [daily|2day|weekly|off]');
  process.exit(1);
}
if (!/^https:\/\/[^/]*(sharepoint\.com|onedrive\.live\.com)\//i.test(shareUrl)) {
  console.error("That does not look like a SharePoint/OneDrive share link.");
  process.exit(1);
}
if (!["daily", "2day", "weekly", "off"].includes(interval)) {
  console.error(`Unknown interval "${interval}" — use daily | 2day | weekly | off`);
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const existing = await prisma.developerAccount.findFirst({ where: { name: { contains: "Korantina", mode: "insensitive" } } });
  const data = {
    name: "Korantina Homes (SharePoint)",
    slug: "korantina-homes",
    website: "https://www.korantinahomes.com",
    driveFolderUrl: shareUrl,
    driveSyncInterval: interval,
    notes: "Anonymous SharePoint share link, one folder per project, availability lists as AL_*.pdf. One availability TABLE = one Development (agreed 2026-08-26). 'Resale Ready Properties' and 'Unbranded brochures' are skipped as non-projects.",
  };

  const acct = existing
    ? await prisma.developerAccount.update({ where: { id: existing.id }, data })
    : await prisma.developerAccount.create({ data });

  console.log(`${existing ? "Updated" : "Created"} developer account:`);
  console.log(`  id       ${acct.id}`);
  console.log(`  name     ${acct.name}`);
  console.log(`  slug     ${acct.slug}`);
  console.log(`  interval ${acct.driveSyncInterval}`);
  console.log(`  link     ${acct.driveFolderUrl.slice(0, 60)}…`);
  console.log(`\nNext: curl -s "http://127.0.0.1:3000/api/cron/korantina-sync?key=$CRON_SECRET&dry=1" | jq`);
} finally {
  await prisma.$disconnect();
}
