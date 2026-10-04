#!/usr/bin/env node
/* Creates (or leaves in place) the Plus Properties DeveloperAccount. Runs where
   DATABASE_URL points at production — on the VPS, in the live release:
     ssh root@72.60.89.239 'cd /var/www/cyprusvipestates && node scripts/setup-plus-properties-account.mjs'
   Idempotent: a second run changes nothing.

   driveFolderUrl is deliberately NOT set and driveSyncInterval is "off": the
   generic Drive sync picks up any account with a folder URL and an interval,
   and it would read this developer's two-tree layout wrongly. This developer
   is synced only by /api/cron/plus-sync. */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const acct = await prisma.developerAccount.upsert({
  where: { slug: "plus-properties" },
  update: {},
  create: {
    slug: "plus-properties",
    name: "Plus Properties",
    website: "https://www.pluspropertiescyprus.com",
    driveSyncInterval: "off",
    notes: "Synced by /api/cron/plus-sync from Drive folder 1DOgqxKagV79t-9if8uHJi0woLLk6pTD8 (price lists: Availabilities xml - Cyprus; media: Cyprus Projects). Greece is out of scope.",
  },
});
console.log(`account ${acct.slug} → ${acct.id}`);
await prisma.$disconnect();
