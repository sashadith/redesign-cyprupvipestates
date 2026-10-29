#!/usr/bin/env node
/* DTA Group — manual monthly sync (2026-10-29).
 *
 *   node --import tsx --env-file=.env.local scripts/dta-sync.mjs scripts/data/dta/2026-10-29.json          # dry run
 *   node --import tsx --env-file=.env.local scripts/dta-sync.mjs scripts/data/dta/2026-10-29.json --apply  # write
 *
 * Why manual: DTA shares one public Dropbox folder, one subfolder per project, with a
 * Photos / Presentation / Price list layout. The price lists are PDFs on three different
 * templates — nothing a feed or the Drive sync can read. Unlike Marinakis they ARE real
 * per-unit tables with SOLD and RESERVED markers, so this developer gets real units.
 *
 * Scope is the Dropbox share, ruled by the operator 2026-10-29: only a project with a
 * sale folder is imported. Seven products; the Q4 2026 deck's other nine projects, the
 * FOR RENT folder and Level Plots (building land — our property-type filter has no word
 * for a plot) stay out. See the account notes in the data file for the full ruling and
 * for every place the sources disagree.
 *
 * Monthly: re-download the price lists, re-transcribe into the data file (the sums below
 * are the check on the transcription), dry run, then --apply.
 *
 * What it writes:
 *  - DeveloperAccount slug "dta" with no driveFolderUrl, so no Drive cron ever touches it;
 *    the share link lives in developerCloudUrl and manualSyncReminderDays drives the
 *    Action Center's "sync due" item. --apply stamps driveSyncedAt.
 *  - One dev:"manual" Development per project, feedKey "manual:dta-<slug>". Project facts
 *    are only (re)written while the project is NOT published — published = frozen content.
 *  - Units as source:"manual", matched by ref. A unit that disappears from a list becomes
 *    "unlisted", never "sold" and never deleted, and ids are never recycled.
 *
 * Areas: areaInternal/areaBuilt both carry the PURE interior figure, so the page's
 * Covered Area (areaInternal + areaVeranda) reproduces the list's "total covered area"
 * instead of double-counting it. The developer's own "total" column also adds storage,
 * the share of common area and sometimes parking — that one goes into attrs, never into
 * an area field. */
import fs from "node:fs";
import { prisma } from "../src/lib/prisma.ts";
import { recomputeDevelopmentDerivedState } from "../src/lib/developmentDerivedState.ts";
import { recomputeDevelopmentDistances } from "../src/lib/developmentDistances.ts";

const file = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!file) { console.error("usage: dta-sync.mjs <data.json> [--apply]"); process.exit(1); }
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
  if (u.houseType) attrs.push({ name: "House type", value: u.houseType });
  if (u.floors) attrs.push({ name: "Storeys", value: String(u.floors) });
  if (u.ensuite) attrs.push({ name: "En-suite bathrooms", value: String(u.ensuite) });
  if (u.roofGarden != null) attrs.push({ name: "Roof garden", value: m2(u.roofGarden) });
  if (u.studio != null) attrs.push({ name: u.studios > 1 ? "Studios" : "Studio", value: m2(u.studio) });
  if (u.garden != null) attrs.push({ name: "Private garden", value: m2(u.garden) });
  if (u.storage != null) attrs.push({ name: "Storage room", value: m2(u.storage) });
  if (u.common != null) attrs.push({ name: "Share of common area", value: m2(u.common) });
  if (u.mech != null) attrs.push({ name: "Mechanical room", value: m2(u.mech) });
  if (u.parkingArea != null) attrs.push({ name: "Covered parking", value: m2(u.parkingArea) });
  if (u.parking != null) attrs.push({ name: "Covered parking spaces", value: String(u.parking) });
  if (u.totalNet != null) attrs.push({ name: "Total net area", value: m2(u.totalNet) });
  if (u.total != null) attrs.push({ name: "Total area as listed by the developer", value: m2(u.total) });
  if (u.titleDeed) attrs.push({ name: "Title deed", value: "ready" });
  attrs.push({ name: "VAT", value: u.vatPaid ? "paid, included in the price" : "not included, charged on top" });
  if (u.note) attrs.push({ name: "Note", value: u.note });

  return {
    ref: u.ref,
    label: u.label ?? null,
    type: u.type,
    status: u.status,
    price: u.price ?? null,
    beds: u.beds != null ? String(u.beds) : null,
    baths: null,
    areaBuilt: m2(u.internal),
    areaInternal: m2(u.internal),
    areaPlot: m2(u.plot),
    areaVeranda: m2(u.veranda),
    areaVerandaOpen: m2(u.terrace),
    floor: u.floor ?? null,
    storage: u.storage != null ? "yes" : null,
    guestWc: null,
    attrs,
    amenities: [],
    source: "manual",
    sortIndex: i,
  };
}

const CMP = ["label", "type", "status", "price", "beds", "areaBuilt", "areaInternal", "areaPlot", "areaVeranda", "areaVerandaOpen", "floor", "storage", "attrs", "amenities", "source", "sortIndex"];
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

try {
  const a = data.account;
  const acctBefore = await prisma.developerAccount.findUnique({ where: { slug: a.slug } });
  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${file}`);
  console.log(`account ${a.slug}: ${acctBefore ? "exists" : "would be CREATED"}`);
  const acctFields = { name: a.name, website: a.website, phone: a.phone, email: a.email, contactPerson: a.contactPerson, contactInfo: a.contactInfo, notes: a.notes, developerCloudUrl: a.developerCloudUrl, manualSyncReminderDays: a.manualSyncReminderDays };
  const acct = APPLY
    ? await prisma.developerAccount.upsert({ where: { slug: a.slug }, update: acctFields, create: { slug: a.slug, ...acctFields, driveSyncInterval: "off" } })
    : acctBefore;

  for (const p of data.projects) {
    const feedKey = `manual:dta-${p.slug}`;
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
            developerAccountId: acct.id, dev: "manual", feedProjectId: `dta-${p.slug}`, feedKey,
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
