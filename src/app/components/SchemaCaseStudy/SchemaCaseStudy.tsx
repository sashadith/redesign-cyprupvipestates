// components/SchemaCaseStudy.tsx
import Script from "next/script";
import { urlFor } from "@/sanity/sanity.client";
import { CaseStudy } from "@/types/caseStudy";
import { abs } from "@/lib/seo";

type Props = {
  caseStudy: CaseStudy;
  lang: string;
};

const SchemaCaseStudy = ({ caseStudy, lang }: Props) => {
  const imageUrl = caseStudy.previewImage
    ? abs(urlFor(caseStudy.previewImage).url())
    : undefined;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: caseStudy.seo?.metaTitle || caseStudy.title,
    description: caseStudy.seo?.metaDescription || caseStudy.excerpt,
    image: imageUrl ? [imageUrl] : undefined,
    datePublished: caseStudy.publishedAt,
    dateModified: caseStudy._updatedAt,
    inLanguage: lang,
    author: {
      "@type": "Organization",
      name: "Cyprus VIP Estates",
    },
    publisher: {
      "@type": "Organization",
      name: "Cyprus VIP Estates",
    },
    about: {
      "@type": "RealEstateAgent",
      name: "Cyprus VIP Estates",
      areaServed: {
        "@type": "Country",
        name: "Cyprus",
      },
    },
  };

  return (
    <Script
      id="schema-case-study"
      type="application/ld+json"
      strategy="beforeInteractive"
    >
      {JSON.stringify(jsonLd).replace(/</g, "\\u003c")}
    </Script>
  );
};

export default SchemaCaseStudy;
