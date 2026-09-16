// app/components/StructuredData.tsx

import { generateStructuredData, PageInput } from "@/utils/structuredData";

export function StructuredData(props: PageInput) {
  const jsonLd = generateStructuredData(props);
  return (
    <script
      id="structured-data"
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd, null, 2).replace(/</g, "\\u003c"),
      }}
    />
  );
}
