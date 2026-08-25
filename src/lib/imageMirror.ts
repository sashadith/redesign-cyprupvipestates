import sharp from "sharp";
import { createHash } from "crypto";
import { mkdir, writeFile, access, mkdtemp, readdir, readFile, rm } from "fs/promises";
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, utimesSync, existsSync, statSync, readdirSync } from "fs";
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
// Debounced: every admin save/sync that mirrors anything calls this, and pm2
// runs cyprusvipestates in cluster mode (2 workers) — five clicks in a row,
// possibly landing on different workers, must not mean five restarts. A
// small lock file (shared filesystem, so it coordinates across BOTH cluster
// workers, unlike an in-memory flag) records the last trigger time; a
// trigger within RESTART_DEBOUNCE_MS of the last one is a no-op. 2026-08-04:
// PM2_APP_NAME is now set correctly per environment (prod's/staging's own
// shared .env) — the fallback below is only a last resort, no longer the
// live bug it used to be (confirmed via pm2's restart counter: cve-staging
// had silently absorbed every prod mirror-triggered restart for weeks).
const RESTART_DEBOUNCE_MS = 15_000;
const uploadsDir = () => join(process.cwd(), "public", "uploads");
const restartLockFile = () => join(uploadsDir(), ".restart-lock");
// A waiter has been spawned and WILL restart once the syncs are done. Removed by
// that waiter immediately before it restarts, so a crashed waiter can't block
// restarts forever (it also expires, see PENDING_STALE_MS).
const restartPendingFile = () => join(uploadsDir(), ".restart-pending");
// One file per in-flight long sync, heartbeated while it runs. A directory rather
// than a single flag: several syncs legitimately overlap (the 4am feed-sync cron
// and an admin-triggered Drive import), and a refcount in a single file cannot be
// updated safely from two cluster workers at once.
const syncLockDir = () => join(uploadsDir(), ".sync-locks");
const SYNC_HEARTBEAT_MS = 60_000;
// A lock older than this is from a process that died — it stops holding restarts
// back. Comfortably above the heartbeat, low enough that a crash costs minutes.
const SYNC_LOCK_STALE_MIN = 5;
// Absolute cap on how long a restart may be deferred. Serving a stale bundle for
// half an hour is bad; never restarting at all is worse.
const MAX_RESTART_WAIT_MIN = 30;
const PENDING_STALE_MS = (MAX_RESTART_WAIT_MIN + 5) * 60_000;

/* Marks a long-running sync as in flight, so scheduleAppRestart() waits for it
   instead of killing it (2026-08-25).

   The incident: a manual Drive import was writing project 11 of 16 when the 4am
   feed-sync cron finished mirroring two new Square One projects and called
   scheduleAppRestart(). Four seconds later `pm2 restart` took both cluster
   workers down, the import died mid-loop, and the browser showed a raw
   "undefined is not an object (evaluating 'e.ok')" — the server action's
   response had simply never arrived. Five projects were left unsynced and the
   run's final bookkeeping (source signature, driveSyncedAt) never happened.

   Nothing about that was specific to those two jobs: any mirror-triggered
   restart lands on whatever else is running, and mirroring happens on every
   admin image upload too.

   Returns the release function. ALWAYS call it from a finally block — a lock
   that is never released delays restarts until it goes stale. */
export function beginSyncWindow(label: string): () => void {
  try {
    const dir = syncLockDir();
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${label.replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 40)}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`);
    writeFileSync(file, new Date().toISOString());
    // Keeps the mtime fresh for as long as this really is running, which is what
    // lets the staleness window stay short without cutting long imports off.
    const beat = setInterval(() => { try { const t = new Date(); utimesSync(file, t, t); } catch { /* gone already */ } }, SYNC_HEARTBEAT_MS);
    beat.unref?.();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      clearInterval(beat);
      try { unlinkSync(file); } catch { /* already gone */ }
    };
  } catch {
    return () => {};
  }
}

export function scheduleAppRestart() {
  try {
    const lockPath = restartLockFile();
    const now = Date.now();
    let last = 0;
    try { last = Number(readFileSync(lockPath, "utf8")) || 0; } catch { /* no lock yet */ }
    if (now - last < RESTART_DEBOUNCE_MS) return; // already scheduled recently
    // A waiter is already queued — it restarts AFTER the running syncs finish and
    // will pick up whatever has been mirrored by then, this call included. Without
    // this, every sync that finishes during a long wait would queue its own waiter
    // and they would all restart one after another.
    try {
      const st = statSync(restartPendingFile());
      if (now - st.mtimeMs < PENDING_STALE_MS) return;
    } catch { /* no waiter pending */ }
    writeFileSync(lockPath, String(now));
    writeFileSync(restartPendingFile(), String(now));
    const app = process.env.PM2_APP_NAME || "cyprusvipestates";
    // Detached and unref'd, as before: this shell has to outlive the restart it
    // performs. The wait loop polls for any sync lock touched within the staleness
    // window and gives up after MAX_RESTART_WAIT_MIN, so a stuck sync delays the
    // restart but can never cancel it.
    spawn("sh", ["-c", buildRestartCommand(app, syncLockDir(), restartPendingFile())], { detached: true, stdio: "ignore" }).unref();
  } catch { /* ignore */ }
}

/* The waiter's shell script, built here so it can be exercised directly (see the
   harness note in the commit): a `find` for any sync lock touched within the
   staleness window, polled every 10s, capped at MAX_RESTART_WAIT_MIN, then the
   restart — unconditionally. A stuck sync may DELAY the restart; it must never
   be able to cancel it, because the app serves 404s for freshly mirrored images
   until it restarts. `restartCmd` is injectable for the same reason. */
export function buildRestartCommand(app: string, lockDir: string, pendingFile: string, restartCmd = "/usr/bin/pm2 restart"): string {
  return (
    `sleep 4; i=0; ` +
    `while [ $i -lt ${MAX_RESTART_WAIT_MIN * 6} ] && [ -n "$(find '${lockDir}' -type f -mmin -${SYNC_LOCK_STALE_MIN} 2>/dev/null | head -n 1)" ]; ` +
    `do sleep 10; i=$((i+1)); done; ` +
    `rm -f '${pendingFile}'; ${restartCmd} ${app}`
  );
}

/** True while any long sync holds a fresh lock — for status display only; the
 *  restart decision itself is made by the spawned shell above, which has to work
 *  across cluster workers and across the restart it performs. */
export function syncWindowActive(): boolean {
  try {
    const dir = syncLockDir();
    if (!existsSync(dir)) return false;
    const cutoff = Date.now() - SYNC_LOCK_STALE_MIN * 60_000;
    return readdirSync(dir).some((f) => {
      try { return statSync(join(dir, f)).mtimeMs > cutoff; } catch { return false; }
    });
  } catch {
    return false;
  }
}
const root = () => join(process.cwd(), "public", "uploads", "developments");
const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 16);
const exists = (p: string) => access(p).then(() => true).catch(() => false);

// Upgrade any incoming URL to its "large" tier when the source follows a
// known variant-naming convention, so we always mirror from the biggest
// real source available before OUR OWN downscale (SIZES below) ever runs —
// confirmed 2026-08-03 (BBF/INEX image-resolution investigation) that
// picking "medium" this early was throwing away a genuinely bigger source
// image (e.g. a Ridge hero: 800x933 medium vs. the real 3429x4000 camera
// original at large) that our own resize cap never got a chance to use.
// Deliberately duplicated from src/app/preview-project/imageSize.ts's
// SUFFIX_RE/PREFIX_RE (same two patterns, confirmed to cover every BBF/INEX
// URL sampled — suffix "_medium"/"_large" before the extension or a further
// suffix, and UPPERCASE "MEDIUM_"/"LARGE_" filename prefixes) — kept local
// so src/lib doesn't reach into an app-route feature directory. Deliberately
// applied HERE, not at each adapter's call site: this is the one place every
// mirrored image passes through regardless of origin — feed-derived via
// sizedImages(), or a hardcoded feeds.ts OVERRIDES.mainImage literal — so a
// future override or adapter benefits automatically without remembering to
// ask for "large" itself.
//
// WP_THUMB_RE (2026-08-08, resolution audit across the remaining feeds):
// Pafilia (xml2u) is WordPress-hosted and its feed exports the auto-
// generated intermediate thumbnail (e.g. "…-1024x683.jpg"), not the
// original upload — confirmed on 213 live samples: stripping the trailing
// "-WIDTHxHEIGHT" always resolved (213/213, zero 404s) to the real original,
// 1500–8424px, vs. the 1024–1621px thumbnail we were mirroring. Our own
// SIZES cap below still applies — this only raises the CEILING we mirror
// FROM, never what we store. Every other current feed's URLs were checked
// against this pattern and none match (Island Blue: opaque hashes; Aristo:
// a single fixed "-4" suffix, not "-WxH"; Medousa: bare numeric ids; Square
// One: random alphanumeric suffixes; BBF/INEX/Domenica: their own
// "_medium"/"_optimized_N" suffixes, handled by the other two branches or
// left as "single" — none contain a dash-prefixed "digitsxdigits").
// If the stripped URL 404s (WordPress does sometimes prune originals),
// mirrorImage()'s existing "large !== src → fall back to src" fetch retry
// (below) already covers it with no extra code needed here — same generic
// fallback the other two branches already rely on.
// Any URL that doesn't match any of the three patterns (Island Blue,
// Domenica, Medousa, Square One — single-size feeds) passes through
// unchanged.
const SUFFIX_RE = /_(small|medium|large)(?=[._])/i;
const PREFIX_RE = /(^|\/)(small|medium|large)_/i;
const WP_THUMB_RE = /-\d+x\d+(\.(?:jpe?g|png|webp))$/i;
const toLargeVariant = (url: string): string => {
  if (SUFFIX_RE.test(url)) return url.replace(SUFFIX_RE, "_large");
  if (PREFIX_RE.test(url)) return url.replace(PREFIX_RE, (_m, slash) => `${slash}LARGE_`);
  if (WP_THUMB_RE.test(url)) return url.replace(WP_THUMB_RE, "$1");
  return url;
};

export type MirrorResult = { url: string; wasNew: boolean };

// The exact hash a source URL would mirror to — exported so drift detection
// (feedSync.ts's syncOneProject) can compare a fresh feed URL against what's
// already on disk WITHOUT downloading anything, using the identical formula
// mirrorImage() itself uses below. Two independent implementations of "what
// hash does this URL produce" would drift apart the first time either one
// changes (e.g. toLargeVariant() growing a new pattern) — this is the one
// definition both read from.
export function sourceUrlHash(src: string): string {
  return hash(toLargeVariant(src));
}

// The inverse: given an already-mirrored URL (`/uploads/developments/<devKey>/
// <hash>_<size>.<ext>`), read the hash back out. Returns null for anything
// that isn't in that shape (an external hotlink that was never mirrored, a
// raw content-hashed file with no size suffix, etc.) — callers must decide
// what "not a mirrored URL" means for them, this never guesses.
export function hashFromMirroredUrl(url: string): string | null {
  const m = url.match(/\/([a-f0-9]{16})_(?:small|medium|large)\.[a-z0-9]+$/i);
  return m ? m[1].toLowerCase() : null;
}

// Content-based fallback for when sourceUrlHash() disagrees with reality —
// several feed vendors reissue a fresh URL/UUID for an image whose pixel
// content never changed (confirmed 2026-08-08: Weblium/Domenica in full,
// and BBF's per-unit photo storage — e.g. Eden Bay unit 302, 30 of 31
// "drifted" photos were re-encodes of already-mirrored images, only 1 was
// genuinely new). Reduces to a tiny grayscale thumbnail so a re-encode
// (webp vs original, different quality/size) still compares equal — a
// mean-abs-diff below CONTENT_MATCH_THRESHOLD (out of 255) is treated as
// the same photo. Callers (feedSync.ts) memoize confirmed matches in
// VerifiedDuplicateImage so this download+compare only ever runs once per
// distinct source URL, never on every sync.
const CONTENT_MATCH_THRESHOLD = 8;

async function contentThumbnail(buf: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(buf).resize(24, 24, { fit: "fill" }).grayscale().raw().toBuffer();
  } catch {
    return null;
  }
}

function meanAbsDiff(a: Buffer, b: Buffer): number {
  if (a.length !== b.length) return 999;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

async function readLocalThumbnail(mirroredUrl: string): Promise<Buffer | null> {
  const rel = mirroredUrl.replace(/^\/uploads\/developments\//, "");
  try {
    const buf = await readFile(join(root(), rel));
    return await contentThumbnail(buf);
  } catch {
    return null;
  }
}

async function fetchThumbnail(src: string): Promise<Buffer | null> {
  try {
    const large = toLargeVariant(src);
    const res = await fetch(large, { signal: AbortSignal.timeout(15000), cache: "no-store" });
    if (!res.ok || !/image\//i.test(res.headers.get("content-type") ?? "")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return await contentThumbnail(buf);
  } catch {
    return null;
  }
}

// Given candidate source URLs (already hash-filtered by the caller — none of
// them matched storedMirroredUrls by sourceUrlHash) and the SAME-scope
// stored URLs to compare against (this project's gallery, or one unit's own
// photos — deliberately never a wider scope, to avoid a candidate matching
// an unrelated room that happens to look similar), downloads each candidate
// once and content-compares. Never persists anything — callers own
// memoization (VerifiedDuplicateImage) and any actual mirroring.
export async function classifyByContent(
  candidateUrls: string[],
  storedMirroredUrls: string[],
): Promise<{ genuinelyNew: string[]; duplicateOf: Map<string, string> }> {
  const storedThumbs: { hash: string; t: Buffer }[] = [];
  for (const u of storedMirroredUrls) {
    const h = hashFromMirroredUrl(u);
    if (!h) continue;
    const t = await readLocalThumbnail(u);
    if (t) storedThumbs.push({ hash: h, t });
  }
  const genuinelyNew: string[] = [];
  const duplicateOf = new Map<string, string>(); // candidate source URL -> matched local hash
  for (const url of candidateUrls) {
    const t = await fetchThumbnail(url);
    if (!t) { genuinelyNew.push(url); continue; } // undownloadable/undecodable — treat as new, same as mirrorImage() would fail identically later
    let best = Infinity;
    let bestHash = "";
    for (const st of storedThumbs) {
      const diff = meanAbsDiff(t, st.t);
      if (diff < best) { best = diff; bestHash = st.hash; }
    }
    if (best < CONTENT_MATCH_THRESHOLD) duplicateOf.set(url, bestHash);
    else genuinelyNew.push(url);
  }
  return { genuinelyNew, duplicateOf };
}

export async function mirrorImage(src: string, devKey: string): Promise<MirrorResult | null> {
  if (!src || !/^https?:\/\//i.test(src)) return null;
  const h = sourceUrlHash(src);
  const large = toLargeVariant(src);
  const dir = join(root(), devKey);
  const mediumFile = join(dir, `${h}_medium.webp`);
  const mediumUrl = `/uploads/developments/${devKey}/${h}_medium.webp`;
  if (await exists(mediumFile)) return { url: mediumUrl, wasNew: false }; // already mirrored → skip download
  try {
    let res = await fetch(large, { signal: AbortSignal.timeout(20000), cache: "no-store" });
    if (!res.ok || !/image\//i.test(res.headers.get("content-type") ?? "")) {
      if (large !== src) {
        console.warn(`[imageMirror] large-variant fetch failed (${res.status}) for ${large} (devKey=${devKey}) — falling back to ${src}`);
        res = await fetch(src, { signal: AbortSignal.timeout(20000), cache: "no-store" });
      }
      if (!res.ok) return null;
      if (!/image\//i.test(res.headers.get("content-type") ?? "")) return null; // e.g. Cloudflare HTML
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(dir, { recursive: true });
    for (const [size, w] of SIZES) {
      const out = await sharp(buf).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
      await writeFile(join(dir, `${h}_${size}.webp`), out);
    }
    return { url: mediumUrl, wasNew: true };
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

// Mirror a list of source urls (limited concurrency); drops failures. Every
// entry is assumed to be an external URL — use this for feed-sourced arrays
// (feedSync.ts), where a failed mirror is simply omitted (the feed remains
// the source of truth next sync).
export async function mirrorAll(urls: string[], devKey: string, concurrency = 4): Promise<{ urls: string[]; anyNew: boolean }> {
  const out: string[] = [];
  let anyNew = false;
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = await Promise.all(urls.slice(i, i + concurrency).map((u) => mirrorImage(u, devKey)));
    for (const r of batch) if (r) { out.push(r.url); if (r.wasNew) anyNew = true; }
  }
  return { urls: out, anyNew };
}

// Mirror a MIXED array (already-local /uploads/ paths alongside external
// URLs) — for admin-save paths (saveGallery/savePlans/setUnitPhotos/etc.)
// where order and array length matter (it's a curated, ordered gallery, not
// a fresh feed pull) and a failed mirror must never make an image silently
// vanish: already-local entries pass through untouched, and an external URL
// that fails to mirror is kept as-is (a working hotlink beats a missing
// image) rather than dropped.
export async function mirrorAny(urls: string[], devKey: string, concurrency = 4): Promise<{ urls: string[]; anyNew: boolean }> {
  const out: string[] = new Array(urls.length);
  let anyNew = false;
  const externalIdx: number[] = [];
  urls.forEach((u, i) => { if (/^https?:\/\//i.test(u)) externalIdx.push(i); else out[i] = u; });
  for (let i = 0; i < externalIdx.length; i += concurrency) {
    const batchIdx = externalIdx.slice(i, i + concurrency);
    const results = await Promise.all(batchIdx.map((idx) => mirrorImage(urls[idx], devKey)));
    results.forEach((r, j) => {
      const idx = batchIdx[j];
      if (r) { out[idx] = r.url; if (r.wasNew) anyNew = true; }
      else out[idx] = urls[idx]; // mirror failed — keep the original external URL rather than lose the image
    });
  }
  return { urls: out, anyNew };
}

// Filesystem-safe folder key for a development, from its feedKey.
export const devKeyFor = (feedKey: string) => feedKey.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-+|-+$/g, "");
