#!/usr/bin/env node
/* Platon Properties — manual monthly sync (2026-10-15).
 *
 *   node --import tsx --env-file=.env.local scripts/platon-sync.mjs scripts/data/platon/2026-10-15.json          # dry run
 *   node --import tsx --env-file=.env.local scripts/platon-sync.mjs scripts/data/platon/2026-10-15.json --apply  # write
 *
 * Why manual and not the Drive sync: Platon shares one Drive root with a folder per
 * project (Platon Apartments / Platon Suites / Platon Triangle / Zygi Villas), but
 * every price list is a PDF, on three different templates, often in four copies
 * (branded/unbranded × EN/RU), and Platon Suites' list has no text layer at all
 * (text drawn as outlines). The Drive sync reads per-folder spreadsheets, or G&V's
 * one PDF template; neither fits. 32 units, lists change every few weeks.
 *
 * Monthly: download the folders' price lists, run
 *   python3 scripts/manual-sync/platon-pricelist.py <pdf>…
 * (reads Apartments, Triangle and Villas from the text layer and checks their sums;
 * Suites must be rendered and transcribed by eye), update the data file, dry run,
 * then --apply.
 *
 * What it writes:
 *  - DeveloperAccount slug "platon" (no driveFolderUrl, so no Drive cron ever touches
 *    it; the folder link sits in developerCloudUrl) with manualSyncReminderDays →
 *    the Action Center's "sync due" item. --apply stamps driveSyncedAt.
 *  - One dev:"manual" Development per project, feedKey "manual:platon-<slug>".
 *    Project facts are only (re)written while the project is NOT published —
 *    published = frozen content (FEED-ADAPTER-GUIDE §3). Coordinates are written
 *    only when the data file has them, so a pin set by hand in the admin survives.
 *  - Units as source:"manual", matched by ref (Villas: "V1"…"V13", the list's
 *    "No. 1"…; apartments: the flat number). Unit plans set by platon-media.mjs are
 *    not compared, so they survive.
 *  - A unit that disappears from the price list becomes "unlisted", never "sold"
 *    and never deleted (guide §4). */
import fs from "node:fs";
import { prisma } from "../src/lib/prisma.ts";
import { recomputeDevelopmentDerivedState } from "../src/lib/developmentDerivedState.ts";
import { recomputeDevelopmentDistances } from "../src/lib/developmentDistances.ts";

const file = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!file) { console.error("usage: platon-sync.mjs <data.json> [--apply]"); process.exit(1); }
const data = JSON.parse(fs.readFileSync(file, "utf8"));

const m2 = (n) => (n == null ? null : `${Number(n)} m²`);
const problems = [];

function unitRow(p, u, i) {
  // The list's own total is the check on the transcription: interior + covered
  // veranda (+ open veranda) = total (Apartments, Triangle, Suites). The villa list
  // prints no total, so it has nothing to check against.
  if (u.total != null) {
    const sum = Math.round(((u.internal ?? 0) + (u.veranda ?? 0) + (u.terrace ?? 0)) * 100) / 100;
    if (Math.abs(sum - u.total) > 0.6) problems.push(`${p.name} ${u.ref}: ${u.internal} + ${u.veranda ?? 0} + ${u.terrace ?? 0} = ${sum}, list says ${u.total}`);
  }
  if (u.status === "available" && !u.price) problems.push(`${p.name} ${u.ref}: available without a price`);
  if (!["available", "reserved", "sold"].includes(u.status)) problems.push(`${p.name} ${u.ref}: status ${u.status}`);
  const attrs = [];
  if (u.total != null) attrs.push({ name: "Total area incl. verandas", value: m2(u.total) });
  if (u.verandaNote) attrs.push({ name: "Covered verandas", value: u.verandaNote });
  if (u.rooftop) attrs.push({ name: "Roof terrace", value: "yes (covered and uncovered veranda)" });
  if (u.wc) attrs.push({ name: "Guest WC", value: "yes" });
  if (u.floors) attrs.push({ name: "Storeys", value: String(u.floors) });
  if (u.pool) attrs.push({ name: "Private pool", value: u.pool });
  if (u.parking) attrs.push({ name: "Parking spaces", value: String(u.parking) });
  if (u.villaType) attrs.push({ name: "Villa type", value: u.villaType });
  return {
    ref: u.ref,
    label: u.label ?? null,
    type: u.type,
    status: u.status,
    price: u.price ?? null,
    beds: u.beds != null ? String(u.beds) : null,
    baths: u.baths != null ? String(u.baths) : null,
    areaBuilt: m2(u.internal),
    areaInternal: m2(u.internal),
    areaPlot: m2(u.plot),
    areaVeranda: m2(u.veranda),
    areaVerandaOpen: m2(u.terrace),
    floor: u.floor ?? null,
    storage: u.storage ? "yes" : null,
    guestWc: u.wc ? "yes" : null,
    attrs,
    amenities: u.pool ? ["Private pool"] : [],
    source: "manual",
    sortIndex: i,
  };
}

const CMP = ["label", "type", "status", "price", "beds", "baths", "areaBuilt", "areaInternal", "areaPlot", "areaVeranda", "areaVerandaOpen", "floor", "storage", "guestWc", "attrs", "amenities", "source", "sortIndex"];
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

try {
  const a = data.account;
  const acctBefore = await prisma.developerAccount.findUnique({ where: { slug: a.slug } });
  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${file}`);
  console.log(`account ${a.slug}: ${acctBefore ? "exists" : "would be CREATED"}`);
  const acctFields = { name: a.name, website: a.website, phone: a.phone, email: a.email, contactInfo: a.contactInfo, developerCloudUrl: a.developerCloudUrl, manualSyncReminderDays: a.manualSyncReminderDays };
  const acct = APPLY
    ? await prisma.developerAccount.upsert({ where: { slug: a.slug }, update: acctFields, create: { slug: a.slug, ...acctFields, driveSyncInterval: "off" } })
    : acctBefore;

  for (const p of data.projects) {
    const feedKey = `manual:platon-${p.slug}`;
    const rows = p.units.map((u, i) => unitRow(p, u, i));
    const prices = rows.filter((r) => r.status !== "sold" && r.price).map((r) => r.price);
    const avail = rows.filter((r) => r.status === "available").length;
    const existing = await prisma.development.findUnique({ where: { feedKey }, include: { units: true } });
    const published = existing?.publishStatus === "published";
    const facts = {
      category: p.category, stage: p.stage, completion: p.completion, energy: p.energy,
      district: p.district, town: p.town, area: p.area, amenities: p.amenities,
      ...(p.latitude != null && p.longitude != null ? { latitude: p.latitude, longitude: p.longitude } : {}),
    };
    const counts = { priceFrom: prices.length ? Math.min(...prices) : null, priceTo: prices.length ? Math.max(...prices) : null, unitsTotal: rows.length, unitsAvailable: avail, syncedAt: new Date() };

    console.log(`\n${p.name} (${feedKey}) — ${existing ? `exists, ${existing.publishStatus}` : "would be CREATED as draft"}; ${rows.length} units, ${avail} available, €${counts.priceFrom?.toLocaleString("en")}–${counts.priceTo?.toLocaleString("en")}`);
    if (existing && !published) for (const [k, v] of Object.entries(facts)) if (!same(existing[k], v)) console.log(`  ${k}: ${JSON.stringify(existing[k])} → ${JSON.stringify(v)}`);
    if (published) console.log("  published — project facts frozen, units and prices only");
    if (p.latitude == null) console.log("  no pin in the data file — set it in the admin");

    const byRef = new Map((existing?.units ?? []).map((u) => [u.ref, u]));
    const plan = [];
    for (const r of rows) {
      const cur = byRef.get(r.ref);
      if (!cur) { plan.push({ kind: "create", r }); continue; }
      const diff = CMP.filter((k) => !same(cur[k], r[k]));
      if (diff.length) plan.push({ kind: "update", id: cur.id, r, diff: diff.map((k) => `${k} ${JSON.stringify(cur[k])}→${JSON.stringify(r[k])}`) });
    }
    const listed = new Set(rows.map((r) => r.ref));
    for (const u of existing?.units ?? []) if (!listed.has(u.ref) && u.status !== "unlisted") plan.push({ kind: "unlist", id: u.id, r: u });
    for (const x of plan) console.log(`  ${x.kind.padEnd(6)} ${x.r.ref}${x.diff ? "  " + x.diff.join("; ") : x.kind === "create" ? `  ${x.r.type} ${x.r.beds}bd ${x.r.areaBuilt} ${x.r.status} ${x.r.price ?? ""}` : ""}`);
    if (!plan.length) console.log("  units unchanged");

    if (!APPLY) continue;
    const dev = existing
      ? await prisma.development.update({ where: { id: existing.id }, data: { ...counts, ...(published ? {} : facts) } })
      : await prisma.development.create({
          data: {
            developerAccountId: acct.id, dev: "manual", feedProjectId: `platon-${p.slug}`, feedKey,
            developerName: p.name, publicName: p.name, developer: acct.name, publishStatus: "draft",
            ...facts, ...counts,
          },
        });
    for (const x of plan) {
      if (x.kind === "create") await prisma.developmentUnit.create({ data: { developmentId: dev.id, ...x.r } });
      else if (x.kind === "update") await prisma.developmentUnit.update({ where: { id: x.id }, data: x.r });
      else await prisma.developmentUnit.update({ where: { id: x.id }, data: { status: "unlisted" } });
    }
    await recomputeDevelopmentDerivedState(dev.id);
    if (dev.latitude != null) await recomputeDevelopmentDistances(dev.id);
    console.log(`  written → /admin/developments/${dev.id}`);
  }

  if (problems.length) { console.log("\nCHECK THE TRANSCRIPTION:"); for (const x of problems) console.log("  " + x); }
  if (APPLY) {
    await prisma.developerAccount.update({ where: { id: acct.id }, data: { driveSyncedAt: new Date() } });
    console.log(`\naccount ${acct.slug} → /admin/developments/developers/${acct.id} (driveSyncedAt stamped)`);
  }
} finally {
  await prisma.$disconnect();
}
