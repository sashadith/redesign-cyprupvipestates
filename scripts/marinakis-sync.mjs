#!/usr/bin/env node
/* Marinakis Developers — manual sync (onboarded 2026-10-29).
 *
 *   node --import tsx --env-file=.env.local scripts/marinakis-sync.mjs scripts/data/marinakis/2026-10-29.json          # dry run
 *   node --import tsx --env-file=.env.local scripts/marinakis-sync.mjs scripts/data/marinakis/2026-10-29.json --apply  # write
 *
 * Source: ONE PDF, "Indicative Price List v35 / 13-10-2026", sent by the developer, plus
 * the promo material it links to (marinakisproperty.com/download/<slug>/). The PDF carries
 * no project names — they come from those links — and NO INVENTORY: per project it gives
 * only type rows (residence type, beds, price from, total covered) and feature bullets.
 *
 * So these projects have no DevelopmentUnit rows at all, and that is deliberate
 * (operator decision 2026-10-29, "Weg C"):
 *
 *  - Inventing one unit row per type row would be wrong twice over. The unit uuid IS
 *    Xellex's unit id ([[feed-unit-ids-must-be-stable]]), so the rows would have to be
 *    wiped and recreated the day a real list arrives; and "1 available" per type states
 *    an availability nobody has told us.
 *  - Instead the project-level priceFrom carries the developer's "from" price (the
 *    fallback branch of resolveDevelopmentPrice in src/lib/developmentCard.ts), category
 *    carries the type words so the propertyType filter can still reach the project
 *    (resolveDevelopmentType falls back to category), and the type rows are rendered as a
 *    localised tableBlock inside the promo block, with the price list's own date and
 *    "subject to confirmation" caveat next to them.
 *  - priceTo stays null on purpose. Every number in the list is a "from" price for its
 *    type, so a priceTo built from them would read as a range the developer never quoted.
 *
 * When the real price/availability list arrives: fill projects[].units in the data file
 * (same shape as scripts/data/giovani/*.json), drop the project-level priceFrom and the
 * types[] table, and re-run. Nothing in this script has to change.
 *
 * What it writes:
 *  - DeveloperAccount slug "marinakis" (no driveFolderUrl, so no Drive cron touches it;
 *    their gated Agent Hub sits in developerCloudUrl), monthlyManualSync = true.
 *  - One dev:"manual" Development per project, feedKey "manual:marinakis-<slug>", created
 *    as a DRAFT. Project facts are only (re)written while the project is NOT published
 *    (published = frozen content, FEED-ADAPTER-GUIDE §3).
 *  - DevelopmentOverride.description{EN,DE,PL,RU} and promoBlocks{EN,DE,PL,RU}, each
 *    written only where that field is still empty — an edited text is never overwritten.
 *    SEO meta is NOT written: the operator writes it by hand. HE is left alone. */
import fs from "node:fs";
import { prisma } from "../src/lib/prisma.ts";
import { htmlToPortableText } from "../src/lib/portableText/htmlToPt.mjs";
import { recomputeDevelopmentDerivedState } from "../src/lib/developmentDerivedState.ts";
import { recomputeDevelopmentDistances } from "../src/lib/developmentDistances.ts";

const file = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!file) { console.error("usage: marinakis-sync.mjs <data.json> [--apply]"); process.exit(1); }
const data = JSON.parse(fs.readFileSync(file, "utf8"));

const LOCALES = ["EN", "DE", "PL", "RU"];
const problems = [];
let keyN = 0;
const key = () => `mk${(keyN++).toString(36)}`;

/* The type table's own wording. Columns and the "from" prices are the only place a
   price appears at all — prose never carries one, so a stale figure can only ever sit
   in one block, next to the list version it came from. */
const TABLE = {
  EN: { cols: ["Residence type", "Bedrooms", "Indicative price from", "Total covered area"], vat: "+ VAT", locale: "en-GB" },
  DE: { cols: ["Wohnungstyp", "Schlafzimmer", "Richtpreis ab", "Gesamtfläche überdacht"], vat: "+ MwSt.", locale: "de-DE" },
  PL: { cols: ["Typ rezydencji", "Sypialnie", "Cena orientacyjna od", "Łączna powierzchnia kryta"], vat: "+ VAT", locale: "pl-PL" },
  RU: { cols: ["Тип резиденции", "Спальни", "Ориентировочная цена от", "Общая крытая площадь"], vat: "+ НДС", locale: "ru-RU" },
};

function money(n, L) {
  return new Intl.NumberFormat(TABLE[L].locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function typeTableBlock(p, L) {
  const t = TABLE[L];
  return {
    _type: "tableBlock",
    _key: key(),
    columns: t.cols,
    rows: p.types.map((ty) => ({
      _key: key(),
      _type: "tableRow",
      cells: [ty.label[L.toLowerCase()], String(ty.beds), `${money(ty.price, L)} ${t.vat}`, `${ty.covered} m²`],
    })),
  };
}

/* The long text is authored as HTML in the data file — the same HTML the admin's
   BlockEditor produces — and converted here by the admin's own converter, so the stored
   shape cannot drift from what the editor would have written. "<!--TABLE-->" marks where
   the type table goes; everything before and after it becomes one textContent item each. */
function promoBlocks(p, L) {
  const html = p.longHtml?.[L.toLowerCase()];
  if (!html) return null;
  const parts = html.split("<!--TABLE-->");
  if (parts.length !== 2) { problems.push(`${p.name} ${L}: long text needs exactly one <!--TABLE--> marker`); return null; }
  return [
    { _type: "textContent", _key: key(), content: htmlToPortableText(parts[0]) },
    typeTableBlock(p, L),
    { _type: "textContent", _key: key(), content: htmlToPortableText(parts[1]) },
  ];
}

const noSpaces = (html) => html.replace(/<[^>]+>/g, " ").replace(/<!--TABLE-->/g, "").replace(/\s+/g, "").length;

try {
  const a = data.account;
  const acctBefore = await prisma.developerAccount.findUnique({ where: { slug: a.slug } });
  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${file}`);
  console.log(`account ${a.slug}: ${acctBefore ? "exists" : APPLY ? "CREATED" : "would be CREATED"}`);
  const acctFields = {
    name: a.name, website: a.website, phone: a.phone, email: a.email,
    contactInfo: a.contactInfo, contactPerson: a.contactPerson, notes: a.notes,
    developerCloudUrl: a.developerCloudUrl, monthlyManualSync: true,
  };
  const acct = APPLY
    ? await prisma.developerAccount.upsert({ where: { slug: a.slug }, update: acctFields, create: { slug: a.slug, ...acctFields, driveSyncInterval: "off" } })
    : acctBefore;

  for (const p of data.projects) {
    const feedKey = `manual:marinakis-${p.slug}`;
    const existing = await prisma.development.findUnique({ where: { feedKey }, include: { units: true, override: true } });
    const published = existing?.publishStatus === "published";
    const facts = {
      category: p.category, stage: p.stage, completion: p.completion, energy: p.energy,
      district: p.district, town: p.town, area: p.area, amenities: p.amenities,
      latitude: p.latitude, longitude: p.longitude,
    };
    // No units: the developer's own "from" price is all we have, and priceTo must stay
    // null (see the header). The moment units[] is filled, they take over entirely.
    const rows = p.units ?? [];
    if (rows.length) problems.push(`${p.name}: units[] is not empty — this script has no unit writer yet, port giovani-sync.mjs's`);
    const counts = { priceFrom: p.priceFrom, priceTo: null, unitsTotal: 0, unitsAvailable: 0, syncedAt: new Date() };

    console.log(`\n${p.name} (${feedKey}) — ${existing ? `exists, ${existing.publishStatus}` : "would be CREATED as draft"}; no price list, project-level from €${p.priceFrom.toLocaleString("en")} + VAT, ${p.types.length} type row(s)`);
    if (existing && !published) for (const [k, v] of Object.entries(facts)) if (JSON.stringify(existing[k] ?? null) !== JSON.stringify(v ?? null)) console.log(`  ${k}: ${JSON.stringify(existing[k])} → ${JSON.stringify(v)}`);
    if (published) console.log("  published — project facts frozen, prices only");

    const ov = {};
    for (const L of LOCALES) {
      const d = p.descriptions?.[L.toLowerCase()];
      if (d && !existing?.override?.[`description${L}`]) ov[`description${L}`] = d;
      const blocks = promoBlocks(p, L);
      if (blocks && !existing?.override?.[`promoBlocks${L}`]) ov[`promoBlocks${L}`] = blocks;
      if (d && d.length < 900) problems.push(`${p.name} ${L}: short description is ${d.length} chars (checklist: ~1000–1500, three paragraphs)`);
      const h = p.longHtml?.[L.toLowerCase()];
      if (h && noSpaces(h) < 3000) problems.push(`${p.name} ${L}: long text is ${noSpaces(h)} chars excluding spaces (checklist: min 3000)`);
    }
    const wrote = Object.keys(ov);
    if (wrote.length) console.log(`  override ${wrote.join(", ")} — ${APPLY ? "written" : "would be written"}`);
    else console.log("  override: nothing to write (all fields already filled)");

    if (!APPLY) continue;
    const dev = existing
      ? await prisma.development.update({ where: { id: existing.id }, data: { ...counts, ...(published ? {} : facts) } })
      : await prisma.development.create({
          data: {
            developerAccountId: acct.id, dev: "manual", feedProjectId: `marinakis-${p.slug}`, feedKey,
            developerName: p.name, publicName: p.name, developer: acct.name, publishStatus: "draft",
            ...facts, ...counts,
          },
        });
    if (wrote.length) await prisma.developmentOverride.upsert({ where: { developmentId: dev.id }, update: ov, create: { developmentId: dev.id, ...ov } });
    await recomputeDevelopmentDerivedState(dev.id);
    if (dev.latitude != null) await recomputeDevelopmentDistances(dev.id);
    console.log(`  written → /admin/developments/${dev.id}`);
  }

  if (problems.length) {
    console.log(`\n${problems.length} problem(s):`);
    for (const x of problems) console.log("  " + x);
    process.exitCode = 2;
  }
  if (APPLY && !problems.length) await prisma.developerAccount.update({ where: { id: acct.id }, data: { manualSyncedAt: new Date() } });
} finally {
  await prisma.$disconnect();
}
