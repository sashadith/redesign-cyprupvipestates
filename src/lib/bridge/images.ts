import { stat } from "node:fs/promises";
import { join } from "node:path";

const SITE_URL = "https://cyprusvipestates.com";
const SIZES = ["small", "medium", "large"] as const;
type Size = (typeof SIZES)[number];

export type ImageVariant = { url: string; bytes: number; modified: string };
export type BridgeImage = { stored: string; variants: Partial<Record<Size, ImageVariant>> };

/**
 * Why a fingerprint is needed at all, and why it is stat() rather than a hash.
 *
 * imageMirror.ts names files `<hash>_<size>.webp` where the hash is
 * sha1(sourceUrl) — derived from the SOURCE URL, not from the bytes. A
 * developer who replaces a photo at the same URL therefore produces the same
 * filename with different content, and a consumer keyed on the URL would never
 * re-download it. `bytes` + `modified` catches that; the filename cannot.
 *
 * A content hash would be stronger and is deliberately not built: hashing
 * 11 GB per export is not affordable, and storing a hash at mirror time means
 * changing the mirroring path, which this feature has no other reason to
 * touch. The residual blind spot — a file rewritten to the same byte length
 * within the same second — is stated in the spec rather than left implied.
 */
const MIRROR_RE = /^(\/uploads\/developments\/[^/]+\/[0-9a-f]+)_(small|medium|large)(\.[a-z0-9]+)$/i;

/** Absolute path on disk for a /uploads/... URL. In production
 *  public/uploads is a symlink to /var/www/shared-uploads; join() follows it. */
const diskPath = (url: string) => join(process.cwd(), "public", url.replace(/^\//, ""));

async function variantOf(url: string): Promise<ImageVariant | null> {
  try {
    const s = await stat(diskPath(url));
    if (!s.isFile()) return null;
    return { url: `${SITE_URL}${url}`, bytes: s.size, modified: s.mtime.toISOString() };
  } catch {
    // A URL in the database with no file behind it. Real: mirroring can fail
    // after the row is written. Skipped rather than thrown — one missing photo
    // must not fail a whole project's delivery.
    return null;
  }
}

/**
 * Expand stored image URLs into every variant that actually exists on disk.
 *
 * The database stores the _medium URL; _small and _large are siblings whose
 * names differ only in the suffix. Each one is stat()'d rather than assumed:
 * measured 2026-10-09 the three-variant set is the norm, but a URL that does
 * not match the mirrored pattern at all (an un-mirrored or raw
 * content-hashed file) still has to be delivered, so it falls through as a
 * single variant under its own size key.
 */
export async function imagesFor(urls: string[]): Promise<BridgeImage[]> {
  const out: BridgeImage[] = [];
  for (const stored of urls) {
    if (typeof stored !== "string" || !stored.startsWith("/uploads/")) continue;
    const m = stored.match(MIRROR_RE);
    const variants: Partial<Record<Size, ImageVariant>> = {};
    if (m) {
      const [, base, , ext] = m;
      for (const size of SIZES) {
        const v = await variantOf(`${base}_${size}${ext}`);
        if (v) variants[size] = v;
      }
    } else {
      const v = await variantOf(stored);
      if (v) variants.medium = v;
    }
    if (Object.keys(variants).length > 0) out.push({ stored, variants });
  }
  return out;
}
