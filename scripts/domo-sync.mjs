#!/usr/bin/env node
/* DOMO Properties — phase 1: account, project drafts and media (2026-11-13).
 *
 *   node --import tsx --env-file=.env.local scripts/domo-sync.mjs scripts/data/domo/2026-11-13.json           # dry run
 *   node --import tsx --env-file=.env.local scripts/domo-sync.mjs scripts/data/domo/2026-11-13.json --apply   # write
 *   DOMO_CLOUD_URL='https://domoproperties.sharepoint.com/:f:/g/...' … --apply                                # also stores the share link
 *
 * WHAT THIS DOES AND DOES NOT DO. It creates the developer account, one DRAFT
 * development per project in the data file, and mirrors that project's renders
 * and floor plans out of DOMO's SharePoint share. It writes NO units and NO
 * prices: those come from the master price list at domoproperties.com/mp in
 * phase 2, and until then every project here is a draft with pictures and no
 * stock. A draft is invisible on the site, which is the point — the operator
 * publishes when the content is right.
 *
 * The share link is a bearer credential: anyone holding it can read DOMO's
 * agent library without signing in. It is never committed. Pass it once via
 * DOMO_CLOUD_URL (or set it in the admin) and it is stored in
 * DeveloperAccount.developerCloudUrl. A run without it uses whatever is already
 * stored and never clears it.
 *
 * Three rules this shares with every other sync in this repo:
 *   - PUBLISHED IS FROZEN. A project the operator has published is never
 *     overwritten here — not its gallery, not its name, not its facts.
 *   - IDENTITY IS NEVER DERIVED FROM A FILE NAME. Five DOMO projects were
 *     renamed and their files still say Alveo, Seya, Vireo, Orien and Caeli.
 *     The feedKey is `domo:<slug>` from the data file and nothing else.
 *   - A FOREIGN ROW IS NEVER TOUCHED. If a development with this feedKey exists
 *     and was not created by this sync, it is reported and skipped.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { prisma } from "../src/lib/prisma.ts";
import { openShare, listFolder, listTree, isFolder } from "../src/lib/sharepoint.ts";
import { splitFolder, claimPhoto } from "../src/lib/domo/media.ts";
import { storeUploadedImage, devKeyFor, pdfPagesToJpegs } from "../src/lib/imageMirror.ts";
import { downloadFile } from "../src/lib/sharepoint.ts";
import { recomputeDevelopmentDerivedState } from "../src/lib/developmentDerivedState.ts";

/* The local DATABASE_URL tunnels to PRODUCTION, and the tunnel is not always up.
   A dry run's reads only decide "does this row already exist", so an unreachable
   database degrades it to "assume nothing exists" with a warning rather than
   killing a run whose real subject is the share and the data file. An --apply
   run never degrades: it fails loudly. */
let dbDown = false;
async function dbRead(fn) {
  if (dbDown) return null;
  try { return await fn(); } catch (e) {
    if (APPLY) throw e;
    if (!dbDown) { dbDown = true; console.log(`! database unreachable (${String(e.message).split("\n")[0]}) — dry run continues as if nothing exists yet\n`); }
    return null;
  }
}

const file = process.argv[2];
const APPLY = process.argv.includes("--apply");
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").slice("--only=".length);
if (!file) { console.error("usage: domo-sync.mjs <data.json> [--apply] [--only=<slug>]"); process.exit(1); }
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const DEV = "domo";
const problems = [];
const log = (...a) => console.log(...a);

/* ── account ─────────────────────────────────────────────────────────────── */
async function upsertAccount() {
  const a = data.account;
  const cloud = process.env.DOMO_CLOUD_URL?.trim() || null;
  const existing = await dbRead(() => prisma.developerAccount.findFirst({ where: { slug: a.slug } }));
  const fields = {
    name: a.name, slug: a.slug, website: a.website, phone: a.phone, email: a.email,
    contactPerson: a.contactPerson, contactInfo: a.contactInfo, notes: a.notes,
    driveSyncInterval: a.driveSyncInterval ?? "off",
    manualSyncReminderDays: a.manualSyncReminderDays ?? null,
    // Never cleared by a run that was not given one.
    ...(cloud ? { developerCloudUrl: cloud } : {}),
  };
  log(`account ${existing ? "UPDATE" : "CREATE"} ${a.name} (${a.slug})${cloud ? " + share link" : existing?.developerCloudUrl ? " (keeping stored share link)" : " — NO share link yet"}`);
  if (!APPLY) return existing ?? { id: "(dry-run)", ...fields };
  return existing
    ? prisma.developerAccount.update({ where: { id: existing.id }, data: fields })
    : prisma.developerAccount.create({ data: fields });
}

/* ── media ───────────────────────────────────────────────────────────────── */
const sha = (buf) => crypto.createHash("md5").update(buf).digest("hex");

async function mirrorProject(ctx, folderEntry, project, seenHashes) {
  const tree = await listTree(ctx, folderEntry.id, { basePath: "", maxDepth: 4 });
  const files = tree
    .filter((e) => !isFolder(e.file))
    .map((e) => ({ path: e.path, name: e.file.name, mimeType: e.file.mimeType, size: e.file.size, id: e.file.id }));
  const split = splitFolder(files);
  const devKey = devKeyFor(`${DEV}:${project.slug}`);
  const gallery = [];
  const plans = [];
  const skippedShared = [];

  for (const p of split.photos) {
    /* A dry run must not pull 400 MB out of SharePoint to tell the operator what
       it would do, so it dedupes on name+size instead of content. That proxy was
       checked against the real thing: the five renders Messina and Padua share
       match on name AND size AND md5, so the cheap key finds exactly the same
       pair. An --apply run always hashes the bytes it is about to store. */
    const buf = APPLY ? await downloadFile(ctx, p.id) : null;
    const key = buf ? sha(buf) : `${p.name}:${p.size}`;
    const claim = claimPhoto(seenHashes, key, project.slug);
    if (!claim.take) { skippedShared.push(`${p.name} (already on ${claim.ownedBy})`); continue; }
    if (!APPLY) { gallery.push(`(dry-run) ${p.path}`); continue; }
    const url = await storeUploadedImage(buf, devKey);
    if (url) gallery.push(url); else problems.push(`${project.slug}: could not mirror ${p.path}`);
  }
  for (const pl of split.plans) {
    if (!APPLY) { plans.push(`(dry-run) ${pl.path}`); continue; }
    const buf = await downloadFile(ctx, pl.id);
    try {
      if (/\.pdf$/i.test(pl.name)) {
        for (const page of await pdfPagesToJpegs(buf)) {
          const url = await storeUploadedImage(page, devKey);
          if (url) plans.push(url);
        }
      } else {
        const url = await storeUploadedImage(buf, devKey);
        if (url) plans.push(url);
      }
    } catch (e) { problems.push(`${project.slug}: plan ${pl.name} failed (${e.message})`); }
  }
  return { gallery, plans, skippedShared, counted: { photos: split.photos.length, plans: split.plans.length } };
}

/* ── projects ────────────────────────────────────────────────────────────── */
async function writeProject(account, project, media) {
  const feedKey = `${DEV}:${project.slug}`;
  const existing = await dbRead(() => prisma.development.findUnique({
    where: { feedKey },
    select: { id: true, dev: true, publicName: true, publishStatus: true, gallery: true },
  }));
  if (existing && existing.dev !== DEV) {
    problems.push(`${project.slug}: feedKey ${feedKey} belongs to dev "${existing.dev}" ("${existing.publicName}") — not touched`);
    return null;
  }
  if (existing?.publishStatus === "published") {
    log(`  ${project.slug}: published — frozen, nothing written`);
    return existing.id;
  }
  const fields = {
    feedKey, dev: DEV, developerAccountId: account.id,
    /* feedKey is "<dev>:<feedProjectId>" by the schema's own definition, so the
       slug has to be the feedProjectId or the two would disagree. developerName
       is "the original project name from the feed" — for DOMO that is the folder
       name, never the old studio name (Alveo, Seya, Vireo, Orien, Caeli), which
       is exactly what publicName and developerName must NOT become.
       Both are required columns with no default; domoSyncFields.test.ts checks
       this object against the schema so a missing one fails before a run does. */
    feedProjectId: project.slug,
    developerName: project.name,
    publicName: project.name,
    developer: data.account.name,
    category: project.category,
    stage: project.stage,
    district: project.district,
    town: null,
    area: project.area,
    latitude: project.latitude,
    longitude: project.longitude,
    publishStatus: "draft",
    ...(media ? { gallery: media.gallery, plans: media.plans } : {}),
  };
  const planWord = APPLY ? "plan pages" : "plan files";
  log(`  ${project.slug}: ${existing ? "UPDATE" : "CREATE"} draft | ${media ? `${media.gallery.length} photos, ${media.plans.length} ${planWord}` : "no folder — metadata only"}`);
  if (media?.skippedShared.length) log(`     shared renders skipped: ${media.skippedShared.join(", ")}`);
  if (!APPLY) return null;
  const row = existing
    ? await prisma.development.update({ where: { id: existing.id }, data: fields })
    : await prisma.development.create({ data: fields });
  await recomputeDevelopmentDerivedState(row.id).catch(() => {});
  return row.id;
}

/* ── run ─────────────────────────────────────────────────────────────────── */
const account = await upsertAccount();
const cloud = process.env.DOMO_CLOUD_URL?.trim() || account.developerCloudUrl || null;
const projects = data.projects.filter((p) => !ONLY || p.slug === ONLY);

let ctx = null;
let roots = [];
if (cloud) {
  ctx = await openShare(cloud);
  roots = await listFolder(ctx, ctx.rootId);
  log(`share opened: ${roots.filter(isFolder).length} folders\n`);
} else {
  log("NO share link — running metadata only (set DOMO_CLOUD_URL to mirror media)\n");
}

/* Projects that CLAIM a shared render set go first, so which project keeps a
   photo two folders both contain is a decision in the data file rather than a
   side effect of the order projects happen to be listed in. Messina claims the
   five interiors it shares with Padua: Messina has six renders of its own,
   Padua eight, so the shared set is worth more to Messina. */
const seenHashes = new Map();
const order = [...projects].sort((a, b) => (b.claimsSharedRenders ? 1 : 0) - (a.claimsSharedRenders ? 1 : 0));
for (const project of order) {
  const folderEntry = project.folder ? roots.find((f) => f.name === project.folder) : null;
  if (project.folder && !folderEntry && ctx) problems.push(`${project.slug}: folder "${project.folder}" not found in the share`);
  const media = folderEntry ? await mirrorProject(ctx, folderEntry, project, seenHashes) : null;
  /* Compared against what the FOLDER holds, not against what the project will
     show: Padua's folder has thirteen renders and shows eight, because Messina
     claims the five they share. photosInFolder carries that difference, and a
     mismatch here means the share itself changed — which is exactly what this
     check is for. */
  const expectPhotos = project.media.photosInFolder ?? project.media.photos;
  if (media && media.counted.photos !== expectPhotos) {
    problems.push(`${project.slug}: data file expects ${expectPhotos} photos in the folder, the share has ${media.counted.photos}`);
  }
  if (media && media.counted.plans !== project.media.plans) {
    problems.push(`${project.slug}: data file expects ${project.media.plans} plan files, the share has ${media.counted.plans}`);
  }
  await writeProject(account, project, media);
}

log(`\n${APPLY ? "APPLIED" : "DRY RUN"} — ${projects.length} projects`);
if (APPLY) {
  // A local run writes rows into the PRODUCTION database that point at image
  // files on this laptop. Same step as Giovani, Marinakis, DTA, Platon and Reiwa.
  log("\nImages were written to public/uploads/developments/domo-* of THIS checkout.");
  log("They are not on the server until you rsync them:");
  log("  rsync -av public/uploads/developments/domo-* root@72.60.89.239:/var/www/shared-uploads/developments/");
}
if (problems.length) { log(`\n${problems.length} problem(s):`); for (const p of problems) log(`  - ${p}`); }
await prisma.$disconnect();
