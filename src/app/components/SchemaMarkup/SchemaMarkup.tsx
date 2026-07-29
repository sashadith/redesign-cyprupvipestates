// components/SchemaMarkup.tsx
import Script from "next/script";
import { urlFor } from "@/sanity/sanity.client";
import { abs } from "@/lib/seo";

interface SchemaMarkupProps {
  project: any;
}

const SchemaMarkup: React.FC<SchemaMarkupProps> = ({ project }) => {
  const kf = project.keyFeatures ?? {};

  // Property entity type (schema.org Apartment / House are valid Accommodation
  // types, but Accommodation itself is residential-only — Office/Shop/Commercial
  // listings have no honest fit there. "Place" is the actual common ancestor of
  // Accommodation/Apartment/House: valid for any physical location, doesn't
  // claim a false residential subtype. Villa/Townhouse still fall to "House"
  // here, pre-existing and out of scope for the Commercial-tagging change.
  const isCommercial = /commercial|office|shop/i.test(kf.propertyType ?? "");
  const schemaType = kf.propertyType === "Apartment" ? "Apartment" : isCommercial ? "Place" : "House";

  const additionalProperty = [
    { name: "Bedrooms", value: kf.bedrooms },
    { name: "Covered Area", value: kf.coveredArea },
    { name: "Plot Size", value: kf.plotSize },
    { name: "Energy Efficiency", value: kf.energyEfficiency },
  ]
    .filter((p) => p.value !== undefined && p.value !== null && p.value !== "")
    .map((p) => ({ "@type": "PropertyValue", name: p.name, value: p.value }));

  const images = Array.isArray(project.images)
    ? project.images.map((img: any) => abs(urlFor(img).url())).filter(Boolean)
    : undefined;

  const jsonLd: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name: project.title,
    description: project.excerpt,
    ...(images && images.length ? { image: images } : {}),
    address: {
      "@type": "PostalAddress",
      addressLocality: kf.city,
      addressCountry: "CY",
    },
    ...(project.location
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: project.location.lat,
            longitude: project.location.lng,
          },
        }
      : {}),
    ...(additionalProperty.length ? { additionalProperty } : {}),
    offers: {
      "@type": "Offer",
      price: kf.price,
      priceCurrency: "EUR",
      availability:
        project.propertyPurpose === "Sale"
          ? "https://schema.org/InStock"
          : "https://schema.org/ForRent",
      seller: {
        "@type": "Organization",
        name: project.developer?.name,
        ...(project.developer?.logo
          ? { logo: abs(urlFor(project.developer.logo).url()) }
          : {}),
      },
    },
  };

  return (
    <Script
      id="schema-markup"
      type="application/ld+json"
      strategy="beforeInteractive"
    >
      {JSON.stringify(jsonLd).replace(/</g, "\\u003c")}
    </Script>
  );
};

export default SchemaMarkup;
