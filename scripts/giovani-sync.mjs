#!/usr/bin/env node
/* Giovani Homes — manual sync (onboarded 2026-10-27).
 *
 *   node --import tsx --env-file=.env.local scripts/giovani-sync.mjs scripts/data/giovani/2026-10-27.json          # dry run
 *   node --import tsx --env-file=.env.local scripts/giovani-sync.mjs scripts/data/giovani/2026-10-27.json --apply  # write
 *
 * Source: Giovani's anonymous Drive root (12fmNiiJbqZkIm3W_es76ByaPHVD7VHcl), one folder per
 * project (Protaras / Paralimni / Ayia Napa, one in Livadia, Larnaca) with brochure,
 * description, plans, a Maps-pin docx and a technical spec — but NO price list. Prices
 * arrive by email; the operator asked Giovani (2026-10-27) for a standing price-list link.
 * Until that link exists this is a manual developer: the price list is transcribed into
 * the data file's projects[].units and this script is re-run (first-Monday round,
 * [[monthly-manual-sync-round]]). Once the link exists, point a reader at it that
 * produces the same units[] shape — nothing below has to change.
 *
 * What it writes:
 *  - DeveloperAccount slug "giovani" (no driveFolderUrl, so no Drive cron touches it; the
 *    folder link sits in developerCloudUrl), monthlyManualSync = true. --apply stamps
 *    manualSyncedAt when the file carries units.
 *  - One dev:"manual" Development per project, feedKey "manual:giovani-<slug>", created as
 *    a DRAFT. Project facts are only (re)written while the project is NOT published
 *    (published = frozen content, FEED-ADAPTER-GUIDE §3). Coordinates are the developer's
 *    own Maps pins from the 6. LOCATION docx.
 *  - DevelopmentOverride.descriptionEN/DE/PL/RU from the data file, written only where the
 *    field is still empty — an edited text is never overwritten. HE is left alone.
 *  - Units as source:"manual", matched by ref. A unit that disappears from the price list
 *    becomes "unlisted", never "sold" and never deleted (guide §4); published projects keep
 *    their unit ids (feed-unit-ids-must-be-stable). */
import fs from "node:fs";
import { prisma } from "../src/lib/prisma.ts";
import { recomputeDevelopmentDerivedState } from "../src/lib/developmentDerivedState.ts";
import { recomputeDevelopmentDistances } from "../src/lib/developmentDistances.ts";

const file = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!file) { console.error("usage: giovani-sync.mjs <data.json> [--apply]"); process.exit(1); }
const data = JSON.parse(fs.readFileSync(file, "utf8"));

const m2 = (n) => (n == null ? null : `${Number(n)} m²`);
const problems = [];

function unitRow(p, u, i) {
  if (u.status === "available" && !u.price) problems.push(`${p.name} ${u.ref}: available without a price`);
  if (!["available", "reserved", "sold"].includes(u.status)) problems.push(`${p.name} ${u.ref}: status ${u.status}`);
  const attrs = [];
  if (u.total != null) attrs.push({ name: "Total area incl. verandas", value: m2(u.total) });
  if (u.roof != null) attrs.push({ name: "Roof garden", value: m2(u.roof) });
  if (u.basement != null) attrs.push({ name: "Basement", value: m2(u.basement) });
  if (u.storeys) attrs.push({ name: "Storeys", value: String(u.storeys) });
  if (u.pool) attrs.push({ name: "Private pool", value: u.pool });
  if (u.parking) attrs.push({ name: "Parking spaces", value: String(u.parking) });
  if (u.houseType) attrs.push({ name: "House type", value: u.houseType });
  if (u.block) attrs.push({ name: "Block", value: u.block });
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
const LOCALES = ["EN", "DE", "PL", "RU"];

try {
  const a = data.account;
  const acctBefore = await prisma.developerAccount.findUnique({ where: { slug: a.slug } });
  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${file}`);
  console.log(`account ${a.slug}: ${acctBefore ? "exists" : APPLY ? "CREATED" : "would be CREATED"}`);
  const hasUnits = data.projects.some((p) => p.units.length);
  const acctFields = { name: a.name, website: a.website, phone: a.phone, email: a.email, contactInfo: a.contactInfo, developerCloudUrl: a.developerCloudUrl, monthlyManualSync: true };
  const acct = APPLY
    ? await prisma.developerAccount.upsert({ where: { slug: a.slug }, update: acctFields, create: { slug: a.slug, ...acctFields, driveSyncInterval: "off" } })
    : acctBefore;

  for (const p of data.projects) {
    const feedKey = `manual:giovani-${p.slug}`;
    const rows = p.units.map((u, i) => unitRow(p, u, i));
    const prices = rows.filter((r) => r.status !== "sold" && r.price).map((r) => r.price);
    const avail = rows.filter((r) => r.status === "available").length;
    const existing = await prisma.development.findUnique({ where: { feedKey }, include: { units: true, override: true } });
    const published = existing?.publishStatus === "published";
    const facts = {
      category: p.category, stage: p.stage, completion: p.completion, energy: p.energy,
      district: p.district, town: p.town, area: p.area, amenities: p.amenities,
      latitude: p.latitude, longitude: p.longitude, driveFolderId: p.driveFolderId,
    };
    const counts = rows.length
      ? { priceFrom: prices.length ? Math.min(...prices) : null, priceTo: prices.length ? Math.max(...prices) : null, unitsTotal: rows.length, unitsAvailable: avail, syncedAt: new Date() }
      : {};

    console.log(`\n${p.name} (${feedKey}) — ${existing ? `exists, ${existing.publishStatus}` : "would be CREATED as draft"}; ${rows.length ? `${rows.length} units, ${avail} available, €${counts.priceFrom?.toLocaleString("en")}–${counts.priceTo?.toLocaleString("en")}` : "no price list yet — project only"}`);
    if (existing && !published) for (const [k, v] of Object.entries(facts)) if (!same(existing[k], v)) console.log(`  ${k}: ${JSON.stringify(existing[k])} → ${JSON.stringify(v)}`);
    if (published) console.log("  published — project facts frozen, units and prices only");

    const desc = {};
    for (const L of LOCALES) {
      const t = p.descriptions?.[L.toLowerCase()];
      if (t && !existing?.override?.[`description${L}`]) desc[`description${L}`] = t;
    }
    if (Object.keys(desc).length) console.log(`  description ${Object.keys(desc).map((k) => k.slice(-2)).join("/")} — ${APPLY ? "written" : "would be written"}`);

    const byRef = new Map((existing?.units ?? []).map((u) => [u.ref, u]));
    const plan = [];
    for (const r of rows) {
      const cur = byRef.get(r.ref);
      if (!cur) { plan.push({ kind: "create", r }); continue; }
      const diff = CMP.filter((k) => !same(cur[k], r[k]));
      if (diff.length) plan.push({ kind: "update", id: cur.id, r, diff: diff.map((k) => `${k} ${JSON.stringify(cur[k])}→${JSON.stringify(r[k])}`) });
    }
    const listed = new Set(rows.map((r) => r.ref));
    // An empty units[] means "no price list for this project yet", not "everything vanished".
    if (rows.length) for (const u of existing?.units ?? []) if (!listed.has(u.ref) && u.status !== "unlisted") plan.push({ kind: "unlist", id: u.id, r: u });
    for (const x of plan) console.log(`  ${x.kind.padEnd(6)} ${x.r.ref}${x.diff ? "  " + x.diff.join("; ") : x.kind === "create" ? `  ${x.r.type} ${x.r.beds}bd ${x.r.areaBuilt} ${x.r.status} ${x.r.price ?? ""}` : ""}`);
    if (rows.length && !plan.length) console.log("  units unchanged");

    if (!APPLY) continue;
    const dev = existing
      ? await prisma.development.update({ where: { id: existing.id }, data: { ...counts, ...(published ? {} : facts) } })
      : await prisma.development.create({
          data: {
            developerAccountId: acct.id, dev: "manual", feedProjectId: `giovani-${p.slug}`, feedKey,
            developerName: p.name, publicName: p.name, developer: acct.name, publishStatus: "draft",
            ...facts, ...counts,
          },
        });
    if (Object.keys(desc).length) {
      await prisma.developmentOverride.upsert({ where: { developmentId: dev.id }, update: desc, create: { developmentId: dev.id, ...desc } });
    }
    for (const x of plan) {
      if (x.kind === "create") await prisma.developmentUnit.create({ data: { developmentId: dev.id, ...x.r } });
      else if (x.kind === "update") await prisma.developmentUnit.update({ where: { id: x.id }, data: x.r });
      else await prisma.developmentUnit.update({ where: { id: x.id }, data: { status: "unlisted" } });
    }
    await recomputeDevelopmentDerivedState(dev.id);
    if (dev.latitude != null) await recomputeDevelopmentDistances(dev.id);
    console.log(`  written → /admin/developments/${dev.id}`);
  }

  if (problems.length) {
    console.log(`\n${problems.length} problem(s):`);
    for (const x of problems) console.log("  " + x);
    process.exitCode = 2;
  }
  if (APPLY && hasUnits && !problems.length) await prisma.developerAccount.update({ where: { id: acct.id }, data: { manualSyncedAt: new Date() } });
} finally {
  await prisma.$disconnect();
}
