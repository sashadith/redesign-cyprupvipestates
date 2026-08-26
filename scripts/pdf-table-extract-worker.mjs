#!/usr/bin/env node
// Standalone worker for src/lib/ai/availabilityTable.ts — spawned as a separate
// process, NEVER imported into the main app, so pdfjs-dist stays out of Next.js's
// server bundle entirely (same isolation pattern pdf-color-extract-worker.mjs and
// imageMirror.ts's pdftoppm call already use).
//
// Unlike pdf-color-extract-worker.mjs this one needs NO `canvas`: it reads text
// items and their positions straight out of getTextContent(), never renders a
// page. Korantina's availability lists carry an explicit status/price column, so
// no fill-color reading is required — position alone is enough to reconstruct the
// table faithfully, INCLUDING which cells are empty (see the y/x grouping below).
//
// Usage: node pdf-table-extract-worker.mjs <path-to-pdf> — prints PdfPage[] JSON
// to stdout: [{ page, width, height, rows: [{ y, cells: [{ x, w, t }] }] }]
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

const [, , pdfPath] = process.argv;
if (!pdfPath) {
  console.error("usage: pdf-table-extract-worker.mjs <path-to-pdf>");
  process.exit(1);
}

// Two text items belong to the same visual row when their baselines are within
// this many points. 4.5 was measured against Korantina's real availability lists:
// their table rows sit ~20pt apart, while a single row's own multi-run text (a
// number and its "m²" suffix drawn as separate items) shares a baseline exactly.
// Larger values start merging a tight two-line header into one row; smaller ones
// split rows whose font mixes sub/superscript runs.
const ROW_TOLERANCE = 4.5;

async function extractRows(buf) {
  // verbosity 0 (ERRORS only): pdf.js writes font warnings like "TT: undefined
  // function: 21" to STDOUT via console.log, which would land in the middle of the
  // JSON this worker prints and break the parent's JSON.parse. Korantina's lists
  // trigger it on every file.
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf), disableFontFace: true, verbosity: 0 }).promise;
  const pages = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    const items = content.items
      .filter((i) => typeof i.str === "string" && i.str.trim())
      // transform[4]/[5] are the item's x/y in PDF user space (origin bottom-left).
      // `width` is pdf.js's own measured advance width — used for the CENTER of the
      // item (x + w/2) everywhere downstream, because a right-aligned numeric column
      // has a start-x that shifts with digit count while its center stays put.
      .map((i) => ({ x: i.transform[4], y: i.transform[5], w: i.width || 0, t: i.str.replace(/\s+/g, " ").trim() }));

    // Top-to-bottom, then left-to-right — the reading order the table parser assumes.
    items.sort((a, b) => b.y - a.y || a.x - b.x);

    const rows = [];
    let current = null;
    for (const it of items) {
      if (!current || Math.abs(current.y - it.y) > ROW_TOLERANCE) {
        current = { y: it.y, cells: [] };
        rows.push(current);
      }
      current.cells.push(it);
    }
    for (const r of rows) r.cells.sort((a, b) => a.x - b.x);

    pages.push({
      page: pageNum,
      width: viewport.width,
      height: viewport.height,
      rows: rows.map((r) => ({ y: Math.round(r.y * 100) / 100, cells: r.cells.map((c) => ({ x: Math.round(c.x * 100) / 100, w: Math.round(c.w * 100) / 100, t: c.t })) })),
    });
  }
  return pages;
}

extractRows(readFileSync(pdfPath))
  .then((pages) => process.stdout.write(JSON.stringify(pages)))
  .catch((err) => {
    console.error(err?.stack || String(err));
    process.exit(1);
  });
