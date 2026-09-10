#!/usr/bin/env node
/* One-off import of the four Marfields projects.
 *
 *   node --env-file=.env.local scripts/import-marfields.mjs --dry
 *   node --env-file=.env.local scripts/import-marfields.mjs
 *
 * Marfields is watched, not synced (see src/lib/shareWatch.ts): their
 * SharePoint folder changes two to four times a year, so there is no adapter
 * and this script exists to put the projects in ONCE. Re-running it is safe —
 * every write is an upsert keyed the same way a sync would key it — but it is
 * not a substitute for one.
 *
 * GAIA's price list is parsed here rather than by src/lib/ai/gvPriceTable.ts:
 * that reader is built for G&V's single-table documents and, measured against
 * this file, found 97 of 131 units and lost the €940 000 apartment, because
 * GAIA writes amounts with a space as the thousands separator and draws the €
 * in its own cell. A throwaway parser for one document is the right tool; a
 * second layout in the shared reader is not.
 *
 * Everything is created as a DRAFT. Nothing reaches the public site until the
 * operator publishes it.
 */
import { build } from "esbuild";
import { execFile } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { createCanvas } from "canvas";
import { PrismaClient } from "@prisma/client";

const require_ = createRequire(import.meta.url);
const pdfjs = require_("pdfjs-dist/legacy/build/pdf.js");

/* Floor-plan PDFs are rasterized here with pdfjs + node-canvas instead of
 * imageMirror.pdfPagesToJpegs, which shells out to `pdftoppm`. That binary
 * exists on the VPS but NOT on this machine, and pdfPagesToJpegs swallows the
 * failure and returns [] — so the first real run created all four projects with
 * "0 Planseiten" and said nothing was wrong. Same pattern as
 * scripts/pdf-color-extract-worker.mjs. A PDF that yields no page is reported
 * loudly below rather than silently dropped. */
async function rasterizePdf(buf, maxPages = 12) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), disableFontFace: true, verbosity: 0 }).promise;
  const out = [];
  for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1.75 });
    const canvas = createCanvas(vp.width, vp.height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
    out.push(canvas.toBuffer("image/png"));
  }
  return out;
}

const DRY = process.argv.includes("--dry");
// --plans-only: leave galleries and units alone and (re)build just the floor
// plans. Used after the first run, which created every project with zero plans.
const PLANS_ONLY = process.argv.includes("--plans-only");
const SHARE = "https://marfields-my.sharepoint.com/:f:/p/j_kopeikina/IgA0ayymvc0yT4Nmjbpgz0yAAeIApQUcQFyendkIJ_BM5S8?e=1oTo0d";

/* Districts come from the documents, not from guesswork: GAIA's own price list
 * prints "LIMASSOL, CYPRUS", and the other two carry their city in the project
 * name. Olympic/Zeus states no location anywhere in the share, so it is left
 * empty for the operator rather than guessed — an empty district shows as a
 * gap in the admin; a wrong one shows as a wrong map pin. */
const PROJECTS = [
  { match: /^GAIA/i,     name: "GAIA Residences",                    slug: "gaia-residences",            district: "Limassol", units: "gaia" },
  { match: /^NICOSIA/i,  name: "Nicosia Central Park Residences",    slug: "nicosia-central-park-residences", district: "Nicosia",  units: null },
  { match: /^OLYMPIC/i,  name: "Olympic Residences – Zeus Penthouse", slug: "olympic-residences-zeus-penthouse", district: null,     units: null },
  { match: /^THE RITZ/i, name: "The Ritz-Carlton Residences Limassol", slug: "ritz-carlton-residences-limassol", district: "Limassol", units: null },
];

const scratch = join(process.cwd(), "node_modules", ".mf-import");
mkdirSync(scratch, { recursive: true });
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
const bundle = async (entry, name) => {
  const o = await build({
    entryPoints: [entry], bundle: true, platform: "node", format: "esm", write: false,
    external: ["@prisma/client", ".prisma/client/default", "@anthropic-ai/sdk", "sharp"],
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  });
  const f = join(scratch, name);
  writeFileSync(f, o.outputFiles[0].text);
  return import(f);
};

const sp = await bundle("src/lib/sharepoint.ts", "sp.mjs");
const mirror = await bundle("src/lib/imageMirror.ts", "mirror.mjs");
const derived = await bundle("src/lib/developmentDerivedState.ts", "derived.mjs");
const prisma = new PrismaClient();

const isImage = (f) => sp.IMAGE_MIME_RE.test(f.mimeType) || /\.(jpe?g|png|webp)$/i.test(f.name);
const runWorker = (path) =>
  new Promise((res, rej) => execFile("node", ["scripts/pdf-table-extract-worker.mjs", path], { maxBuffer: 2e8 }, (e, so) => (e ? rej(e) : res(JSON.parse(so)))));

/* GAIA's table, one page per building. Unit numbers restart at 1 in every
 * building, so the building letter has to be part of the ref or five different
 * apartments would all be called "1". */
function parseGaia(pages) {
  const units = [];
  for (const page of pages) {
    const label = page.rows.flatMap((r) => r.cells).map((c) => c.t.trim()).find((t) => /BUILDING/i.test(t)) ?? "";
    const letter = (label.match(/BUILDING\s+([A-Z])/i)?.[1] ?? "?").toUpperCase();
    const buildingName = label.replace(/\s+/g, " ").trim();
    for (const row of page.rows) {
      const joined = row.cells.map((c) => c.t.trim()).join(" ").replace(/\s+/g, " ");
      // floor, no., type, bedrooms, net area, core — then whatever the price cell became.
      // Type is up to THREE letters: "BCD" is a combined B+C+D apartment, and a
      // two-letter limit dropped it silently — 130 units instead of 131.
      const m = joined.match(/(?:^|\s)(G|\d{1,2})\s+(\d{1,3})\s+([A-Z]{1,3}\d?[a-z]?)\s+(\d\+?)\s+([\d.,]+)\s+([\d.,]+)\s+(.*)$/);
      if (!m) continue;
      const [, floor, no, type, beds, net, core, tail] = m;
      const sold = /\bSOLD\b/i.test(tail);
      // "€ 1 100 000" — the space is a thousands separator and the € sits in its
      // own cell, which is exactly what the shared reader could not follow.
      const priceMatch = tail.match(/€\s*([\d][\d\s]{4,12})/);
      const price = priceMatch ? Number(priceMatch[1].replace(/\D/g, "")) : null;
      if (!sold && price === null) continue;
      units.push({
        ref: `${letter}-${no}`,
        // feedRef is what a later sync matches on; ref is the editable display
        // one. Same value today, but they are allowed to diverge once the
        // operator renames a unit, so both are set explicitly.
        feedRef: `${letter}-${no}`,
        label: `${buildingName} · No. ${no}`,
        unitNumber: no,
        floor: floor === "G" ? "Ground" : floor,
        type,
        beds: beds.replace("+", ""),
        areaBuilt: net.replace(",", "."),
        price,
        status: sold ? "sold" : "available",
      });
    }
  }
  return units;
}

const ctx = await sp.openShare(SHARE);
const root = await sp.listFolder(ctx, ctx.rootId);
console.log(`${DRY ? "TROCKENLAUF — es wird nichts geschrieben" : "IMPORT"}\n`);

const account = DRY
  ? { id: "(waere neu)", name: "Marfields", slug: "marfields" }
  : await prisma.developerAccount.upsert({
      where: { slug: "marfields" },
      update: { driveFolderUrl: SHARE, driveSyncInterval: "off" },
      create: { name: "Marfields", slug: "marfields", driveFolderUrl: SHARE, driveSyncInterval: "off" },
    });
console.log(`Bauträger: ${account.name} (${account.slug})  id=${account.id}\n`);

for (const cfg of PROJECTS) {
  const folder = root.find((f) => sp.isFolder(f) && cfg.match.test(f.name));
  if (!folder) { console.log(`!! Ordner nicht gefunden für ${cfg.name}`); continue; }
  const tree = await sp.listTree(ctx, folder.id, { maxDepth: 4 });
  const files = tree.filter((t) => !sp.isFolder(t.file));
  const images = files.filter((t) => isImage(t.file));
  const planPdfs = files.filter((t) => sp.isPdf(t.file) && /(^|\/)(plans?|master\s*plan)/i.test(t.path));

  let units = [];
  if (cfg.units === "gaia") {
    const pl = files.find((t) => /pricelist/i.test(t.path) && /10\.07/.test(t.file.name));
    const buf = await sp.downloadFile(ctx, pl.file.id);
    const tmp = join(scratch, "gaia.pdf");
    writeFileSync(tmp, buf);
    units = parseGaia(await runWorker(tmp));
  }
  const available = units.filter((u) => u.status === "available").length;

  console.log(`${cfg.name}`);
  console.log(`   Ordner:   ${folder.name}`);
  console.log(`   Ort:      ${cfg.district ?? "— (nicht im Dokument, bleibt leer)"}`);
  console.log(`   Bilder:   ${images.length}   Grundriss-PDFs: ${planPdfs.length}`);
  console.log(`   Einheiten: ${units.length}${units.length ? ` (${available} verfügbar, ${units.length - available} verkauft)` : " —"}`);

  if (DRY) {
    const clash = await prisma.development.findFirst({ where: { slug: cfg.slug }, select: { publicName: true } });
    const clashP = await prisma.project.findFirst({ where: { slug: cfg.slug }, select: { title: true } });
    console.log(`   Slug:     /${cfg.slug}${clash || clashP ? `   !! KOLLISION mit ${clash?.publicName ?? clashP?.title}` : "   frei"}`);
    if (units.length) {
      const priced = units.filter((u) => u.price);
      console.log(`   Preise:   ${priced.map((u) => `${u.ref}=${u.price.toLocaleString("de-DE")}`).join(", ")}`);
    }
    console.log("");
    continue;
  }

  const feedProjectId = cfg.slug;
  const feedKey = `sharepoint:${account.id}:${feedProjectId}`;
  const devKey = mirror.devKeyFor(feedKey);
  const gallery = [];
  for (const t of PLANS_ONLY ? [] : images) {
    const url = await mirror.storeUploadedImage(await sp.downloadFile(ctx, t.file.id), devKey);
    if (url) gallery.push(url);
    process.stdout.write(`\r   spiegle Bilder … ${gallery.length}/${images.length}`);
  }
  const plans = [];
  const emptyPdfs = [];
  for (const t of planPdfs) {
    const pages = await rasterizePdf(await sp.downloadFile(ctx, t.file.id));
    if (!pages.length) emptyPdfs.push(t.file.name);
    for (const page of pages) {
      const url = await mirror.storeUploadedImage(page, devKey);
      if (url) plans.push(url);
    }
    process.stdout.write(`\r   spiegle Pläne …  ${plans.length}`);
  }
  process.stdout.write("\r" + " ".repeat(60) + "\r");
  if (emptyPdfs.length) console.log(`   !! ${emptyPdfs.length} Plan-PDF(s) ergaben keine Seite: ${emptyPdfs.join(", ")}`);

  const data = {
    developerAccountId: account.id, dev: "sharepoint", feedProjectId, feedKey,
    // Yes, these read backwards: `developerName` carries the PROJECT name and
    // `developer` the account's — that is the convention both live syncs use
    // (driveAvailabilitySync.ts:175, sharepointAvailabilitySync.ts:712).
    developerName: cfg.name, publicName: cfg.name, developer: account.name, slug: cfg.slug,
    district: cfg.district, gallery, plans,
    unitsTotal: units.length, unitsAvailable: available, syncedAt: new Date(),
  };
  if (PLANS_ONLY) {
    await prisma.development.update({ where: { feedKey }, data: { plans } });
    console.log(`   ✓ ${plans.length} Planseiten gesetzt (Galerie und Einheiten unberührt)\n`);
    continue;
  }
  const dev = await prisma.development.upsert({ where: { feedKey }, update: data, create: data });
  if (units.length) {
    await prisma.developmentUnit.deleteMany({ where: { developmentId: dev.id, source: "feed" } });
    await prisma.developmentUnit.createMany({
      data: units.map((u, i) => ({ developmentId: dev.id, source: "feed", sortIndex: i, currency: "EUR", ...u })),
    });
  }
  await derived.recomputeDevelopmentDerivedState(dev.id);
  console.log(`   ✓ angelegt als ${dev.publishStatus}: ${gallery.length} Bilder, ${plans.length} Planseiten, ${units.length} Einheiten\n`);
}

await prisma.$disconnect();
