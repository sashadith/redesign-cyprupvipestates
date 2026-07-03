import React from "react";

/* FAQPage JSON-LD for blog posts. Emitted ONLY when the post actually contains
   FAQ items — collects every question/answer from all faqBlock (and standalone
   accordionBlock) content blocks. Separate <script> from SchemaBlogPost, so the
   BlogPosting/Article schema is untouched. Renders nothing when there are no
   valid Q/A pairs (never an empty FAQPage). */

// Portable Text → plain text (same shape used by the projects FAQ schema).
const ptToPlain = (blocks: any): string =>
  (Array.isArray(blocks) ? blocks : [])
    .map((b) => (b?.children ? b.children.map((c: any) => c?.text || "").join("") : ""))
    .join(" ")
    .trim();

function collectFaqItems(blocks: any[]): Array<{ question: any; answer: any }> {
  const out: Array<{ question: any; answer: any }> = [];
  for (const b of Array.isArray(blocks) ? blocks : []) {
    const items =
      b?._type === "faqBlock" ? b?.faq?.items
      : b?._type === "accordionBlock" ? b?.items
      : null;
    if (Array.isArray(items)) {
      for (const it of items) out.push({ question: it?.question, answer: it?.answer });
    }
  }
  return out;
}

export default function SchemaBlogFaq({ blocks }: { blocks: any[] }) {
  const faqEntities = collectFaqItems(blocks)
    .map((it) => ({
      "@type": "Question",
      name: typeof it.question === "string" ? it.question.trim() : "",
      acceptedAnswer: { "@type": "Answer", text: ptToPlain(it.answer) },
    }))
    .filter((q) => q.name.length > 0 && q.acceptedAnswer.text.length > 0);

  if (faqEntities.length === 0) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqEntities,
        }).replace(/</g, "\\u003c"),
      }}
    />
  );
}
