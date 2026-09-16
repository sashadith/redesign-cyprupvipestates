// components/DeveloperSchemaMarkup.tsx
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
    <script
      id="schema-org-developer"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrgJSONLD).replace(/</g, "\\u003c") }}
    />
  );
};

export default DeveloperSchemaMarkup;
