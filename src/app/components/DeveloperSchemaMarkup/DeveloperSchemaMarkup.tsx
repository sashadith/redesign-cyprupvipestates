// components/DeveloperSchemaMarkup.tsx
import Script from "next/script";
import { urlFor } from "@/sanity/sanity.client";
import { abs } from "@/lib/seo";

interface DeveloperSchemaMarkupProps {
  developer: any;
  pageUrl: string;
}

const DeveloperSchemaMarkup: React.FC<DeveloperSchemaMarkupProps> = ({
  developer,
  pageUrl,
}) => {
  // Формируем JSON‑LD для застройщика как организации
  const schemaOrgJSONLD = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: developer.title,
    url: pageUrl,
    logo: developer.logo?.asset?._ref
      ? abs(urlFor(developer.logo).url())
      : undefined,
    description:
      developer.excerpt ||
      (typeof developer.description === "string" ? developer.description : ""),
  };

  return (
    <Script
      id="schema-org-developer"
      type="application/ld+json"
      strategy="beforeInteractive"
    >
      {JSON.stringify(schemaOrgJSONLD).replace(/</g, "\\u003c")}
    </Script>
  );
};

export default DeveloperSchemaMarkup;
