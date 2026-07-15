import sharp from "sharp";
import { createHash } from "crypto";
import { mkdir, writeFile, access, mkdtemp, readdir, readFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { spawn } from "child_process";

/* Image mirroring (Phase 1, Increment 3). Downloads a feed image and writes
   small/medium/large WebP variants to /uploads/developments/<devKey>/, then
   returns the MEDIUM public URL. Files are named "<hash>_<size>.webp" so the
   existing atSize() helper swaps _medium→_large/_small on OUR urls too — no
   frontend change. This is the one place that knows about storage, so swapping
   to object storage later means changing only this file. */

const SIZES: [string, number][] = [["small", 640], ["medium", 1280], ["large", 1920]];

// Next.js (next start) indexes public/ files at startup — a file written to
// public/uploads/ AFTER that point 404s/misroutes (falls through to the
// [lang]/[...slug] catch-all, which then crashes trying to treat the path
// segment as a language) until the app restarts. Every code path that writes a
// NEW file under public/uploads/ must call this afterward. Detached + delayed
// so the HTTP response returns before the restart. App name overridable via
// PM2_APP_NAME.
export function scheduleAppRestart() {
  try {
    const app = process.env.PM2_APP_NAME || "cve-staging";
    spawn("sh", ["-c", `sleep 4 && /usr/bin/pm2 restart ${app}`], { detached: true, stdio: "ignore" }).unref();
  } catch { /* ignore */ }
}
const root = () => join(process.cwd(), "public", "uploads", "developments");
const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 16);
const exists = (p: string) => access(p).then(() => true).catch(() => false);

export async function mirrorImage(src: string, devKey: string): Promise<string | null> {
  if (!src || !/^https?:\/\//i.test(src)) return null;
  const h = hash(src);
  const dir = join(root(), devKey);
  const mediumFile = join(dir, `${h}_medium.webp`);
  const mediumUrl = `/uploads/developments/${devKey}/${h}_medium.webp`;
  if (await exists(mediumFile)) return mediumUrl; // already mirrored → skip download
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    if (!/image\//i.test(res.headers.get("content-type") ?? "")) return null; // e.g. Cloudflare HTML
    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(dir, { recursive: true });
    for (const [size, w] of SIZES) {
      const out = await sharp(buf).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
      await writeFile(join(dir, `${h}_${size}.webp`), out);
    }
    return mediumUrl;
  } catch {
    return null;
  }
}

// Process an UPLOADED image buffer → small/medium/large WebP → return medium URL.
// Content-hashed so re-uploading the same file dedups.
export async function storeUploadedImage(buf: Buffer, devKey: string): Promise<string | null> {
  try {
    const h = createHash("sha1").update(buf).digest("hex").slice(0, 16);
    const dir = join(root(), devKey);
    const mediumUrl = `/uploads/developments/${devKey}/${h}_medium.webp`;
    await mkdir(dir, { recursive: true });
    for (const [size, w] of SIZES) {
      const out = await sharp(buf).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
      await writeFile(join(dir, `${h}_${size}.webp`), out);
    }
    return mediumUrl;
  } catch {
    return null;
  }
}

// Store a raw file (e.g. a floor-plan PDF) under the development's folder, content-hashed.
export async function storeRawFile(buf: Buffer, devKey: string, ext: string): Promise<string | null> {
  try {
    const h = createHash("sha1").update(buf).digest("hex").slice(0, 16);
    const dir = join(root(), devKey);
    const url = `/uploads/developments/${devKey}/${h}.${ext}`;
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${h}.${ext}`), buf);
    return url;
  } catch {
    return null;
  }
}

// Rasterize a PDF's pages to JPEG buffers via poppler's `pdftoppm` (apt: poppler-utils).
// Floor-plan PDFs (uploads + Drive sync) used to be stored as-is, but the public
// site only ever renders <img> — a raw PDF url is a broken image there. Returns
// [] if the binary or the conversion fails so the caller can fall back to the raw PDF.
export async function pdfPagesToJpegs(buf: Buffer, maxPages = 6): Promise<Buffer[]> {
  const dir = await mkdtemp(join(tmpdir(), "pdf-"));
  try {
    const src = join(dir, "in.pdf");
    await writeFile(src, buf);
    await new Promise<void>((resolve, reject) => {
      const p = spawn("pdftoppm", ["-jpeg", "-r", "150", "-f", "1", "-l", String(maxPages), src, join(dir, "page")]);
      p.on("error", reject);
      p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`pdftoppm exit ${code}`))));
    });
    const files = (await readdir(dir)).filter((f) => f.startsWith("page") && f.endsWith(".jpg")).sort();
    const out: Buffer[] = [];
    for (const f of files) out.push(await readFile(join(dir, f)));
    return out;
  } catch {
    return [];
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// Mirror a list of source urls (limited concurrency); drops failures.
export async function mirrorAll(urls: string[], devKey: string, concurrency = 4): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = await Promise.all(urls.slice(i, i + concurrency).map((u) => mirrorImage(u, devKey)));
    for (const r of batch) if (r) out.push(r);
  }
  return out;
}

// Filesystem-safe folder key for a development, from its feedKey.
export const devKeyFor = (feedKey: string) => feedKey.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-+|-+$/g, "");
