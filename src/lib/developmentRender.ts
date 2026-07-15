import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { Development, DevelopmentOverride, DevelopmentUnit } from "@prisma/client";
import type { ProjectVM } from "@/app/preview-project/feeds";
import type { UnitVM } from "@/app/preview-project/UnitsView";
import type { SeoOverride } from "@/lib/developmentSeo";

/* Render a development straight from the DB (Phase 1, Increment 4). Reads the
   synced Development/Units + merges the admin DevelopmentOverride (alias, area,
   main image, description, amenities … always win) → the same ProjectVM the page
   already renders. The public site reads this; the live-feed adapter stays as a
   fallback for anything not yet synced. */

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const joinLoc = (...parts: string[]) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts) {
    const p = (raw || "").trim();
    if (p && !seen.has(p.toLowerCase())) { seen.add(p.toLowerCase()); out.push(p); }
  }
  return out.join(" · ");
};
const statusLabel = (s: string) => (s === "sold" ? "Sold" : s === "reserved" ? "Reserved" : "Available");

type Row = Development & { units: DevelopmentUnit[]; override: DevelopmentOverride | null };

// ProjectVM plus the pipeline-only fields the page/metadata layer needs
// (slug/publishStatus/seoOverride aren't part of the feed-facing ProjectVM
// contract, but are harmless extra properties on the returned object —
// structural typing means every existing ProjectVM consumer just ignores them).
export type DbProjectVM = ProjectVM & { slug: string | null; publishStatus: string; seoOverride: SeoOverride | null };

// Exported for the Client Presentation system (src/app/c/[token]), which
// renders developments from potentially many different developers in one
// page and needs the same override-merge logic in bulk, not a single
// feedKey/slug lookup. `lang` selects the override description field
// (descriptionEN/DE/PL/RU); existing callers don't pass it and keep the
// original EN-preferring behaviour.
export function mapRowToVM(d: Row, lang: string = "en"): DbProjectVM {
  const ov = d.override;

  const district = ov?.district || d.district || "";
  const town = ov?.town || d.town || "";
  const area = ov?.area || d.area || "";
  // Admin-managed gallery (reordered/uploaded) wins over the feed gallery.
  const gallery = arr<string>(ov?.gallery).length ? arr<string>(ov?.gallery) : arr<string>(d.gallery);
  const main = ov?.mainImage || null;
  const finalGallery = main ? [main, ...gallery.filter((u) => u !== main)] : gallery;
  const amenities = Array.from(new Set([...arr<string>(ov?.amenities), ...arr<string>(d.amenities)]));

  const units: UnitVM[] = d.units.map((u) => ({
    id: u.id,
    ref: u.ref ?? "", name: u.name ?? "", label: u.label ?? "", type: u.type ?? "",
    status: (u.status as UnitVM["status"]) ?? "available", statusLabel: statusLabel(u.status ?? "available"),
    price: u.price ?? null, currency: u.currency ?? "EUR",
    beds: u.beds ?? "", baths: u.baths ?? "", areaBuilt: u.areaBuilt ?? "", areaPlot: u.areaPlot ?? "", areaVeranda: u.areaVeranda ?? "",
    floor: u.floor ?? "", attrs: arr(u.attrs), features: arr<string>(u.amenities),
    // No unit photos uploaded → fall back to the project gallery (hero/main image first).
    photos: arr<string>(u.photos).length ? arr<string>(u.photos) : finalGallery,
    plans: arr<string>(u.plans),
    coords: u.latitude != null && u.longitude != null ? { lat: u.latitude, lng: u.longitude } : null,
    description: "",
  }));

  // Unit-driven feeds (and manually-created developments — no adapter ever
  // sets a project-level price for those) leave Development.priceFrom null
  // even though real unit prices exist. Fall back to the cheapest available,
  // priced unit rather than showing no price at all.
  const availableUnitPrices = units.filter((u) => u.status === "available" && u.price != null).map((u) => u.price as number);
  const priceFrom = d.priceFrom ?? (availableUnitPrices.length ? Math.min(...availableUnitPrices) : null);

  return {
    id: d.feedProjectId, dev: d.dev, publicName: ov?.alias || d.publicName, developerName: d.developerName, developer: d.developer ?? "",
    location: joinLoc(district, town, area), district, town, area,
    status: d.status ?? "", category: d.category ?? undefined,
    stage: d.stage ?? undefined, completion: ov?.completion || d.completion || "", energy: ov?.energy || d.energy || "",
    priceFrom, priceTo: d.priceTo ?? null, currency: d.currency ?? "EUR",
    description: ({ en: ov?.descriptionEN, de: ov?.descriptionDE, pl: ov?.descriptionPL, ru: ov?.descriptionRU } as Record<string, string | null | undefined>)[lang] || ov?.descriptionEN || d.description || "",
    gallery: finalGallery, plans: arr<string>(d.plans), renders: [], amenities,
    extraFacts: arr<{ label: string; value: string }>(d.extraFacts), heroVideo: ov?.heroVideo || undefined,
    vatApplies: ov?.vatApplies ?? null,
    center: (ov?.latitude ?? d.latitude) != null && (ov?.longitude ?? d.longitude) != null
      ? { lat: (ov?.latitude ?? d.latitude)!, lng: (ov?.longitude ?? d.longitude)! }
      : null,
    units,
    slug: d.slug ?? null,
    publishStatus: d.publishStatus,
    seoOverride: (d.override?.seo as SeoOverride | null) ?? null,
  };
}

// cache() dedupes within a single request/render pass — both generateMetadata()
// and the page component call these, and this way that's one DB round-trip, not two
// (mirrors the existing `cache(_getProjectByLang)` pattern in sanity.utils.ts).

export const getDbProject = cache(async (dev: string, id: string): Promise<DbProjectVM | null> => {
  if (!id) return null;
  const d = await prisma.development.findUnique({
    where: { feedKey: `${dev}:${id}` },
    include: { units: { orderBy: { sortIndex: "asc" } }, override: true },
  });
  return d ? mapRowToVM(d) : null;
});

/** Slug-based lookup for the SEO-facing route (src/app/[lang]/preview-project/[slug]/page.tsx). */
export const getDbProjectBySlug = cache(async (slug: string): Promise<DbProjectVM | null> => {
  if (!slug) return null;
  const d = await prisma.development.findUnique({
    where: { slug },
    include: { units: { orderBy: { sortIndex: "asc" } }, override: true },
  });
  return d ? mapRowToVM(d) : null;
});

/** Bulk by-id lookup, keyed by Development.id — for the Client Presentation
 *  system (src/app/c/[token]), which renders a curated set of developments
 *  from potentially different developers on one page. */
export async function getDbProjectsByIds(ids: string[], lang: string = "en"): Promise<Record<string, DbProjectVM>> {
  if (!ids.length) return {};
  const rows = await prisma.development.findMany({
    where: { id: { in: ids } },
    include: { units: { orderBy: { sortIndex: "asc" } }, override: true },
  });
  const out: Record<string, DbProjectVM> = {};
  for (const r of rows) out[r.id] = mapRowToVM(r, lang);
  return out;
}
