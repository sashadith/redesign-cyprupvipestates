// What the public project page shows, as data for the MCP connector (2026-11-05):
// the gallery in page order and the features list. The page itself uses
// pageBenefits() (ProjectPageBody), so page and connector cannot drift apart.
// Pure and client-safe.
import { isDistanceClaim } from "@/lib/distanceClaims";
import { abs } from "@/lib/seo";
import { atSize } from "@/app/preview-project/imageSize";
import { isMirroredImage, resolveGalleryOrder, type HeroSource } from "@/lib/developmentHero";

export const MAX_GALLERY = 40;

/** The features list of the page: the project's amenities, else the units' features; never distance claims. */
export function pageBenefits(amenities: string[], unitFeatures: string[][]): string[] {
  const base = amenities.length ? amenities : Array.from(new Set(unitFeatures.flat()));
  return base.filter((b) => b && !isDistanceClaim(b));
}

/** The page's gallery in page order, as absolute URLs of our largest mirrored tier (vendor-hosted images are skipped). */
export function pageGalleryUrls(d: HeroSource): string[] {
  const out: string[] = [];
  for (const u of resolveGalleryOrder(d)) {
    if (!isMirroredImage(u)) continue;
    const url = abs(atSize(u, "large"));
    if (!out.includes(url)) out.push(url);
    if (out.length === MAX_GALLERY) break;
  }
  return out;
}
