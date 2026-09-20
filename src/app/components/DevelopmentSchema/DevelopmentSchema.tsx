// Project-specific Schema.org structured data for the new Development pipeline's
// SEO-facing project pages. VM-based (no Sanity coupling) — see
// src/app/components/SchemaMarkup/SchemaMarkup.tsx for the legacy Sanity-Project
// equivalent this mirrors. Renders RealEstateListing + BreadcrumbList JSON-LD.
import { abs } from "@/lib/seo";
import { localizedHref, bcp47For } from "@/lib/locale";
import type { ProjectVM } from "@/app/preview-project/feeds";
import { computeAvailability, listedUnits } from "@/lib/developmentAvailability";

// Schema.org has no dedicated "Villa"/"Townhouse" type — House is the closer
// fit for both than the bare, type-less Residence this used to fall back to
// for every single unit type. "Residence" survives only when a development
// genuinely mixes villas and apartments (so no single accommodation type
// would be accurate) or the type string is unrecognised. Duplicated rather
// than imported from developmentSeo.ts's own typeKeyOf: that one is
// module-private, and this is a four-line string match, not worth exporting
// an internal for.
function accommodationType(raw: string | undefined): string {
  const t = (raw || "").toLowerCase();
  if (t.includes("villa") || t.includes("house") || t.includes("bungalow") || t.includes("town")) return "House";
  if (t.includes("apart") || t.includes("flat")) return "Apartment";
  return "Residence";
}

// min/max across listed units (falling back to all units for a sold-out/
// withdrawn development, same population developmentSeo.ts's own
// describedUnits() uses) — a plain number when every unit agrees, a
// QuantitativeValue range otherwise. Never omitted outright the way the old
// code dropped numberOfRooms/floorSize entirely rather than risk a single
// misleading value: a range is exactly what QuantitativeValue exists for.
function numericRange(raws: (string | undefined)[]): number | { minValue: number; maxValue: number } | undefined {
  const nums = raws
    .map((r) => Number(String(r ?? "").match(/[\d.]+/)?.[0]))
    .filter((n): n is number => Number.isFinite(n) && n > 0);
  if (!nums.length) return undefined;
  const lo = Math.min(...nums), hi = Math.max(...nums);
  return lo === hi ? lo : { minValue: lo, maxValue: hi };
}

export default function DevelopmentSchema({ p, lang, canonical }: { p: ProjectVM; lang: string; canonical: string }) {
  // Same guard the legacy component uses: no point emitting a listing schema
  // without at least a location fix and a photo to point at.
  if (!p.center || !p.gallery.length) return null;

  const { soldOut } = computeAvailability(p.units);
  // Same listed-only population the page itself counts and renders — a
  // numberOfAccommodationUnits taken from the raw rows would tell Google a
  // larger number than the page shows (see listedUnits). Sold-out pages no
  // longer render the units block at all (ProjectPageBody, 2026-08-24), so
  // the count is dropped there too rather than left describing a list that
  // isn't on the page — structured data stays a description of what's
  // actually rendered. `availability: SoldOut` below is unaffected.
  const listed = listedUnits(p.units);
  const describedUnits = listed.length ? listed : p.units;
  const listedCount = soldOut ? 0 : listed.length;
  // p.priceFrom/priceTo are already fully resolved by resolveDevelopmentPrice()
  // in mapRowToVM (src/lib/developmentCard.ts) — the single source of truth
  // every surface (this schema, the page itself, the merged /projects card) uses.
  const { priceFrom, priceTo } = p;

  const types = Array.from(new Set(describedUnits.map((u) => u.type).filter(Boolean)));
  const aboutType = types.length === 1 ? accommodationType(types[0]) : accommodationType(undefined);
  const numberOfBedroomsTotal = numericRange(describedUnits.map((u) => u.beds));
  const numberOfBathroomsTotal = numericRange(describedUnits.map((u) => u.baths));
  const floorSizeValue = numericRange(describedUnits.map((u) => u.areaBuilt));

  const listing: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: p.publicName,
    description: p.description || undefined,
    url: canonical,
    inLanguage: bcp47For(lang),
    image: p.gallery.map((g) => abs(g)),
    address: {
      "@type": "PostalAddress",
      addressLocality: p.town || p.area || undefined,
      addressRegion: p.district || undefined,
      addressCountry: "CY",
    },
    geo: { "@type": "GeoCoordinates", latitude: p.center.lat, longitude: p.center.lng },
    ...(listedCount ? { numberOfAccommodationUnits: listedCount } : {}),
    // The physical accommodation this listing is FOR — schema.org's own
    // "about" pattern for RealEstateListing, since the listing itself isn't
    // the house/apartment, it's an offer to sell one. numberOfBedrooms/
    // numberOfBathroomsTotal/floorSize now carry a real value or range
    // instead of being dropped: see numericRange() above.
    about: {
      "@type": aboutType,
      name: p.publicName,
      ...(p.category ? { accommodationCategory: p.category } : {}),
      ...(numberOfBedroomsTotal != null ? { numberOfBedroomsTotal } : {}),
      ...(numberOfBathroomsTotal != null ? { numberOfBathroomsTotal } : {}),
      ...(floorSizeValue != null
        ? {
            floorSize:
              typeof floorSizeValue === "number"
                ? { "@type": "QuantitativeValue", value: floorSizeValue, unitCode: "MTK" }
                : { "@type": "QuantitativeValue", ...floorSizeValue, unitCode: "MTK" },
          }
        : {}),
    },
    // Amenities as LocationFeatureSpecification — the schema.org-blessed way to
    // enumerate what a listing offers (pool, gym, sea view…).
    ...(p.amenities?.length
      ? { amenityFeature: p.amenities.map((a) => ({ "@type": "LocationFeatureSpecification", name: a, value: true })) }
      : {}),
    ...(priceFrom != null
      ? {
          // AggregateOffer (lowPrice/highPrice) is the schema.org-standard shape
          // for a range across multiple similar-but-not-identical units — the
          // previous single Offer + ad-hoc PriceSpecification.minPrice/maxPrice
          // was a bespoke workaround for the same thing. A uniform price (every
          // unit the same, or only one left) still gets a plain Offer.
          offers:
            priceTo != null && priceTo !== priceFrom
              ? {
                  "@type": "AggregateOffer",
                  priceCurrency: p.currency || "EUR",
                  lowPrice: priceFrom,
                  highPrice: priceTo,
                  ...(listedCount ? { offerCount: listedCount } : {}),
                  availability: soldOut ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
                  ...(p.developer ? { seller: { "@type": "Organization", name: p.developer } } : {}),
                }
              : {
                  "@type": "Offer",
                  priceCurrency: p.currency || "EUR",
                  price: priceFrom,
                  availability: soldOut ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
                  ...(p.developer ? { seller: { "@type": "Organization", name: p.developer } } : {}),
                },
        }
      : {}),
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: abs(localizedHref(lang)) },
      // Cutover (2026-07-17): the unified listing at /[lang]/projects now serves
      // both legacy and Development results — link there, not the old isolated
      // /preview-projects design sandbox.
      { "@type": "ListItem", position: 2, name: "Projects", item: abs(localizedHref(lang, "projects")) },
      { "@type": "ListItem", position: 3, name: p.publicName, item: canonical },
    ],
  };

  return (
    <>
      <script
        id="development-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(listing).replace(/</g, "\\u003c") }}
      />
      <script
        id="development-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb).replace(/</g, "\\u003c") }}
      />
    </>
  );
}
