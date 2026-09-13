#!/usr/bin/env node
// ============================================================================
// READ-ONLY EXPORT — production database
// ============================================================================
// Hebrew localization Phase 5, Task 1. Snapshots the English content that the
// Hebrew content pack (content/he/**) is translated FROM, so Pass A/B
// translation agents (and this repo's own gates) have a stable, versioned
// source to diff against instead of a moving DB row.
//
// This script only ever calls findMany / findUnique / count / groupBy. It
// NEVER writes a row, and it never runs raw SQL —
// scripts/qa/__tests__/he-content.test.mjs greps this exact file's source for
// the mutating Prisma call shapes and the raw-SQL helpers as a static guard,
// on top of this being true by construction.
//
// The local DATABASE_URL IS the production database (see this repo's "Local
// DB is production" note) — run this ONCE, from the controller, as a
// declared production read. Never run it from inside an implementer task.
//
// Usage:
//   node scripts/he-content/export-en.mjs [--out content/he/source]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const SITE_DOCUMENT_TYPES = ["homepage", "header", "footer", "notFoundPage", "projectsPage", "blogPage", "caseStudiesPage", "formStandardDocument"];

// Keyword-map landing-page slugs (docs/i18n/he-keyword-map.md §4, "Slug"
// column, minus the /he/ prefix). Only used to look up an EN Singlepage
// counterpart, if one exists — most of these pages have NO English
// equivalent and are authored fresh in Hebrew; he-content-check.mjs already
// knows to skip mirrorCheck for a pack file with no matching source.
const KEYWORD_MAP_SLUGS = [
  "real-estate-cyprus",
  "apartments-for-sale-cyprus",
  "property-investment-cyprus",
  "property-prices-cyprus",
  "limassol",
  "limassol/new-projects",
  "paphos",
  "paphos/apartments",
  "paphos/villas",
  "villas-cyprus",
  "seafront-villas-cyprus",
  "houses-for-sale-cyprus",
  "buying-property-in-cyprus",
  "relocation-cyprus",
  "permanent-residency-cyprus",
  "property-tax-cyprus",
  "limassol/investment-apartments",
];

function parseArgs(argv) {
  let out = path.join(ROOT, "content", "he", "source");
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out" && argv[i + 1]) out = path.resolve(ROOT, argv[++i]);
  }
  return { out };
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`  wrote ${path.relative(ROOT, file)}`);
}

async function exportSiteDocuments(prisma, outDir) {
  console.log("Exporting site-documents…");
  const rows = await prisma.siteDocument.findMany({ where: { language: "en", type: { in: SITE_DOCUMENT_TYPES } } });
  const byType = new Map(rows.map((r) => [r.type, r]));
  for (const type of SITE_DOCUMENT_TYPES) {
    const row = byType.get(type);
    if (!row) {
      console.log(`  (skip) no EN "${type}" site document`);
      continue;
    }
    writeJson(path.join(outDir, "site-documents", `${type}.en.json`), row.data);
  }
}

async function exportCaseStudies(prisma, outDir) {
  console.log("Exporting case-studies…");
  const rows = await prisma.caseStudy.findMany({
    where: { language: "en", status: "PUBLISHED" },
    include: { relatedProjects: { include: { project: true } } },
  });
  for (const row of rows) {
    const data = {
      slug: row.slug,
      title: row.title,
      fullTitle: row.fullTitle,
      excerpt: row.excerpt,
      category: row.category,
      seo: row.seo,
      clientOverview: row.clientOverview,
      caseDetails: row.caseDetails,
      mainContent: row.mainContent,
      relatedProjects: row.relatedProjects.map((rp) => rp.project?.slug).filter(Boolean),
    };
    writeJson(path.join(outDir, "case-studies", `${row.slug}.en.json`), data);
  }
  console.log(`  ${rows.length} case-study row(s)`);
}

async function exportSinglepages(prisma, outDir) {
  console.log("Exporting singlepages…");
  const wantedSlugs = Array.from(new Set(["about-us", "contacts", ...KEYWORD_MAP_SLUGS]));
  const rows = await prisma.singlepage.findMany({
    where: { language: "en", status: "PUBLISHED", slug: { in: wantedSlugs } },
  });
  const foundSlugs = new Set();
  for (const row of rows) {
    foundSlugs.add(row.slug);
    const data = {
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      allowIntroBlock: row.allowIntroBlock,
      previewImage: row.previewImage,
      seo: row.seo,
      contentBlocks: row.contentBlocks,
      relatedLandingPages: row.relatedLandingPages,
    };
    writeJson(path.join(outDir, "singlepages", `${row.slug.replace(/\//g, "-")}.en.json`), data);
  }
  for (const slug of wantedSlugs) {
    if (!foundSlugs.has(slug)) console.log(`  (no EN source) "${slug}" — will be authored fresh in Hebrew`);
  }
}

// Structural references only: published EN landing pages (the slugs the
// 2025 landing import created, scripts/landings.csv) so authors of the fresh
// Hebrew landing pages can mirror the real block shapes. Never mirrored by
// he-content-check (no Hebrew counterpart lives under reference/).
const REFERENCE_SINGLEPAGES = [
  "new-homes-in-cyprus-for-sale",
  "beach-villas-for-sale-cyprus",
  "homes-for-sale-in-limassol",
  "2-bedroom-apartments-for-sale-limassol",
  "2-bedroom-apartments-in-paphos",
  "west-coast-properties-paphos",
];

async function exportReferenceSinglepages(prisma, outDir) {
  console.log("Exporting reference landing pages…");
  const rows = await prisma.singlepage.findMany({
    where: { language: "en", status: "PUBLISHED", slug: { in: REFERENCE_SINGLEPAGES } },
  });
  for (const row of rows) {
    const data = {
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      allowIntroBlock: row.allowIntroBlock,
      previewImage: row.previewImage,
      seo: row.seo,
      contentBlocks: row.contentBlocks,
      relatedLandingPages: row.relatedLandingPages,
    };
    writeJson(path.join(outDir, "reference", `${row.slug}.en.json`), data);
  }
  console.log(`  ${rows.length} reference page(s)`);
}

async function exportDevelopers(prisma, outDir) {
  console.log("Exporting developers…");
  const rows = await prisma.developer.findMany({ where: { language: "en" } });
  const data = rows.map((r) => ({ id: r.id, slug: r.slug, title: r.title, excerpt: r.excerpt, seo: r.seo, description: r.description }));
  writeJson(path.join(outDir, "developers.en.json"), data);
  console.log(`  ${data.length} developer row(s)`);
}

// Per (town, district): count of PUBLISHED developments, the categories
// present, and the min/max of each development's resolved "price from"
// (override → live available units → any-status units → the stored
// Development.priceFrom fallback — the same precedence
// src/lib/developmentCard.ts's resolveDevelopmentPrice uses for the public
// site, reimplemented here read-only since this script cannot import a .ts
// module). Used ONLY as a fact-check basis for landing-page authors — never
// copied verbatim as digits into evergreen Hebrew prose (Global Constraints,
// "No invented facts").
function resolveDevelopmentPriceFrom(dev) {
  const advertisable = (n) => typeof n === "number" && n > 0;
  const availablePrices = dev.units.filter((u) => u.status === "available" && advertisable(u.price)).map((u) => u.price);
  const anyPrices = dev.units.filter((u) => advertisable(u.price)).map((u) => u.price);
  const pool = availablePrices.length ? availablePrices : anyPrices;
  if (pool.length) return Math.min(...pool);
  return advertisable(dev.priceFrom) ? dev.priceFrom : null;
}

async function exportInventory(prisma, outDir) {
  console.log("Exporting inventory…");
  const developments = await prisma.development.findMany({
    where: { publishStatus: "published" },
    // Explicit selects: the local Prisma client already knows Phase-1 columns
    // (descriptionHE) that the shared DB only gains once the operator applies the
    // migration — a bare `override: true` would select them and fail (P2022).
    include: { override: { select: { town: true, district: true } }, units: { select: { status: true, price: true } } },
  });

  const buckets = new Map(); // `${town}||${district}` -> accumulator
  for (const d of developments) {
    const town = d.override?.town || d.town || null;
    const district = d.override?.district || d.district || null;
    const key = `${town ?? ""}||${district ?? ""}`;
    if (!buckets.has(key)) buckets.set(key, { town, district, publishedDevelopments: 0, types: new Set(), prices: [] });
    const bucket = buckets.get(key);
    bucket.publishedDevelopments++;
    if (d.category) bucket.types.add(d.category);
    const priceFrom = resolveDevelopmentPriceFrom(d);
    if (priceFrom != null) bucket.prices.push(priceFrom);
  }

  const inventory = Array.from(buckets.values())
    .map((b) => ({
      town: b.town,
      district: b.district,
      publishedDevelopments: b.publishedDevelopments,
      types: Array.from(b.types).sort(),
      priceFromMin: b.prices.length ? Math.min(...b.prices) : null,
      priceFromMax: b.prices.length ? Math.max(...b.prices) : null,
    }))
    .sort((a, b) => (a.district || "").localeCompare(b.district || "") || (a.town || "").localeCompare(b.town || ""));

  writeJson(path.join(outDir, "inventory.json"), inventory);
  console.log(`  ${inventory.length} town/district bucket(s) across ${developments.length} published development(s)`);
}

async function main() {
  console.log("================================================================");
  console.log(" READ-ONLY EXPORT — production database");
  console.log(" Only findMany/findUnique/count/groupBy calls below. No writes.");
  console.log("================================================================");

  const { out } = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    await exportSiteDocuments(prisma, out);
    await exportCaseStudies(prisma, out);
    await exportSinglepages(prisma, out);
    await exportReferenceSinglepages(prisma, out);
    await exportDevelopers(prisma, out);
    await exportInventory(prisma, out);
    console.log("\nDone — this was a READ-ONLY export; nothing was written to the database.");
  } finally {
    await prisma.$disconnect();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
