#!/usr/bin/env node
/* Patroclos Group — short descriptions (EN/DE/PL/RU) for the manual drafts (2026-11-04).
 *
 *   node --import tsx --env-file=.env.local scripts/patroclos-descriptions.mjs <dir with <slug>.json>          # dry run
 *   node --import tsx --env-file=.env.local scripts/patroclos-descriptions.mjs <dir with <slug>.json> --apply  # write
 *
 * Each file is { slug, EN, DE, PL, RU }, three paragraphs separated by "\n". Descriptions are
 * ours; the long promo blocks and the seo meta are Alex's (operator, 2026-10-31), so this
 * writes descriptionEN/DE/PL/RU and nothing else — never HE, never promoBlocks, never seo.
 * Rows are matched by feedKey (drafts have no slug) and only drafts are touched; a field
 * that already holds text is left alone unless --force is given. */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma.ts";

const dir = process.argv[2];
const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");
if (!dir) { console.error("usage: patroclos-descriptions.mjs <dir> [--apply] [--force]"); process.exit(1); }
const LANGS = ["EN", "DE", "PL", "RU"];

try {
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const feedKey = `manual:patroclos-${d.slug}`;
    const dev = await prisma.development.findUnique({ where: { feedKey }, select: { id: true, publishStatus: true, override: true } });
    if (!dev) { console.log(`${d.slug}: no development ${feedKey}`); continue; }
    if (dev.publishStatus !== "draft") { console.log(`${d.slug}: ${dev.publishStatus} — skipped`); continue; }
    const data = {};
    for (const L of LANGS) {
      const t = (d[L] ?? "").trim();
      if (t.length < 1000 || t.length > 1500) throw new Error(`${d.slug} ${L}: ${t.length} chars, outside 1000-1500`);
      const cur = dev.override?.[`description${L}`];
      if (cur && cur.trim() && !FORCE) { console.log(`  ${d.slug} ${L}: has text, kept`); continue; }
      data[`description${L}`] = t;
    }
    console.log(`${d.slug}: ${Object.keys(data).join(", ") || "nothing to write"}`);
    if (!APPLY || !Object.keys(data).length) continue;
    await prisma.developmentOverride.upsert({ where: { developmentId: dev.id }, update: data, create: { developmentId: dev.id, ...data } });
    const back = await prisma.developmentOverride.findUnique({ where: { developmentId: dev.id } });
    for (const [k, v] of Object.entries(data)) if (back[k] !== v) throw new Error(`${d.slug} ${k}: read-back differs`);
  }
} finally {
  await prisma.$disconnect();
}
