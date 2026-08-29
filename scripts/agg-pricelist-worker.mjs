#!/usr/bin/env node
// Standalone worker for src/lib/ai/aggPricelist.ts — spawned as a separate process
// so pdfjs-dist stays out of Next.js's server bundle (same isolation pattern as
// scripts/pdf-table-extract-worker.mjs).
//
// AGG Luxury Homes' price list is a PowerPoint export, NOT a table: each slide
// carries one-to-six unit "cards" laid out as columns. A row-grouped table read
// (pdf-table-extract-worker.mjs) would interleave cards; here we emit the FLAT
// text items with their positions and let the parser reconstruct each card by
// clustering x into columns. Origin is bottom-left (pdf user space).
//
// Usage: node agg-pricelist-worker.mjs <path-to-pdf> — prints to stdout:
//   [{ page, width, height, items: [{ x, y, w, t }] }]
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

const [, , pdfPath] = process.argv;
if (!pdfPath) { console.error("usage: agg-pricelist-worker.mjs <path-to-pdf>"); process.exit(1); }

async function extract(buf) {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf), disableFontFace: true, verbosity: 0 }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items
      .filter((i) => typeof i.str === "string" && i.str.trim())
      .map((i) => ({ x: Math.round(i.transform[4] * 100) / 100, y: Math.round(i.transform[5] * 100) / 100, w: Math.round((i.width || 0) * 100) / 100, t: i.str.replace(/\s+/g, " ").trim() }));
    pages.push({ page: n, width: viewport.width, height: viewport.height, items });
  }
  return pages;
}
extract(readFileSync(pdfPath))
  .then((p) => process.stdout.write(JSON.stringify(p)))
  .catch((e) => { console.error(e?.stack || String(e)); process.exit(1); });
