// Project-specific Schema.org structured data for the new Development pipeline's
// SEO-facing project pages. VM-based (no Sanity coupling) — see
// src/app/components/SchemaMarkup/SchemaMarkup.tsx for the legacy Sanity-Project
// equivalent this mirrors. Renders RealEstateListing + BreadcrumbList JSON-LD.
import Script from "next/script";
import { abs } from "@/lib/seo";
import { localizedHref } from "@/lib/locale";
import type { ProjectVM } from "@/app/preview-project/feeds";
import { computeAvailability } from "@/lib/developmentAvailability";

export default function DevelopmentSchema({ p, lang, canonical }: { p: ProjectVM; lang: string; canonical: string }) {
  // Same guard the legacy component uses: no point emitting a listing schema
  // without at least a location fix and a photo to point at.
  if (!p.center || !p.gallery.length) return null;

  const { soldOut } = computeAvailability(p.units);
  // p.priceFrom/priceTo are already fully resolved by resolveDevelopmentPrice()
  // in mapRowToVM (src/lib/developmentCard.ts) — the single source of truth
  // every surface (this schema, the page itself, the merged /projects card) uses.
  const { priceFrom, priceTo } = p;

  const listing: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: p.publicName,
    description: p.description || undefined,
    url: canonical,
    image: p.gallery.map((g) => abs(g)),
    address: {
      "@type": "PostalAddress",
      addressLocality: p.town || p.area || undefined,
      addressRegion: p.district || undefined,
      addressCountry: "CY",
    },
    geo: { "@type": "GeoCoordinates", latitude: p.center.lat, longitude: p.center.lng },
    ...(p.units.length ? { numberOfAccommodationUnits: p.units.length } : {}),
    ...(priceFrom != null
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: p.currency || "EUR",
            ...(priceTo != null && priceTo !== priceFrom ? { priceSpecification: { "@type": "PriceSpecification", minPrice: priceFrom, maxPrice: priceTo, priceCurrency: p.currency || "EUR" } } : { price: priceFrom }),
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
      <Script id="development-schema" type="application/ld+json" strategy="beforeInteractive">
        {JSON.stringify(listing).replace(/</g, "\\u003c")}
      </Script>
      <Script id="development-breadcrumb" type="application/ld+json" strategy="beforeInteractive">
        {JSON.stringify(breadcrumb).replace(/</g, "\\u003c")}
      </Script>
    </>
  );
}
