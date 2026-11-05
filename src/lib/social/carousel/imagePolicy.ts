// Which images a carousel may use (2026-11-05): only files we host ourselves
// under /uploads on cyprusvipestates.com — which is also exactly what
// crm_get_project's gallery returns. A URL is resolved to the file on disk and
// handed to Chromium as file://, so the renderer never fetches anything over
// the network and an outside URL cannot reach a slide even by redirect.
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { SITE_URL } from "@/lib/seo";

export class ImageRejected extends Error {}

/** Disk root behind /uploads: public/uploads (a symlink to /var/www/shared-uploads in production). */
export function uploadsRoot(): string {
  return process.env.SOCIAL_UPLOADS_ROOT || path.join(process.cwd(), "public", "uploads");
}

const SITE_HOST = new URL(SITE_URL).host;

/** The /uploads/… path of an allowed URL, or an ImageRejected naming why. Pure (no disk access). */
export function uploadsPathOf(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new ImageRejected(`not an absolute URL: ${raw.slice(0, 120)}`);
  }
  if (u.protocol !== "https:" || u.host !== SITE_HOST) throw new ImageRejected(`only ${SITE_URL}/uploads/… images are allowed: ${raw.slice(0, 120)}`);
  if (u.search || u.hash || u.username || u.password) throw new ImageRejected(`query strings and fragments are not allowed: ${raw.slice(0, 120)}`);
  let p: string;
  try {
    p = decodeURIComponent(u.pathname);
  } catch {
    throw new ImageRejected(`malformed path: ${raw.slice(0, 120)}`);
  }
  if (!p.startsWith("/uploads/") || p.split("/").some((seg) => seg === ".." || seg === ".") || p.includes("\\") || p.includes("\0")) {
    throw new ImageRejected(`not an /uploads/ path: ${raw.slice(0, 120)}`);
  }
  // Earlier carousel output is never a source — a slide inside a slide.
  if (p.startsWith("/uploads/social/")) throw new ImageRejected(`rendered slides cannot be used as images: ${raw.slice(0, 120)}`);
  return p;
}

/** Resolve an allowed URL to a real image file inside the uploads root; returns its file:// URL. */
export async function resolveImage(raw: string, root = uploadsRoot()): Promise<string> {
  const rel = uploadsPathOf(raw).slice("/uploads/".length);
  const realRoot = await fs.realpath(root);
  let real: string;
  try {
    real = await fs.realpath(path.join(realRoot, rel));
  } catch {
    throw new ImageRejected(`image not found on this server: ${raw.slice(0, 120)}`);
  }
  if (!real.startsWith(realRoot + path.sep)) throw new ImageRejected(`image resolves outside /uploads: ${raw.slice(0, 120)}`);
  try {
    const meta = await sharp(real).metadata();
    if (!meta.width || !meta.height) throw new Error("no size");
  } catch {
    throw new ImageRejected(`not a readable image: ${raw.slice(0, 120)}`);
  }
  return pathToFileURL(real).href;
}
