import { createCanvas } from "canvas";
import { createRequire } from "node:module";

/* Deterministic per-cell text-color extraction for a PDF price list (Motive Point,
   2026-08-12) — status ("sold"/"reserved" vs "available") is shown ONLY via grey vs
   black text, no explicit status column. AI reading of a rendered page cannot be
   trusted for this (verified: eyeballing the real PDF misclassified 4 of 42 units —
   see the investigation this module came from). This reads the ACTUAL fill color PDF.js
   used to draw each glyph, straight from the render pipeline — not a visual/OCR guess.

   Technique: pdf.js renders text as filled glyph PATHS (ctx.fill()), not ctx.fillText()
   — confirmed empirically on this document (0 fillText calls, 3215 fill() calls). So a
   real Canvas 2D context (the `canvas` package) is used, with fill() intercepted to
   record {fillStyle, x, y} from ctx.currentTransform at each call. Text CONTENT comes
   separately from page.getTextContent(); each text run's PDF.js Util.transform(viewport,
   item.transform) position is matched against the nearest fill() records (bounding-box
   overlap) to recover that run's color. Verified on the real document: 0 of 742 matched
   text runs had zero fill matches, 0 had mixed colors within one run. */

const require = createRequire(import.meta.url);

export type ColoredCell = { text: string; x: number; color: string };
export type ColoredRow = { y: number; cells: ColoredCell[] };

// Luminance-band classifier, not a hardcoded 2-value allowlist — the real document
// only ever produces #000000/#808080, but a future export could anti-alias slightly
// differently. Anything outside these bands (including non-grayscale colors, e.g. the
// #a6c9ec/#dae9f8 header-fill blues this same document uses for OTHER elements) is
// "unclear" on purpose — the safety rule is "never available unless unambiguously
// black", so a color this classifier doesn't recognize must never fall through to
// "available" by default.
const BLACK_LUMINANCE_MAX = 40; // #000000 = 0
const GREY_LUMINANCE_MIN = 90; // #808080 = 128
const GREY_LUMINANCE_MAX = 190;

function luminance(hex: string): number | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return null;
  const [r, g, b] = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  // Only grayscale (r≈g≈b) is ever treated as text color here — a genuinely colored
  // fill (e.g. a header background) must never be classified as black/grey by
  // coincidentally landing in the right luminance band.
  if (Math.max(r, g, b) - Math.min(r, g, b) > 12) return null;
  return (r + g + b) / 3;
}

export type ColorClass = "black" | "grey" | "unclear";
export function classifyColor(hex: string | null): ColorClass {
  if (!hex) return "unclear";
  const l = luminance(hex);
  if (l === null) return "unclear";
  if (l <= BLACK_LUMINANCE_MAX) return "black";
  if (l >= GREY_LUMINANCE_MIN && l <= GREY_LUMINANCE_MAX) return "grey";
  return "unclear";
}

// Renders every page and returns rows of {text, x, color} cells, grouped by y
// (4px buckets — matches the render scale used below), sorted top-to-bottom then
// left-to-right. No semantic interpretation here (no project/unit parsing) —
// that's pdfPricelistExtract.ts's job, working off this raw colored table.
export async function extractColoredRowsFromPdf(buf: Buffer): Promise<ColoredRow[]> {
  const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf), disableFontFace: true }).promise;

  const allRows: ColoredRow[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d");

    const fillRecords: { fillStyle: string; x: number; y: number }[] = [];
    const origFill = ctx.fill.bind(ctx);
    ctx.fill = function (...args: any[]) {
      const t = (this as any).currentTransform;
      fillRecords.push({ fillStyle: (this as any).fillStyle, x: t.e, y: t.f });
      return origFill(...args);
    };

    await page.render({ canvasContext: ctx, viewport }).promise;
    const tc = await page.getTextContent();

    const rowsByY = new Map<number, ColoredRow>();
    for (const item of tc.items as any[]) {
      if (!item.str || !item.str.trim()) continue;
      const m = pdfjsLib.Util.transform(viewport.transform, item.transform);
      const x = m[4], y = m[5];
      const width = item.width * viewport.scale;
      const height = item.height * viewport.scale;
      const xMin = x - 2, xMax = x + width + 2;
      const yMin = y - height - 2, yMax = y + 2;
      const matches = fillRecords.filter((f) => f.x >= xMin && f.x <= xMax && f.y >= yMin && f.y <= yMax);
      const counts = new Map<string, number>();
      for (const mm of matches) counts.set(mm.fillStyle, (counts.get(mm.fillStyle) ?? 0) + 1);
      const dominant = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      // A mismatched/unresolved run (no fill matches, or genuinely mixed colors
      // within the run itself) is marked "unclear" via a sentinel rather than
      // silently picking a majority color — classifyColor() only ever sees a real
      // hex or this sentinel, never a false single color for an inconsistent run.
      const isMixed = counts.size > 1 && (counts.get(dominant!) ?? 0) < matches.length;
      const color = matches.length === 0 || isMixed ? null : dominant;

      const key = Math.round(y / 4) * 4;
      if (!rowsByY.has(key)) rowsByY.set(key, { y: key, cells: [] });
      rowsByY.get(key)!.cells.push({ text: item.str, x: Math.round(x), color: color as any });
    }
    const rows = Array.from(rowsByY.values());
    for (const row of rows) row.cells.sort((a, b) => a.x - b.x);
    allRows.push(...rows.sort((a, b) => a.y - b.y));
  }
  return allRows;
}
