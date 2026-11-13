#!/usr/bin/env node
/* DTA Group — switch the account over to the daily price-list connector (2026-11-13).
 *
 *   node --import tsx --env-file=.env.local scripts/dta-connector-setup.mjs                               # dry run
 *   node --import tsx --env-file=.env.local scripts/dta-connector-setup.mjs --apply                       # write
 *   node --import tsx --env-file=.env.local scripts/dta-connector-setup.mjs --link-file <path> --apply    # also store the link
 *
 * What the connector (src/lib/dtaSync.ts) needs on the DeveloperAccount slug "dta":
 *  - developerCloudUrl = the Dropbox share holding every project folder. The 2026-10-29
 *    import already wrote it there; --link-file <path> replaces it with the URL in that
 *    file (a file, so the link never lands in shell history; keep it outside the repo).
 *    The link is never printed — only whether it is a Dropbox share.
 *  - driveSyncInterval = "daily". The import created the account with "off", which the
 *    scheduled run (&scheduled=1) reads as "never".
 *  - monthlyManualSync = false: the account no longer belongs in the monthly manual round.
 *
 * Writes nothing else. Prints the six Developments the connector reads and their units. */
import fs from "node:fs";
import { prisma } from "../src/lib/prisma.ts";
import { isDropboxShareUrl } from "../src/lib/dropbox.ts";
import { DTA_PROJECTS, dtaFeedKey } from "../src/lib/dta.ts";

const APPLY = process.argv.includes("--apply");
const li = process.argv.indexOf("--link-file");
const link = li > 0 ? fs.readFileSync(process.argv[li + 1], "utf8").trim() : null;
if (link != null && !isDropboxShareUrl(link)) { console.error("--link-file does not hold a Dropbox share URL"); process.exit(1); }

try {
  const acct = await prisma.developerAccount.findUnique({ where: { slug: "dta" } });
  if (!acct) { console.error('no DeveloperAccount with slug "dta"'); process.exit(1); }
  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — account ${acct.name} (${acct.id})`);
  console.log(`  developerCloudUrl: ${isDropboxShareUrl(acct.developerCloudUrl) ? "a Dropbox share" : acct.developerCloudUrl ? "set, but NOT a Dropbox share" : "empty"}${link ? " → replaced from --link-file" : ""}`);
  console.log(`  driveFolderUrl:    ${acct.driveFolderUrl ? "SET — clear it: a Dropbox link there runs the Kuutio importer from the admin page" : "empty (correct)"}`);
  console.log(`  driveSyncInterval: ${acct.driveSyncInterval ?? "null (= daily)"}${acct.driveSyncInterval === "daily" ? "" : " → daily"}`);
  console.log(`  monthlyManualSync: ${acct.monthlyManualSync}${acct.monthlyManualSync ? " → false" : ""}`);

  for (const p of DTA_PROJECTS) {
    const d = await prisma.development.findFirst({
      where: { developerAccountId: acct.id, feedKey: dtaFeedKey(p.slug) },
      select: { id: true, publicName: true, publishStatus: true, units: { select: { status: true, source: true, pinnedFields: true } } },
    });
    if (!d) { console.log(`  ${p.name}: NO Development ${dtaFeedKey(p.slug)}`); continue; }
    const by = (s) => d.units.filter((u) => u.status === s).length;
    const pinned = d.units.filter((u) => (u.pinnedFields ?? []).length).length;
    console.log(`  ${d.publicName} (${d.publishStatus}): ${d.units.length} units — ${by("available")} available, ${by("reserved")} reserved, ${by("sold")} sold, ${by("unlisted")} unlisted${pinned ? `, ${pinned} with pins` : ""}`);
  }

  if (APPLY) {
    await prisma.developerAccount.update({
      where: { id: acct.id },
      data: { driveSyncInterval: "daily", monthlyManualSync: false, ...(link ? { developerCloudUrl: link } : {}) },
    });
    console.log("\nwritten. Next: curl the route with &dry=1 and read the report before the first real run.");
  }
} finally {
  await prisma.$disconnect();
}
