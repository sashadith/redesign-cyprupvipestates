// The ONE rule for "which image is this development's hero" (2026-10-19).
// mapRowToVM (developmentRender.ts) used to inline it; the public project
// page renders finalGallery[0] as the hero (HeroMedia, at the "large" tier)
// and generateMetadata uses the same first image as og:image. The MCP
// connector's crm_get_project / crm_search_projects now return that exact
// image, so the precedence lives here and both callers share it:
//   1. the admin-picked hero (override.mainImage)
//   2. the admin-managed gallery (override.gallery) — wins over the feed's
//   3. the feed gallery (Development.gallery)
// Pure and client-safe (no Prisma): the only imports are the URL helpers.
import { abs } from "@/lib/seo";
import { atSize } from "@/app/preview-project/imageSize";

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export type HeroSource = {
  gallery?: unknown; // Development.gallery — string[] of mirrored (or vendor) URLs
  override?: { mainImage?: string | null; gallery?: unknown } | null;
};

/** The gallery in display order: admin hero first, then the rest without duplicates. */
export function resolveGalleryOrder(d: HeroSource): string[] {
  const ov = d.override;
  const gallery = arr<string>(ov?.gallery).length ? arr<string>(ov?.gallery) : arr<string>(d.gallery);
  const main = ov?.mainImage || null;
  return (main ? [main, ...gallery.filter((u) => u !== main)] : gallery).filter((u): u is string => typeof u === "string" && !!u);
}

export function resolveHeroImage(d: HeroSource): string | null {
  return resolveGalleryOrder(d)[0] ?? null;
}

/** True when we serve the file ourselves (imageMirror writes to /uploads/developments/…). */
export function isMirroredImage(url: string): boolean {
  return url.startsWith("/uploads/") || url.startsWith(`${abs("/uploads/")}`);
}

/** Absolute hero URL for the connector — the page's hero at its largest
 *  hosted tier — or null when the project is not published (an unpublished
 *  project never exposes an image, whatever includeReady says) or has none. */
export function heroImageUrl(d: HeroSource & { publishStatus: string }): string | null {
  if (d.publishStatus !== "published") return null;
  const hero = resolveHeroImage(d);
  return hero ? abs(atSize(hero, "large")) : null;
}

/** The per-locale paths of publicUrlFor() prefixed with the site origin. */
export function absoluteUrls<T extends Record<string, string>>(paths: T | null): T | null {
  if (!paths) return null;
  return Object.fromEntries(Object.entries(paths).map(([k, v]) => [k, abs(v)])) as T;
}
