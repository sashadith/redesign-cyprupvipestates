#!/usr/bin/env node
/* Reiwa Development — manual monthly sync (2026-10-05).
 *
 *   node --import tsx --env-file=.env.local scripts/reiwa-sync.mjs scripts/data/reiwa/2026-10-05.json          # dry run
 *   node --import tsx --env-file=.env.local scripts/reiwa-sync.mjs scripts/data/reiwa/2026-10-05.json --apply  # write
 *
 * Why manual and not a Drive sync: Reiwa keeps one PDF price list per project
 * folder, and they are not machine-readable in the same way — Bronte's text is
 * drawn as vector outlines (no text layer at all, like Georgia 12's Block B photo),
 * Nova's is a normal text PDF, UNO's is a 30 MB designed brochure page. The data
 * file is transcribed from the rendered pages once a month instead; this script
 * is the idempotent writer for it.
 *
 * What it writes:
 *  - DeveloperAccount slug "reiwa" (no driveFolderUrl, so no Drive cron ever
 *    touches it; the folder link sits in developerCloudUrl) with
 *    manualSyncReminderDays → the Action Center's "sync due" item. --apply stamps
 *    driveSyncedAt, which clears it.
 *  - One dev:"manual" Development per project, feedKey "manual:reiwa-<slug>".
 *    Project facts are only (re)written while the project is NOT published —
 *    published = frozen content, same rule as every feed (FEED-ADAPTER-GUIDE §3).
 *  - Units as source:"manual", matched by ref. The view ("Sea View", "Pool View",
 *    …) goes into the unit's amenities: it renders as a chip on the unit card and
 *    crm_match_properties' amenity search finds it.
 *  - A unit that disappears from the price list becomes "unlisted", never "sold"
 *    and never deleted (guide §4: missing is not evidence of sold).
 *
 * Refs are block-qualified ("A101") wherever the developer repeats unit numbers
 * across blocks — Bronte has a 101 in blocks A, B and C. A bare "101" is exactly
 * the collision that let Georgia 12's Block A prices overwrite Block B. */
import fs from "node:fs";
import { prisma } from "../src/lib/prisma.ts";
import { recomputeDevelopmentDerivedState } from "../src/lib/developmentDerivedState.ts";
import { recomputeDevelopmentDistances } from "../src/lib/developmentDistances.ts";

const file = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!file) { console.error("usage: reiwa-sync.mjs <data.json> [--apply]"); process.exit(1); }
const data = JSON.parse(fs.readFileSync(file, "utf8"));

const m2 = (n) => (n == null ? null : `${Number(n)} m²`);
const problems = [];

function unitRow(p, u, i) {
  // The price list's own total is the check on the transcription: internal +
  // covered veranda must give "Total Covered" (Nova's penthouses have no covered
  // veranda, so internal alone must). Anything else is a misread cell.
  const sum = Math.round(((u.internal ?? 0) + (u.veranda ?? 0)) * 100) / 100;
  if (u.total != null && Math.abs(sum - u.total) > 0.6) problems.push(`${p.name} ${u.ref}: internal ${u.internal} + veranda ${u.veranda ?? 0} = ${sum}, list says ${u.total}`);
  if (u.status === "available" && !u.price) problems.push(`${p.name} ${u.ref}: available without a price`);
  const attrs = [];
  if (u.total != null) attrs.push({ name: "Total covered area", value: m2(u.total) });
  if (u.rooftop != null) attrs.push({ name: "Private roof terrace", value: m2(u.rooftop) });
  return {
    ref: u.ref,
    label: u.block ? `Block ${u.block} · ${u.ref.slice(u.block.length)}` : null,
    type: u.type,
    status: u.status,
    price: u.price ?? null,
    beds: String(u.beds),
    baths: String(u.baths),
    areaBuilt: m2(u.internal),
    areaInternal: m2(u.internal),
    areaVeranda: m2(u.veranda),
    areaVerandaOpen: m2(u.terrace),
    floor: u.floor,
    attrs,
    amenities: u.view ? [u.view] : [],
    source: "manual",
    sortIndex: i,
  };
}

const CMP = ["label", "type", "status", "price", "beds", "baths", "areaBuilt", "areaInternal", "areaVeranda", "areaVerandaOpen", "floor", "attrs", "amenities", "source", "sortIndex"];
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
    const feedKey = `manual:reiwa-${p.slug}`;
    const rows = p.units.map((u, i) => unitRow(p, u, i));
    const prices = rows.filter((r) => r.status !== "sold" && r.price).map((r) => r.price);
    const avail = rows.filter((r) => r.status === "available").length;
    const existing = await prisma.development.findUnique({ where: { feedKey }, include: { units: true } });
    const published = existing?.publishStatus === "published";
    const facts = {
      category: p.category, stage: p.stage, completion: p.completion, energy: p.energy,
      district: p.district, area: p.area, latitude: p.latitude, longitude: p.longitude, amenities: p.amenities,
    };
    const counts = { priceFrom: prices.length ? Math.min(...prices) : null, priceTo: prices.length ? Math.max(...prices) : null, unitsTotal: rows.length, unitsAvailable: avail, syncedAt: new Date() };

    console.log(`\n${p.name} (${feedKey}) — ${existing ? `exists, ${existing.publishStatus}` : "would be CREATED as draft"}; ${rows.length} units, ${avail} available, €${counts.priceFrom?.toLocaleString("en")}–${counts.priceTo?.toLocaleString("en")}`);
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
    for (const x of plan) console.log(`  ${x.kind.padEnd(6)} ${x.r.ref}${x.diff ? "  " + x.diff.join("; ") : x.kind === "create" ? `  ${x.r.type} ${x.r.beds}bd ${x.r.areaBuilt} ${x.r.amenities.join("") || ""} ${x.r.status} ${x.r.price ?? ""}` : ""}`);
    if (!plan.length) console.log("  units unchanged");

    if (!APPLY) continue;
    const dev = existing
      ? await prisma.development.update({ where: { id: existing.id }, data: { ...counts, ...(published ? {} : facts) } })
      : await prisma.development.create({
          data: {
            developerAccountId: acct.id, dev: "manual", feedProjectId: `reiwa-${p.slug}`, feedKey,
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
    await recomputeDevelopmentDistances(dev.id);
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
