#!/usr/bin/env node
/* Karma Developers — manual monthly sync (2026-11-12).
 *
 *   node --import tsx --env-file=.env.local scripts/karma-sync.mjs scripts/data/karma/2026-11-12.json          # dry run
 *   node --import tsx --env-file=.env.local scripts/karma-sync.mjs scripts/data/karma/2026-11-12.json --apply  # write
 *
 * Why manual: Karma share one anonymous SharePoint folder (renders, plans, specs, presentations,
 * one subfolder per project) but NO price list in it. Units come from their "MASTER PRICELIST –
 * CURRENT PROJECTS" PDF, which the operator receives directly. The share is a bearer credential,
 * so it is never committed — pass it once as KARMA_CLOUD_URL (or set it in the admin) and it lands
 * in DeveloperAccount.developerCloudUrl. A run without it leaves whatever is stored untouched.
 *
 * The master list carries ONLY units that are for sale right now: no sold or reserved rows. So
 * every listed unit is "available", a project's unit count is its for-sale count, and a unit that
 * drops off a later list becomes "unlisted" (never "sold", never deleted — its id stays stable).
 * When a whole project drops off, all its units go unlisted and the project reads sold out.
 *
 * Areas: areaInternal/areaBuilt carry the INTERNAL figure, areaVeranda the covered verandas and
 * areaVerandaOpen the uncovered ones, so the page's Covered Area (internal + covered verandas)
 * reproduces the list. The list's "Total buildable area" goes into attrs. Check: for every row
 * where the parts are given, internal + covered + uncovered must equal that total. Two seafront
 * rows (Semera H02, Ionion H07) do not add up on the list itself and are exempt by name.
 *
 * Units are source:"manual", matched by ref. Project facts are only (re)written while the
 * project is NOT published — published means frozen content. */
import fs from "node:fs";
import { prisma } from "../src/lib/prisma.ts";
import { recomputeDevelopmentDerivedState } from "../src/lib/developmentDerivedState.ts";
import { recomputeDevelopmentDistances } from "../src/lib/developmentDistances.ts";

const file = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!file) { console.error("usage: karma-sync.mjs <data.json> [--apply]"); process.exit(1); }
const data = JSON.parse(fs.readFileSync(file, "utf8"));

const m2 = (n) => (n == null ? null : `${Number(n)} m²`);
const round2 = (n) => Math.round(n * 100) / 100;
const problems = [];

// Rows whose own list figures don't add up (internal + verandas != total buildable) — the
// seafront villas count basements/roof areas into the total that the list doesn't break out.
// Malama Seafront C04's total (358) is internal + verandas + lower level (330) PLUS its 28 m²
// roof garden, while on the master list roof gardens sit outside the total (Narine H07/H08).
const TOTAL_EXEMPT = new Set(["semera-beachfront:H02", "ionion-seafront-villas:H07", "malama-seafront-c:C04"]);

function unitRow(p, u, i) {
  if (u.total != null && !TOTAL_EXEMPT.has(`${p.slug}:${u.ref}`)) {
    const sum = round2((u.internal ?? 0) + (u.veranda ?? 0) + (u.terrace ?? 0) + (u.lowerLevel ?? 0));
    if (Math.abs(sum - u.total) > 0.11) problems.push(`${p.name} ${u.ref}: internal+verandas = ${sum}, list says ${u.total} total`);
  }
  if (u.status !== "available") problems.push(`${p.name} ${u.ref}: status ${u.status} — the master list only carries units for sale`);
  if (!u.price) problems.push(`${p.name} ${u.ref}: no price`);
  if (!["Apartment", "Villa"].includes(u.type)) problems.push(`${p.name} ${u.ref}: type ${u.type}`);

  const attrs = [];
  if (u.plan) attrs.push({ name: "Plan type", value: u.plan });
  if (u.listType && !/^(apartment|detached villa)$/i.test(u.listType)) attrs.push({ name: "Category on the price list", value: u.listType });
  if (u.lowerLevel != null) attrs.push({ name: "Lower level", value: m2(u.lowerLevel) });
  if (u.roofGarden != null) attrs.push({ name: "Roof garden", value: m2(u.roofGarden) });
  if (u.roofGardenOptional) attrs.push({ name: "Roof garden", value: "optional" });
  if (u.parking) attrs.push({ name: "Parking", value: u.parking });
  if (u.pool) attrs.push({ name: "Swimming pool", value: u.pool === "Communal" ? "Communal" : `Private, ${u.pool.toLowerCase()}` });
  if (u.total != null) attrs.push({ name: "Total buildable area as listed by the developer", value: m2(u.total) });
  if (u.furnished) attrs.push({ name: "Furniture", value: "sold fully furnished" });
  attrs.push({ name: "VAT", value: "not included, charged on top" });
  if (u.note) attrs.push({ name: "Note", value: u.note });

  return {
    ref: u.ref,
    label: null,
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
    storage: null,
    guestWc: null,
    attrs,
    amenities: [],
    source: "manual",
    sortIndex: i,
  };
}

const CMP = ["label", "type", "status", "price", "beds", "baths", "areaBuilt", "areaPlot", "areaInternal", "areaVeranda", "areaVerandaOpen", "floor", "storage", "attrs", "amenities", "source", "sortIndex"];
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

try {
  const a = data.account;
  const acctBefore = await prisma.developerAccount.findUnique({ where: { slug: a.slug } });
  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${file}`);
  console.log(`account ${a.slug}: ${acctBefore ? "exists" : APPLY ? "CREATED" : "would be CREATED"}`);
  // The share link is a bearer credential and is never committed, so it arrives by env var.
  // Absent, we leave whatever is stored alone: a plain re-run must not wipe the link the
  // operator pasted into the admin, which would silently cut the next sync off from its source.
  const cloudUrl = process.env.KARMA_CLOUD_URL || a.developerCloudUrl || null;
  if (!cloudUrl && !acctBefore?.developerCloudUrl) console.log("  note: no developerCloudUrl set — pass KARMA_CLOUD_URL or paste the share link in the admin");
  const acctFields = { name: a.name, website: a.website, phone: a.phone, email: a.email, contactPerson: a.contactPerson, contactInfo: a.contactInfo, notes: a.notes, manualSyncReminderDays: a.manualSyncReminderDays, ...(cloudUrl ? { developerCloudUrl: cloudUrl } : {}) };
  const acct = APPLY
    ? await prisma.developerAccount.upsert({ where: { slug: a.slug }, update: acctFields, create: { slug: a.slug, ...acctFields, driveSyncInterval: "off" } })
    : acctBefore;

  for (const p of data.projects) {
    const feedKey = `manual:karma-${p.slug}`;
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
    // A project can legitimately have no units at all (a project with no list rows), so the
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
            developerAccountId: acct.id, dev: "manual", feedProjectId: `karma-${p.slug}`, feedKey,
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
