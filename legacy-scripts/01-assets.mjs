// Phase 2 — asset migration: download all Sanity assets to local /public/uploads,
// populate Media (keyed by Sanity asset _id). Idempotent: skips files already on disk.
// Run from the app root:  node --env-file=.env migration/01-assets.mjs
import { PrismaClient } from "@prisma/client";
import { mkdir, access, writeFile } from "node:fs/promises";
import path from "node:path";

const PROJECT = process.env.SANITY_PROJECT_ID;
const DATASET = process.env.SANITY_DATASET;
const TOKEN = process.env.SANITY_API_TOKEN;
const UPLOADS = path.join(process.cwd(), "public", "uploads");
const API = `https://${PROJECT}.api.sanity.io/v2021-10-21/data/query/${DATASET}`;

const prisma = new PrismaClient();

async function sanityQuery(query) {
  const res = await fetch(`${API}?query=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error(`Sanity ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).result;
}

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function download(url, dest) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await writeFile(dest, buf);
      return buf.length;
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

async function pool(items, concurrency, fn) {
  let idx = 0, done = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      try { await fn(items[i]); } catch (e) { console.log("  ERR", items[i]?._id, e.message); }
      if (++done % 250 === 0) console.log(`  ...${done}/${items.length}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

async function main() {
  if (!PROJECT || !TOKEN) throw new Error("Missing SANITY_PROJECT_ID / SANITY_API_TOKEN env");
  await mkdir(path.join(UPLOADS, "images"), { recursive: true });
  await mkdir(path.join(UPLOADS, "files"), { recursive: true });

  // Fetch all asset docs (paged by _id)
  const PAGE = 1000;
  let all = [];
  for (let start = 0; ; start += PAGE) {
    const page = await sanityQuery(
      `*[_type in ["sanity.imageAsset","sanity.fileAsset"]] | order(_id asc) [${start}...${start + PAGE}]` +
      `{_id,_type,url,originalFilename,mimeType,size,"w":metadata.dimensions.width,"h":metadata.dimensions.height,"lqip":metadata.lqip}`
    );
    all = all.concat(page);
    if (page.length < PAGE) break;
  }
  console.log(`Fetched ${all.length} asset docs`);

  const stats = { downloaded: 0, skipped: 0, failed: 0, bytes: 0 };
  await pool(all, 12, async (a) => {
    if (!a.url) { stats.failed++; return; }
    const sub = a._type === "sanity.imageAsset" ? "images" : "files";
    const base = a.url.split("/").pop();
    const dest = path.join(UPLOADS, sub, base);
    const rel = `/uploads/${sub}/${base}`;
    if (await exists(dest)) {
      stats.skipped++;
    } else {
      try { stats.bytes += await download(a.url, dest); stats.downloaded++; }
      catch (e) { stats.failed++; console.log("  DL FAIL", a._id, e.message); return; }
    }
    const data = {
      filename: base, originalFilename: a.originalFilename ?? null,
      path: rel, url: rel, mimeType: a.mimeType ?? null, fileSize: a.size ?? null,
      width: a.w ?? null, height: a.h ?? null, blurDataUrl: a.lqip ?? null,
    };
    await prisma.media.upsert({
      where: { sanityAssetId: a._id },
      update: data,
      create: { sanityAssetId: a._id, ...data },
    });
  });

  const mediaCount = await prisma.media.count();
  console.log(`\nDONE — downloaded=${stats.downloaded} skipped=${stats.skipped} failed=${stats.failed} ` +
    `bytes=${(stats.bytes / 1048576).toFixed(1)}MB | Media rows=${mediaCount}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
