// components/SchemaMarkup.tsx
import Script from "next/script";
import { urlFor } from "@/sanity/sanity.client";
import { abs } from "@/lib/seo";

interface SchemaMarkupProps {
  project: any;
}

const SchemaMarkup: React.FC<SchemaMarkupProps> = ({ project }) => {
  const kf = project.keyFeatures ?? {};

  // Property entity type (schema.org Apartment / House are valid Accommodation types).
  const schemaType = kf.propertyType === "Apartment" ? "Apartment" : "House";

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
