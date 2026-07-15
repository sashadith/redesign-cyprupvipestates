// Project-specific Schema.org structured data for the new Development pipeline's
// SEO-facing project pages. VM-based (no Sanity coupling) — see
// src/app/components/SchemaMarkup/SchemaMarkup.tsx for the legacy Sanity-Project
// equivalent this mirrors. Renders RealEstateListing + BreadcrumbList JSON-LD.
import Script from "next/script";
import { abs } from "@/lib/seo";
import { localizedHref } from "@/lib/locale";
import type { ProjectVM } from "@/app/preview-project/feeds";

export default function DevelopmentSchema({ p, lang, canonical }: { p: ProjectVM; lang: string; canonical: string }) {
  // Same guard the legacy component uses: no point emitting a listing schema
  // without at least a location fix and a photo to point at.
  if (!p.center || !p.gallery.length) return null;

  const avail = p.units.filter((u) => u.status === "available");
  const priceFrom = p.priceFrom ?? avail.map((u) => u.price).filter((n): n is number => n != null).sort((a, b) => a - b)[0] ?? null;
  const priceTo = p.priceTo ?? avail.map((u) => u.price).filter((n): n is number => n != null).sort((a, b) => b - a)[0] ?? null;

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
            availability: avail.length > 0 ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
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
      // Points at the new pipeline's own listing page (not the legacy "/projects",
      // a different system) — update to "projects" once the cutover in the plan
      // (README: SEO-Fundament plan) retires the old route and takes over the path.
      { "@type": "ListItem", position: 2, name: "Projects", item: abs(localizedHref(lang, "preview-projects")) },
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
