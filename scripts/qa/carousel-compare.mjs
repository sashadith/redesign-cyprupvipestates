// Pixel comparison of a carousel render against an approved reference render
// (2026-11-05). Used by scripts/qa/carousel-testbed.mts.
//
// The slide is split into 24×24 px blocks; a block whose mean absolute channel
// difference exceeds BLOCK_THRESHOLD (12/255) counts as noticeably different.
// Neighbouring different blocks are merged into regions (bounding boxes) so the
// report names areas, not hundreds of cells. A heatmap JPG (reference greyed,
// differing blocks in red) is written next to the render.
import sharp from "sharp";

export const BLOCK = 24;
export const BLOCK_THRESHOLD = 12;

async function rgb(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

export async function compareImages(refFile, renderFile, heatmapFile) {
  const a = await rgb(refFile), b = await rgb(renderFile);
  if (a.w !== b.w || a.h !== b.h) throw new Error(`size differs: ${a.w}×${a.h} vs ${b.w}×${b.h}`);
  const bw = Math.ceil(a.w / BLOCK), bh = Math.ceil(a.h / BLOCK);
  const score = new Float32Array(bw * bh);
  let total = 0;
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    let s = 0, n = 0;
    for (let y = by * BLOCK; y < Math.min(a.h, (by + 1) * BLOCK); y++) for (let x = bx * BLOCK; x < Math.min(a.w, (bx + 1) * BLOCK); x++) {
      const i = (y * a.w + x) * 3;
      s += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
      n += 3;
    }
    score[by * bw + bx] = s / n;
    total += s / n;
  }
  const hot = (i) => score[i] > BLOCK_THRESHOLD;
  // Merge 8-connected hot blocks into regions.
  const seen = new Uint8Array(bw * bh), regions = [];
  for (let i = 0; i < score.length; i++) {
    if (!hot(i) || seen[i]) continue;
    const stack = [i]; seen[i] = 1;
    let x0 = bw, y0 = bh, x1 = 0, y1 = 0, max = 0, cells = 0;
    while (stack.length) {
      const j = stack.pop(), x = j % bw, y = (j / bw) | 0;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); max = Math.max(max, score[j]); cells++;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, k = ny * bw + nx;
        if (nx >= 0 && ny >= 0 && nx < bw && ny < bh && !seen[k] && hot(k)) { seen[k] = 1; stack.push(k); }
      }
    }
    regions.push({ x: x0 * BLOCK, y: y0 * BLOCK, w: (x1 - x0 + 1) * BLOCK, h: (y1 - y0 + 1) * BLOCK, cells, maxDiff: +max.toFixed(1) });
  }
  regions.sort((p, q) => q.cells - p.cells);
  if (heatmapFile) {
    const out = Buffer.alloc(a.w * a.h * 3);
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
      const i = (y * a.w + x) * 3, g = (a.data[i] + a.data[i + 1] + a.data[i + 2]) / 3 * 0.6 + 60;
      const sc = score[((y / BLOCK) | 0) * bw + ((x / BLOCK) | 0)];
      const t = Math.min(1, sc / 40);
      out[i] = sc > BLOCK_THRESHOLD ? 255 : g; out[i + 1] = sc > BLOCK_THRESHOLD ? g * (1 - t) : g; out[i + 2] = sc > BLOCK_THRESHOLD ? g * (1 - t) : g;
    }
    await sharp(out, { raw: { width: a.w, height: a.h, channels: 3 } }).jpeg({ quality: 80 }).toFile(heatmapFile);
  }
  return { meanDiff: +(total / score.length).toFixed(2), hotBlocks: [...score].filter((s) => s > BLOCK_THRESHOLD).length, regions };
}

/** Element-by-element geometry comparison (same template ⇒ same element order). */
export function compareGeometry(ref, got, tolerance = 3) {
  const issues = [];
  if (ref.length !== got.length) issues.push({ k: "(element count)", detail: `${ref.length} vs ${got.length}` });
  for (let i = 0; i < Math.min(ref.length, got.length); i++) {
    const r = ref[i], g = got[i];
    if (r.k !== g.k) { issues.push({ k: `${r.k} ≠ ${g.k}`, detail: `element ${i} differs in kind` }); continue; }
    const d = { x: g.x - r.x, y: g.y - r.y, w: g.w - r.w, h: g.h - r.h };
    const worst = Math.max(...Object.values(d).map(Math.abs));
    if (worst > tolerance) issues.push({ k: r.k, i, ref: r, got: g, delta: d });
  }
  return issues;
}
