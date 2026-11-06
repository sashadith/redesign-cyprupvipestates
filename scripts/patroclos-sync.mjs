#!/usr/bin/env node
/* Patroclos Group (brand "Carisa", Larnaca) — manual monthly sync (2026-11-04).
 *
 *   node --import tsx --env-file=.env.local scripts/patroclos-sync.mjs scripts/data/patroclos/2026-11-04.json          # dry run
 *   node --import tsx --env-file=.env.local scripts/patroclos-sync.mjs scripts/data/patroclos/2026-11-04.json --apply  # write
 *
 * Why manual: Patroclos shares one Google Drive folder (one subfolder per city, one per
 * project) whose price lists are PDFs — single-page per-unit tables with SOLD, RESERVED and
 * HOLD markers, a different column set per project. Nothing the Drive sync can read, so the
 * lists are transcribed into the data file (geometrically from the PDF text layer, checked
 * against a rendered image) and this script writes them. Same shape as dta-sync.mjs.
 *
 * Scope is the operator's ruling of 2026-11-04 ("ignore Rentals and Sold Out projects"):
 * eleven products; the account notes in the data file list everything left out and why.
 * HOLD (units the developer has not released) is stored as "reserved" — not available.
 *
 * What it writes:
 *  - DeveloperAccount slug "patroclos" with no driveFolderUrl, so no Drive cron touches it;
 *    the share link lives in developerCloudUrl (contract clause 5: never hand it to a
 *    client) and manualSyncReminderDays drives the Action Center's "sync due" item.
 *  - One dev:"manual" Development per project, feedKey "manual:patroclos-<slug>". Project
 *    facts are only (re)written while the project is NOT published — published = frozen.
 *  - Units as source:"manual", matched by ref. A unit that disappears from a list becomes
 *    "unlisted", never "sold" and never deleted, and ids are never recycled.
 *
 * Areas: areaInternal/areaBuilt carry the pure interior figure, so the page's Covered Area
 * (internal + covered veranda) reproduces the list's "internal + veranda" pairs such as
 * "180 + 23". Mezzanines, gardens and the developer's own totals go into attrs. */
import fs from "node:fs";
import { prisma } from "../src/lib/prisma.ts";
import { recomputeDevelopmentDerivedState } from "../src/lib/developmentDerivedState.ts";
import { recomputeDevelopmentDistances } from "../src/lib/developmentDistances.ts";

const file = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!file) { console.error("usage: patroclos-sync.mjs <data.json> [--apply]"); process.exit(1); }
const data = JSON.parse(fs.readFileSync(file, "utf8"));

const m2 = (n) => (n == null ? null : `${Number(n)} m²`);
const round2 = (n) => Math.round(n * 100) / 100;
const problems = [];

function unitRow(p, u, i) {
  // The list's own total columns are the check on the transcription. Every list adds up
  // its own set of parts — Luma counts the studio and the mechanical room, Alti and Level
  // count the covered parking, Athina and Mandarin neither — so both checks simply sum
  // every component the row actually carries.
  const PARTS = ["internal", "veranda", "terrace", "roofGarden", "studio", "storage", "common", "mech", "parkingArea"];
  if (u.totalCovered != null) {
    const sum = round2((u.internal ?? 0) + (u.veranda ?? 0) + (u.parkingArea ?? 0));
    if (Math.abs(sum - u.totalCovered) > 0.11) problems.push(`${p.name} ${u.ref}: internal + covered veranda (+ covered parking) = ${sum}, list says ${u.totalCovered} covered`);
  }
  if (u.total != null) {
    const sum = round2(PARTS.reduce((t, k) => t + (u[k] ?? 0), 0));
    if (Math.abs(sum - u.total) > 0.11) problems.push(`${p.name} ${u.ref}: ${PARTS.filter((k) => u[k] != null).join("+")} = ${sum}, list says ${u.total} total`);
  }
  if (u.status === "available" && !u.price) problems.push(`${p.name} ${u.ref}: available without a price`);
  if (u.status !== "available" && u.price) problems.push(`${p.name} ${u.ref}: ${u.status} but carries a price`);
  if (!["available", "reserved", "sold"].includes(u.status)) problems.push(`${p.name} ${u.ref}: status ${u.status}`);

  const attrs = [];
  if (u.block) attrs.push({ name: "Block", value: u.block });
  if (u.houseType) attrs.push({ name: "House type", value: u.houseType });
  if (u.roofGarden != null) attrs.push({ name: "Roof garden", value: m2(u.roofGarden) });
  if (u.garden != null) attrs.push({ name: "Private garden", value: m2(u.garden) });
  if (u.mezzanine != null) attrs.push({ name: "Mezzanine", value: u.mezzNote ? `${u.mezzNote} m²` : m2(u.mezzanine) });
  if (u.privatePool) attrs.push({ name: "Private swimming pool", value: "yes" });
  if (u.parking != null) attrs.push({ name: "Parking spaces", value: String(u.parking) });
  if (u.listedTotal != null) attrs.push({ name: "Total area as listed by the developer", value: m2(u.listedTotal) });
  attrs.push({ name: "VAT", value: "not included, charged on top" });
  if (u.note) attrs.push({ name: "Note", value: u.note });

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
    storage: u.storage != null || u.storageYes ? "yes" : null,
    guestWc: null,
    attrs,
    amenities: [],
    source: "manual",
    sortIndex: i,
  };
}

const CMP = ["label", "type", "status", "price", "beds", "baths", "areaBuilt", "areaInternal", "areaPlot", "areaVeranda", "areaVerandaOpen", "floor", "storage", "attrs", "amenities", "source", "sortIndex"];
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

try {
  const a = data.account;
  const acctBefore = await prisma.developerAccount.findUnique({ where: { slug: a.slug } });
  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${file}`);
  console.log(`account ${a.slug}: ${acctBefore ? "exists" : APPLY ? "CREATED" : "would be CREATED"}`);
  // The share link is confidential (contract clause 5) and is NOT in the committed data
  // file; it lives only in the DB, so a null here must never overwrite it.
  const acctFields = { name: a.name, website: a.website, phone: a.phone, email: a.email, contactPerson: a.contactPerson, contactInfo: a.contactInfo, notes: a.notes, ...(a.developerCloudUrl ? { developerCloudUrl: a.developerCloudUrl } : {}), manualSyncReminderDays: a.manualSyncReminderDays };
  const acct = APPLY
    ? await prisma.developerAccount.upsert({ where: { slug: a.slug }, update: acctFields, create: { slug: a.slug, ...acctFields, driveSyncInterval: "off" } })
    : acctBefore;

  for (const p of data.projects) {
    const feedKey = `manual:patroclos-${p.slug}`;
    const rows = p.units.map((u, i) => unitRow(p, u, i));
    const prices = rows.filter((r) => r.status === "available" && r.price).map((r) => r.price);
    const avail = rows.filter((r) => r.status === "available").length;
    const existing = await prisma.development.findUnique({ where: { feedKey }, include: { units: true } });
    const published = existing?.publishStatus === "published";
    const facts = {
      category: p.category, stage: p.stage, completion: p.completion, energy: p.energy,
      district: p.district, town: p.town, area: p.area, amenities: p.amenities,
      ...(p.latitude != null && p.longitude != null ? { latitude: p.latitude, longitude: p.longitude } : {}),
    };
    const counts = { priceFrom: prices.length ? Math.min(...prices) : null, priceTo: prices.length ? Math.max(...prices) : null, unitsTotal: rows.length, unitsAvailable: avail, syncedAt: new Date() };

    const state = existing ? `exists, ${existing.publishStatus}` : APPLY ? "CREATED as draft" : "would be CREATED as draft";
    console.log(`\n${p.name} (${feedKey}) — ${state}; ${rows.length} units, ${avail} available, €${counts.priceFrom?.toLocaleString("en")}–${counts.priceTo?.toLocaleString("en")}`);
    if (existing && !published) for (const [k, v] of Object.entries(facts)) if (!same(existing[k], v)) console.log(`  ${k}: ${JSON.stringify(existing[k])} → ${JSON.stringify(v)}`);
    if (published) console.log("  published — project facts frozen, units and prices only");

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
    for (const x of plan) console.log(`  ${x.kind.padEnd(6)} ${String(x.r.ref).padEnd(9)}${x.diff ? x.diff.join("; ") : x.kind === "create" ? `${x.r.type} ${x.r.beds}bd ${x.r.areaBuilt} ${x.r.status} ${x.r.price ?? ""}` : ""}`);
    if (!plan.length) console.log("  units unchanged");

    if (!APPLY) continue;
    const dev = existing
      ? await prisma.development.update({ where: { id: existing.id }, data: { ...counts, ...(published ? {} : facts) } })
      : await prisma.development.create({
          data: {
            developerAccountId: acct.id, dev: "manual", feedProjectId: `patroclos-${p.slug}`, feedKey,
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
  else console.log("\ntranscription checks: all sums agree with the price lists");
  if (APPLY) {
    await prisma.developerAccount.update({ where: { id: acct.id }, data: { driveSyncedAt: new Date() } });
    console.log(`\naccount ${acct.slug} → /admin/developments/developers/${acct.id} (driveSyncedAt stamped)`);
  }
} finally {
  await prisma.$disconnect();
}
