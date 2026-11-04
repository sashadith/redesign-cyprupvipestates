#!/usr/bin/env node
/* Stylianides Group — account + project drafts (onboarded 2026-10-30).
 *
 *   node --import tsx --env-file=.env.local scripts/stylianides-setup.mjs scripts/data/stylianides/projects.json <links.json>          # dry run
 *   node --import tsx --env-file=.env.local scripts/stylianides-setup.mjs scripts/data/stylianides/projects.json <links.json> --apply  # write
 *
 * <links.json> is { "<folderKey>": "<Dropbox share link>" } and is NOT in the repo: each
 * link is a bearer credential (anyone holding it reads the folder). The links came with
 * Stylianides' property newsletter of 10 Oct 2026, one per project; there is no parent
 * folder. A project added later needs its entry in the data file and its link here.
 *
 * What it writes:
 *  - DeveloperAccount slug "stylianides", driveSyncInterval "daily", NO driveFolderUrl
 *    (so drive-sync and the Kuutio/Korantina routes never see it — its own route is
 *    /api/cron/stylianides-sync, src/lib/stylianidesSync.ts).
 *  - One dev:"stylianides" Development per project, feedKey "stylianides:<slug>", created
 *    as a DRAFT, with the share link in driveFolderId — the column the connector reads.
 *    Facts (stage, completion, location, pin, amenities, extraFacts) are written only
 *    while the project is NOT published (published = frozen content).
 *  - A project marked "manual" in the data file (2026-10-30: the two office buildings, sold
 *    whole, with a yield analysis instead of a price list) is a dev:"manual" Development,
 *    feedKey "manual:stylianides-<slug>", with its units from the data file as source
 *    "manual". The connector only reads dev:"stylianides" rows, so it never reports them as
 *    "no price list"; their price is updated here, by hand.
 *  - Nothing else: no price-list units (the connector reads them), no media
 *    (scripts/stylianides-media.mjs), no descriptions or SEO texts (written by a person). */
import fs from "node:fs";
import { prisma } from "../src/lib/prisma.ts";
import { recomputeDevelopmentDistances } from "../src/lib/developmentDistances.ts";
import { recomputeDevelopmentDerivedState } from "../src/lib/developmentDerivedState.ts";
import { isDropboxShareUrl } from "../src/lib/dropbox.ts";

const [file, linksFile] = process.argv.slice(2);
const APPLY = process.argv.includes("--apply");
if (!file || !linksFile) { console.error("usage: stylianides-setup.mjs <projects.json> <links.json> [--apply]"); process.exit(1); }
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const links = JSON.parse(fs.readFileSync(linksFile, "utf8"));
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const feedKeyOf = (p) => (p.manual ? `manual:stylianides-${p.slug}` : `stylianides:${p.slug}`);

try {
  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${file}`);
  const a = data.account;
  const acctFields = { name: a.name, website: a.website, phone: a.phone, email: a.email, contactInfo: a.contactInfo };
  const acctBefore = await prisma.developerAccount.findUnique({ where: { slug: a.slug } });
  console.log(`account ${a.slug}: ${acctBefore ? "exists" : APPLY ? "CREATED" : "would be CREATED"}`);
  const acct = APPLY
    ? await prisma.developerAccount.upsert({ where: { slug: a.slug }, update: acctFields, create: { slug: a.slug, ...acctFields, driveSyncInterval: "daily" } })
    : acctBefore;

  for (const p of data.projects) {
    const link = links[p.folderKey];
    if (!isDropboxShareUrl(link)) { console.log(`\n${p.name}: no Dropbox link for "${p.folderKey}" — skipped`); process.exitCode = 2; continue; }
    const feedKey = feedKeyOf(p);
    const existing = await prisma.development.findUnique({ where: { feedKey } });
    const published = existing?.publishStatus === "published";
    const facts = {
      category: p.category, stage: p.stage, completion: p.completion, energy: p.energy,
      district: p.district, town: p.town, area: p.area, latitude: p.latitude, longitude: p.longitude,
      amenities: p.amenities, extraFacts: p.extraFacts, driveFolderId: link,
    };
    console.log(`\n${p.name} (${feedKey}) — ${existing ? `exists, ${existing.publishStatus}` : "would be CREATED as draft"}`);
    if (published) console.log("  published — facts frozen, only the link is kept current");
    else for (const [k, v] of Object.entries(facts)) if (k !== "driveFolderId" && !same(existing?.[k], v)) console.log(`  ${k}: ${JSON.stringify(existing?.[k] ?? null)} → ${JSON.stringify(v)}`);
    if (!APPLY) continue;

    const dev = existing
      ? await prisma.development.update({ where: { id: existing.id }, data: published ? { driveFolderId: link } : facts })
      : await prisma.development.create({
          data: {
            developerAccountId: acct.id, dev: p.manual ? "manual" : "stylianides", feedProjectId: p.manual ? `stylianides-${p.slug}` : p.slug, feedKey,
            developerName: p.name, publicName: p.name, developer: acct.name, publishStatus: "draft",
            ...facts,
          },
        });
    if (p.manual && p.units?.length) {
      const existingUnits = await prisma.developmentUnit.findMany({ where: { developmentId: dev.id }, select: { id: true, ref: true } });
      for (const [i, u] of p.units.entries()) {
        const data = { ...u, source: "manual", sortIndex: i };
        const cur = existingUnits.find((e) => e.ref === u.ref);
        if (cur) await prisma.developmentUnit.update({ where: { id: cur.id }, data });
        else await prisma.developmentUnit.create({ data: { developmentId: dev.id, ...data } });
      }
      const avail = p.units.filter((u) => u.status === "available");
      const prices = avail.map((u) => u.price).filter(Boolean);
      await prisma.development.update({ where: { id: dev.id }, data: { unitsTotal: p.units.length, unitsAvailable: avail.length, priceFrom: prices.length ? Math.min(...prices) : null, priceTo: prices.length ? Math.max(...prices) : null, syncedAt: new Date() } });
      await recomputeDevelopmentDerivedState(dev.id);
      console.log(`  ${p.units.length} manual unit(s)`);
    }
    if (dev.latitude != null) await recomputeDevelopmentDistances(dev.id);
    console.log(`  written → /admin/developments/${dev.id}`);
  }
} finally {
  await prisma.$disconnect();
}
