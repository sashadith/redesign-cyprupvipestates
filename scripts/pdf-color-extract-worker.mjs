#!/usr/bin/env node
// Standalone worker for src/lib/ai/pdfPricelistColors.ts — spawned as a separate
// process, NEVER imported into the main app, so `canvas` (a native .node addon)
// never has to be loaded/bundled inside Next.js's server process — same isolation
// pattern imageMirror.ts already uses for pdftoppm.
//
// Usage: node pdf-color-extract-worker.mjs <path-to-pdf> — prints ColoredRow[] JSON to stdout.
import { createCanvas } from "canvas";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

const [, , pdfPath] = process.argv;
if (!pdfPath) {
  console.error("usage: pdf-color-extract-worker.mjs <path-to-pdf>");
  process.exit(1);
}

async function extractColoredRows(buf) {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf), disableFontFace: true }).promise;
  const allRows = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d");
    // No-op: this module only reads text position + fill color, never pixels — any
    // embedded image (e.g. a logo) is irrelevant here, and node-canvas's Linux build
    // throws inside its own drawImage for at least one real-world case (confirmed:
    // this exact document's single paintImageXObject call, reproduced with sharp
    // never loaded anywhere in the process, so it's not the sharp/canvas conflict
    // this file's own history first suspected — a canvas-on-Linux image-drawing
    // limitation instead). Skipping the draw entirely sidesteps it with no loss,
    // since nothing here ever reads the rendered pixels.
    ctx.drawImage = function () {};

    const fillRecords = [];
    const origFill = ctx.fill.bind(ctx);
    ctx.fill = function (...args) {
      const t = this.currentTransform;
      fillRecords.push({ fillStyle: this.fillStyle, x: t.e, y: t.f });
      return origFill(...args);
    };

    await page.render({ canvasContext: ctx, viewport }).promise;
    const tc = await page.getTextContent();

    const rowsByY = new Map();
    for (const item of tc.items) {
      if (!item.str || !item.str.trim()) continue;
      const m = pdfjsLib.Util.transform(viewport.transform, item.transform);
      const x = m[4], y = m[5];
      const width = item.width * viewport.scale;
      const height = item.height * viewport.scale;
      const xMin = x - 2, xMax = x + width + 2;
      const yMin = y - height - 2, yMax = y + 2;
      const matches = fillRecords.filter((f) => f.x >= xMin && f.x <= xMax && f.y >= yMin && f.y <= yMax);
      const counts = new Map();
      for (const mm of matches) counts.set(mm.fillStyle, (counts.get(mm.fillStyle) ?? 0) + 1);
      const dominant = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const isMixed = counts.size > 1 && (counts.get(dominant) ?? 0) < matches.length;
      const color = matches.length === 0 || isMixed ? null : dominant;

      const key = Math.round(y / 4) * 4;
      if (!rowsByY.has(key)) rowsByY.set(key, { y: key, cells: [] });
      rowsByY.get(key).cells.push({ text: item.str, x: Math.round(x), color });
    }
    const rows = Array.from(rowsByY.values());
    for (const row of rows) row.cells.sort((a, b) => a.x - b.x);
    allRows.push(...rows.sort((a, b) => a.y - b.y));
  }
  return allRows;
}

try {
  const buf = readFileSync(pdfPath);
  const rows = await extractColoredRows(buf);
  process.stdout.write(JSON.stringify(rows));
} catch (e) {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
}
