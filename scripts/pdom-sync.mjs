#!/usr/bin/env node
/* PDOM Developers — manual monthly sync (2026-11-05).
 *
 *   node --import tsx --env-file=.env.local scripts/pdom-sync.mjs scripts/data/pdom/2026-11-05.json          # dry run
 *   node --import tsx --env-file=.env.local scripts/pdom-sync.mjs scripts/data/pdom/2026-11-05.json --apply  # write
 *
 * Why manual: PDOM share one anonymous SharePoint folder, one subfolder per project. Two of
 * the three carry a real per-unit price list as a PDF; nothing a feed or the Drive cron can
 * read. The share is a bearer credential, so it is never committed — pass it once as
 * PDOM_CLOUD_URL (or set it in the admin) and it lands in DeveloperAccount.developerCloudUrl.
 * A run without it leaves whatever is already stored untouched, and never clears it.
 *
 * Scope and every source conflict are written out in the data file's account notes. In short:
 * AZUR and NOVA get real units; THE MEADOWS is a draft with NO units because the only document
 * for it is an unapproved design concept; Nerida Residences and the two Tala villas are out.
 *
 * Areas: areaInternal/areaBuilt both carry the PURE interior figure, so the page's Covered Area
 * (areaInternal + areaVeranda) reproduces the list's covered figure instead of double-counting.
 * The developer's own "Total built area" column is internal + covered terraces + green zone +
 * installations area; it goes into attrs, never into an area field. Roof terraces sit OUTSIDE
 * that total, which is why they are not in PARTS below — the per-row sum is the only check that
 * the transcription is right, so it has to mirror the list's own arithmetic exactly.
 *
 * Units are source:"manual", matched by ref. A unit that disappears from a list becomes
 * "unlisted", never "sold" and never deleted, and ids are never recycled. Project facts are
 * only (re)written while the project is NOT published — published means frozen content. */
import fs from "node:fs";
import { prisma } from "../src/lib/prisma.ts";
import { recomputeDevelopmentDerivedState } from "../src/lib/developmentDerivedState.ts";
import { recomputeDevelopmentDistances } from "../src/lib/developmentDistances.ts";

const file = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!file) { console.error("usage: pdom-sync.mjs <data.json> [--apply]"); process.exit(1); }
const data = JSON.parse(fs.readFileSync(file, "utf8"));

const m2 = (n) => (n == null ? null : `${Number(n)} m²`);
const round2 = (n) => Math.round(n * 100) / 100;
const problems = [];

function unitRow(p, u, i) {
  // The list's own "Total built area" column is the check on the transcription: every row has
  // to add back up to it out of exactly these four parts. Roof terraces are deliberately NOT
  // among them — the developer counts them outside the total.
  const PARTS = ["internal", "veranda", "greenZone", "installations"];
  if (u.total != null) {
    const sum = round2(PARTS.reduce((t, k) => t + (u[k] ?? 0), 0));
    if (Math.abs(sum - u.total) > 0.11) problems.push(`${p.name} ${u.ref}: ${PARTS.filter((k) => u[k] != null).join("+")} = ${sum}, list says ${u.total} total`);
  }
  if (u.status === "available" && !u.price) problems.push(`${p.name} ${u.ref}: available without a price`);
  if (u.status !== "available" && u.price) problems.push(`${p.name} ${u.ref}: ${u.status} but carries a price`);
  if (!["available", "reserved", "sold"].includes(u.status)) problems.push(`${p.name} ${u.ref}: status ${u.status}`);

  const attrs = [];
  if (u.ensuite) attrs.push({ name: "En-suite bathrooms", value: String(u.ensuite) });
  if (u.roofTerrace != null) attrs.push({ name: "Roof terrace", value: m2(u.roofTerrace) });
  if (u.greenZone != null) attrs.push({ name: "Green zone", value: m2(u.greenZone) });
  if (u.installations != null) attrs.push({ name: "Installations area", value: m2(u.installations) });
  if (u.view) attrs.push({ name: "View", value: u.view });
  if (u.storage != null) attrs.push({ name: "Storage room", value: m2(u.storage) });
  if (u.parking != null) attrs.push({ name: "Parking spaces", value: String(u.parking) });
  if (u.total != null) attrs.push({ name: "Total built area as listed by the developer", value: m2(u.total) });
  attrs.push({ name: "VAT", value: "not included, charged on top" });
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

const CMP = ["label", "type", "status", "price", "beds", "areaBuilt", "areaInternal", "areaVeranda", "areaVerandaOpen", "floor", "storage", "attrs", "amenities", "source", "sortIndex"];
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

try {
  const a = data.account;
  const acctBefore = await prisma.developerAccount.findUnique({ where: { slug: a.slug } });
  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${file}`);
  console.log(`account ${a.slug}: ${acctBefore ? "exists" : APPLY ? "CREATED" : "would be CREATED"}`);
  // The share link is a bearer credential and is never committed, so it arrives by env var.
  // Absent, we leave whatever is stored alone: a plain re-run must not wipe the link the
  // operator pasted into the admin, which would silently cut the next sync off from its source.
  const cloudUrl = process.env.PDOM_CLOUD_URL || a.developerCloudUrl || null;
  if (!cloudUrl && !acctBefore?.developerCloudUrl) console.log("  note: no developerCloudUrl set — pass PDOM_CLOUD_URL or paste the share link in the admin");
  const acctFields = { name: a.name, website: a.website, phone: a.phone, email: a.email, contactPerson: a.contactPerson, contactInfo: a.contactInfo, notes: a.notes, manualSyncReminderDays: a.manualSyncReminderDays, ...(cloudUrl ? { developerCloudUrl: cloudUrl } : {}) };
  const acct = APPLY
    ? await prisma.developerAccount.upsert({ where: { slug: a.slug }, update: acctFields, create: { slug: a.slug, ...acctFields, driveSyncInterval: "off" } })
    : acctBefore;

  for (const p of data.projects) {
    const feedKey = `manual:pdom-${p.slug}`;
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
    // A project can legitimately have no units at all (THE MEADOWS has no price list), so the
    // price range is only printed when there is one — otherwise it reads "€undefined–undefined".
    const range = prices.length ? `, €${counts.priceFrom.toLocaleString("en")}–${counts.priceTo.toLocaleString("en")}` : ", no prices";
    console.log(`\n${p.name} (${feedKey}) — ${state}; ${rows.length} units, ${avail} available${range}`);
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
            developerAccountId: acct.id, dev: "manual", feedProjectId: `pdom-${p.slug}`, feedKey,
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
