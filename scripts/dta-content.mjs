#!/usr/bin/env node
/* DTA Group — 4-language project copy (2026-10-29).
 *
 *   node --import tsx --env-file=.env.local scripts/dta-content.mjs <dir-of-drafts>          # dry run
 *   node --import tsx --env-file=.env.local scripts/dta-content.mjs <dir-of-drafts> --apply  # write
 *
 * Each draft is <slug>.json with { slug, name, short: {en,de,pl,ru}, long: {en,de,pl,ru} }.
 * The short description is three paragraphs separated by a blank line. The long text is
 * Markdown restricted to "## heading", paragraphs, "- " bullets and one GFM-style pipe
 * table; the first table row is the header.
 *
 * Writes ONLY descriptionEN/DE/PL/RU and promoBlocksEN/DE/PL/RU on DevelopmentOverride.
 * It never touches `seo` — the operator writes meta titles and descriptions by hand, as
 * for Marinakis — and never touches anything on Development itself.
 *
 * promoBlocks shape, which is easy to get wrong: the column is NOT a flat Portable Text
 * array. It is an array of top-level ITEMS, each rendered by renderInsightsBlock, so prose
 * has to be wrapped in { _type: "textContent", _key, content: [...blocks] } and a table is
 * its own { _type: "tableBlock", _key, columns, rows } item alongside it. A bare block
 * array writes successfully and renders nothing. */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma.ts";

const dir = process.argv[2];
const APPLY = process.argv.includes("--apply");
if (!dir) { console.error("usage: dta-content.mjs <dir-of-drafts> [--apply]"); process.exit(1); }

const key = () => randomUUID().slice(0, 8);
const LANGS = { en: "EN", de: "DE", pl: "PL", ru: "RU" };

const block = (text, style = "normal") => ({
  _type: "block", _key: key(), style,
  markDefs: [], children: [{ _type: "span", _key: key(), text, marks: [] }],
});
const bullet = (text) => ({ ...block(text), listItem: "bullet", level: 1 });

/** Markdown (the restricted subset above) → promoBlocks items. */
function toPromoBlocks(md) {
  const items = [];
  let prose = [];
  const flush = () => {
    if (prose.length) items.push({ _type: "textContent", _key: key(), content: prose });
    prose = [];
  };
  const lines = md.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith("## ")) { prose.push(block(line.slice(3).trim(), "h2")); continue; }
    if (line.startsWith("- ")) { prose.push(bullet(line.slice(2).trim())); continue; }
    if (line.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
        i++;
      }
      i--;
      flush();
      items.push({
        _type: "tableBlock", _key: key(), columns: rows[0],
        rows: rows.slice(1).map((cells) => ({ _key: key(), _type: "tableRow", cells })),
      });
      continue;
    }
    prose.push(block(line));
  }
  flush();
  return items;
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${files.length} drafts from ${dir}`);
try {
  for (const f of files) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const feedKey = `manual:dta-${d.slug}`;
    const dev = await prisma.development.findUnique({
      where: { feedKey },
      select: { id: true, publicName: true, publishStatus: true, override: { select: { id: true, seo: true } } },
    });
    if (!dev) { console.log(`${d.slug}: no development ${feedKey} — run dta-sync first`); continue; }

    const data = {};
    const report = [];
    for (const [l, L] of Object.entries(LANGS)) {
      const blocks = toPromoBlocks(d.long[l]);
      const headings = blocks.flatMap((b) => (b.content ?? []).filter((c) => c.style === "h2").map((c) => c.children[0].text));
      const tables = blocks.filter((b) => b._type === "tableBlock").length;
      if (!blocks.some((b) => b._type === "textContent")) throw new Error(`${d.slug} ${L}: no textContent item`);
      data[`description${L}`] = d.short[l];
      data[`promoBlocks${L}`] = blocks;
      report.push(`${L} ${blocks.length} items, ${headings.length} h2, ${tables} table${tables === 1 ? "" : "s"}`);
    }
    console.log(`\n${dev.publicName} (${dev.publishStatus}) — ${report.join(" | ")}`);
    console.log(`  first h2 EN: ${d.long.en.match(/^## (.+)$/m)[1]}`);
    if (!APPLY) continue;
    await prisma.developmentOverride.upsert({
      where: { developmentId: dev.id },
      update: data,                       // seo deliberately absent: the operator owns it
      create: { developmentId: dev.id, ...data },
    });
    console.log(`  written → /admin/developments/${dev.id}`);
  }
} finally {
  await prisma.$disconnect();
}
