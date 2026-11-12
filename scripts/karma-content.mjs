#!/usr/bin/env node
/* Karma Developers — 4-language project descriptions (2026-11-12).
 *
 *   node --import tsx --env-file=.env.local scripts/karma-content.mjs scripts/data/karma/content          # dry run
 *   node --import tsx --env-file=.env.local scripts/karma-content.mjs scripts/data/karma/content --apply  # write
 *
 * Each draft is <slug>.json with { slug, name, short: { en, de, pl, ru } }, three paragraphs
 * per language separated by a blank line.
 *
 * Writes ONLY descriptionEN/DE/PL/RU on DevelopmentOverride. Deliberately NOT promoBlocks and
 * NOT seo: under the standing split (2026-10-31) the short description is ours and the long
 * SEO copy is Alex's, and DTA — where the same author wrote both — was an explicit exception,
 * not the rule. Writing an empty promoBlocks here would overwrite his work on a re-run.
 *
 * Nothing on Development itself is touched, and a published project is reported but skipped:
 * published means frozen content. */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma.ts";

const dir = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!dir) { console.error("usage: karma-content.mjs <dir-of-drafts> [--apply]"); process.exit(1); }
const LANGS = { en: "EN", de: "DE", pl: "PL", ru: "RU" };

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${files.length} drafts from ${dir}`);
let problems = 0;
try {
  for (const f of files) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const feedKey = `manual:karma-${d.slug}`;
    const dev = await prisma.development.findUnique({
      where: { feedKey },
      select: { id: true, publicName: true, publishStatus: true, override: { select: { id: true } } },
    });
    if (!dev) { console.log(`\n${d.slug}: no development ${feedKey} — run karma-sync.mjs --apply first`); problems++; continue; }

    const data = {};
    const report = [];
    for (const [l, L] of Object.entries(LANGS)) {
      const text = (d.short?.[l] ?? "").trim();
      // Every language has to be present and shaped the same way: a missing or one-paragraph
      // translation is the failure mode that silently ships an English page to a Polish reader.
      if (!text) throw new Error(`${d.slug} ${L}: no short description`);
      const paras = text.split(/\n\s*\n/).filter(Boolean);
      if (paras.length < 2) throw new Error(`${d.slug} ${L}: ${paras.length} paragraph(s) — expected the usual three`);
      data[`description${L}`] = text;
      report.push(`${L} ${paras.length}¶ ${text.length}c`);
    }
    console.log(`\n${dev.publicName} (${dev.publishStatus}${dev.override ? ", override exists" : ", no override yet"}) — ${report.join(" | ")}`);
    if (dev.publishStatus === "published") { console.log("  published — content frozen, skipped"); continue; }
    if (!APPLY) continue;
    await prisma.developmentOverride.upsert({
      where: { developmentId: dev.id },
      update: data,                       // promoBlocks and seo deliberately absent: Alex owns them
      create: { developmentId: dev.id, ...data },
    });
    console.log(`  written → /admin/developments/${dev.id}`);
  }
  if (problems) console.log(`\n${problems} draft(s) had no development yet`);
} finally {
  await prisma.$disconnect();
}
