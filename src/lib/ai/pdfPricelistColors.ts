import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* Deterministic per-cell text-color extraction for a PDF price list (Motive Point,
   2026-08-12) — status ("sold"/"reserved" vs "available") is shown ONLY via grey vs
   black text, no explicit status column. AI reading of a rendered page cannot be
   trusted for this (verified: eyeballing the real PDF misclassified 4 of 42 units —
   see the investigation this module came from). This reads the ACTUAL fill color PDF.js
   used to draw each glyph, straight from the render pipeline — not a visual/OCR guess.

   The actual canvas+pdf.js work runs in scripts/pdf-color-extract-worker.mjs, spawned
   as a SEPARATE process — not imported here. Reason: `canvas` is a native addon
   (.node binding); keeping it out of the main app's process entirely, same pattern
   imageMirror.ts already uses for pdftoppm, avoids ever bundling/loading it inside
   Next.js's server process. (An initial version of this fix mistakenly suspected a
   conflict with `sharp`, also native and already in this module's import chain via
   driveAvailabilitySync.ts — ruled out by reproduction: the worker fails identically
   with sharp never loaded anywhere in the process. The real cause was node-canvas's
   Linux build throwing inside its own drawImage for this document's one embedded
   image; see the worker script's own comment for the actual fix.) */

export type ColoredCell = { text: string; x: number; color: string | null };
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

const WORKER_PATH = join(process.cwd(), "scripts", "pdf-color-extract-worker.mjs");

// Renders every page (via the isolated worker process) and returns rows of
// {text, x, color} cells, grouped by y, sorted top-to-bottom then left-to-right. No
// semantic interpretation here (no project/unit parsing) — that's
// pdfPricelistExtract.ts's job, working off this raw colored table.
export async function extractColoredRowsFromPdf(buf: Buffer): Promise<ColoredRow[]> {
  const dir = await mkdtemp(join(tmpdir(), "pdfcolor-"));
  try {
    const src = join(dir, "in.pdf");
    await writeFile(src, buf);
    const json = await new Promise<string>((resolve, reject) => {
      const p = spawn(process.execPath, [WORKER_PATH, src]);
      let out = "", err = "";
      p.stdout.on("data", (d) => (out += d));
      p.stderr.on("data", (d) => (err += d));
      p.on("error", reject);
      p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`pdf-color-extract-worker exit ${code}: ${err.slice(0, 500)}`))));
    });
    return JSON.parse(json) as ColoredRow[];
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
